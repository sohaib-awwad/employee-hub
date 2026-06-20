import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  db,
  leavesTable,
  requestsTable,
  announcementsTable,
  employeesTable,
  attendanceTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { format } from "date-fns";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { toPublicEmployee } from "../lib/employee";
import { minutesBetween } from "../lib/attendance";

const router: IRouter = Router();

// Everything here requires a logged-in admin.
router.use(requireAuth, requireAdmin);

async function employeeNameMap(): Promise<Map<number, string>> {
  const emps = await db.select().from(employeesTable);
  return new Map(emps.map((e) => [e.id, e.name]));
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || name.slice(0, 2)).toUpperCase();
}

// Pagination defaults: 10 rows per page, capped at 100 to bound payloads even
// if a client asks for more. Rows are sliced after filtering so the page count
// reflects the active search/filters (the contract is the same whether the
// slice happens here or, later, in SQL with LIMIT/OFFSET).
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

function parsePaging(req: { query: Record<string, unknown> }): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const rawLimit = parseInt(String(req.query.limit ?? DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE;
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, rawLimit));
  return { page, limit, offset: (page - 1) * limit };
}

// ---------------------------------------------------------------- Overview
// Self-contained dashboard payload: counts + the small "recent" lists the
// overview screen renders. Keeping it in one endpoint means the dashboard
// never has to download full leave/request/employee tables just to summarise
// them (which matters as those tables grow).
router.get("/admin/overview", async (req, res) => {
  try {
    const today = format(new Date(), "yyyy-MM-dd");
    const monthPrefix = format(new Date(), "yyyy-MM");

    const [leaves, requests, employees, announcements, todayAttendance] = await Promise.all([
      db.select().from(leavesTable).orderBy(desc(leavesTable.createdAt)),
      db.select().from(requestsTable).orderBy(desc(requestsTable.createdAt)),
      db.select().from(employeesTable),
      db.select().from(announcementsTable).orderBy(desc(announcementsTable.publishedAt)),
      db.select().from(attendanceTable).where(eq(attendanceTable.date, today)),
    ]);

    const names = new Map(employees.map((e) => [e.id, e.name]));
    const withName = <T extends { employeeId: number }>(r: T) => ({
      ...r,
      employeeName: names.get(r.employeeId) ?? null,
    });

    const pendingLeaveRows = leaves.filter((l) => l.status === "pending");
    const outToday = leaves.filter(
      (l) => l.status === "approved" && l.startDate <= today && today <= l.endDate,
    );

    const presentToday = todayAttendance.filter(
      (a) => a.status === "present" || a.status === "half_day",
    ).length;
    const totalEmployees = employees.length;
    const onLeaveToday = outToday.length;
    const notClockedIn = Math.max(0, totalEmployees - presentToday - onLeaveToday);
    const joinedThisMonth = employees.filter((e) => (e.joinDate ?? "").startsWith(monthPrefix)).length;

    res.json({
      pendingLeaves: pendingLeaveRows.length,
      pendingRequests: requests.filter((r) => r.status === "pending").length,
      totalEmployees,
      totalAnnouncements: announcements.length,
      joinedThisMonth,
      presentToday,
      onLeaveToday,
      notClockedIn,
      pendingLeaveItems: pendingLeaveRows.slice(0, 5).map(withName),
      recentRequests: requests.slice(0, 5).map(withName),
      outToday: outToday.slice(0, 8).map(withName),
      latestAnnouncement: announcements[0] ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load admin overview");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ------------------------------------------------------------------ Leaves
router.get("/admin/leaves", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const q = (req.query.q as string | undefined)?.trim().toLowerCase();
    const { page, limit, offset } = parsePaging(req);

    const names = await employeeNameMap();
    let rows = (await db.select().from(leavesTable).orderBy(desc(leavesTable.createdAt))).map((r) => ({
      ...r,
      employeeName: names.get(r.employeeId) ?? null,
    }));
    if (status) rows = rows.filter((r) => r.status === status);
    if (q) rows = rows.filter((r) => [r.employeeName, r.type, r.reason].some((v) => v?.toLowerCase().includes(q)));

    const total = rows.length;
    res.json({ items: rows.slice(offset, offset + limit), total, page, limit });
  } catch (err) {
    req.log.error({ err }, "Failed to list leaves (admin)");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/leaves/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const updated = await db
      .update(leavesTable)
      .set({ status: "approved", approvedBy: req.user!.name })
      .where(eq(leavesTable.id, id))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Leave not found" });
      return;
    }
    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to approve leave");
    res.status(500).json({ error: "Internal server error" });
  }
});

const ActionSchema = z.object({ comments: z.string().nullish() });

router.post("/admin/leaves/:id/reject", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const comments = ActionSchema.safeParse(req.body).data?.comments ?? null;
    const updated = await db
      .update(leavesTable)
      .set({ status: "rejected", approvedBy: req.user!.name, comments })
      .where(eq(leavesTable.id, id))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Leave not found" });
      return;
    }
    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to reject leave");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------- Requests
router.get("/admin/requests", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const q = (req.query.q as string | undefined)?.trim().toLowerCase();
    const { page, limit, offset } = parsePaging(req);

    const names = await employeeNameMap();
    let rows = (await db.select().from(requestsTable).orderBy(desc(requestsTable.createdAt))).map((r) => ({
      ...r,
      employeeName: names.get(r.employeeId) ?? null,
    }));
    if (status) rows = rows.filter((r) => r.status === status);
    if (q) rows = rows.filter((r) => [r.employeeName, r.type, r.reason].some((v) => v?.toLowerCase().includes(q)));

    const total = rows.length;
    res.json({ items: rows.slice(offset, offset + limit), total, page, limit });
  } catch (err) {
    req.log.error({ err }, "Failed to list requests (admin)");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Optional payload when approving a request: the corrected work window the
// admin sets in the approval modal. yyyy-mm-dd / HH:mm.
const RequestApprovalSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  punchIn: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  punchOut: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
});

router.post("/admin/requests/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const existing = await db.select().from(requestsTable).where(eq(requestsTable.id, id)).limit(1);
    const request = existing[0];
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const parsed = RequestApprovalSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const { punchIn, punchOut } = parsed.data;
    const targetDate = parsed.data.date ?? request.date ?? null;

    // When the admin supplies a corrected work window, write it to the
    // employee's attendance for that day and approve the request atomically.
    if (punchIn && punchOut) {
      if (!targetDate) {
        res.status(400).json({ error: "A date is required to correct attendance." });
        return;
      }
      if (minutesBetween(punchIn, punchOut) <= 0) {
        res.status(400).json({ error: "End time must be after the start time." });
        return;
      }
      const hours = Math.round((minutesBetween(punchIn, punchOut) / 60) * 10) / 10;
      const note = `Corrected via request #${id} by ${req.user!.name}`;

      const updated = await db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(attendanceTable)
          .where(and(eq(attendanceTable.employeeId, request.employeeId), eq(attendanceTable.date, targetDate)))
          .limit(1);
        if (rows[0]) {
          await tx
            .update(attendanceTable)
            .set({ punchIn, punchOut, hoursWorked: hours, status: "present", note })
            .where(eq(attendanceTable.id, rows[0].id));
        } else {
          await tx.insert(attendanceTable).values({
            employeeId: request.employeeId,
            date: targetDate,
            punchIn,
            punchOut,
            hoursWorked: hours,
            status: "present",
            note,
          });
        }
        const upd = await tx
          .update(requestsTable)
          .set({ status: "approved" })
          .where(eq(requestsTable.id, id))
          .returning();
        return upd[0];
      });

      res.json(updated);
      return;
    }

    // No correction payload — approve without touching attendance.
    const updated = await db
      .update(requestsTable)
      .set({ status: "approved" })
      .where(eq(requestsTable.id, id))
      .returning();
    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to approve request");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/requests/:id/reject", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const comments = ActionSchema.safeParse(req.body).data?.comments ?? null;
    const updated = await db
      .update(requestsTable)
      .set({ status: "rejected", comments })
      .where(eq(requestsTable.id, id))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to reject request");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ----------------------------------------------------------- Announcements
const AnnouncementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  category: z.string().min(1),
  priority: z.enum(["low", "medium", "high"]),
  type: z.enum(["announcement", "event"]),
  publishedAt: z.string().min(1),
});

router.post("/admin/announcements", async (req, res) => {
  try {
    const parsed = AnnouncementSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const inserted = await db.insert(announcementsTable).values(parsed.data).returning();
    res.status(201).json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to create announcement");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/announcements/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const parsed = AnnouncementSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const updated = await db
      .update(announcementsTable)
      .set(parsed.data)
      .where(eq(announcementsTable.id, id))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Announcement not found" });
      return;
    }
    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to update announcement");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/announcements/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const deleted = await db
      .delete(announcementsTable)
      .where(eq(announcementsTable.id, id))
      .returning();
    if (!deleted[0]) {
      res.status(404).json({ error: "Announcement not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete announcement");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ------------------------------------------------------------- Employees
router.get("/admin/employees", async (req, res) => {
  try {
    const q = (req.query.q as string | undefined)?.trim().toLowerCase();
    const { page, limit, offset } = parsePaging(req);

    let rows = (await db.select().from(employeesTable).orderBy(employeesTable.id)).map(toPublicEmployee);
    if (q) {
      rows = rows.filter((e) => [e.name, e.email, e.department, e.position].some((v) => v?.toLowerCase().includes(q)));
    }

    const total = rows.length;
    res.json({ items: rows.slice(offset, offset + limit), total, page, limit });
  } catch (err) {
    req.log.error({ err }, "Failed to list employees (admin)");
    res.status(500).json({ error: "Internal server error" });
  }
});

const EmployeeCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  department: z.string().min(1),
  position: z.string().min(1),
  joinDate: z.string().min(1),
  gender: z.enum(["male", "female"]),
  avatarInitials: z.string().nullish(),
  phone: z.string().nullish(),
  managerName: z.string().nullish(),
  role: z.enum(["employee", "admin"]),
  password: z.string().min(6),
});

router.post("/admin/employees", async (req, res) => {
  try {
    const parsed = EmployeeCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const d = parsed.data;
    const email = d.email.toLowerCase();

    const existing = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.email, email))
      .limit(1);
    if (existing[0]) {
      res.status(409).json({ error: "An employee with that email already exists" });
      return;
    }

    const inserted = await db
      .insert(employeesTable)
      .values({
        name: d.name,
        email,
        department: d.department,
        position: d.position,
        joinDate: d.joinDate,
        gender: d.gender,
        avatarInitials: d.avatarInitials || initialsFrom(d.name),
        phone: d.phone ?? null,
        managerName: d.managerName ?? null,
        role: d.role,
        passwordHash: await bcrypt.hash(d.password, 10),
      })
      .returning();

    res.status(201).json(toPublicEmployee(inserted[0]));
  } catch (err) {
    req.log.error({ err }, "Failed to create employee");
    res.status(500).json({ error: "Internal server error" });
  }
});

const EmployeeUpdateSchema = z.object({
  name: z.string().min(1).nullish(),
  email: z.string().email().nullish(),
  department: z.string().min(1).nullish(),
  position: z.string().min(1).nullish(),
  gender: z.enum(["male", "female"]).nullish(),
  phone: z.string().nullish(),
  managerName: z.string().nullish(),
  role: z.enum(["employee", "admin"]).nullish(),
  password: z.string().min(6).nullish(),
});

router.patch("/admin/employees/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const parsed = EmployeeUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }
    const d = parsed.data;

    const patch: Record<string, unknown> = {};
    if (d.name != null) patch.name = d.name;
    if (d.email != null) {
      const email = d.email.toLowerCase();
      const existing = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.email, email))
        .limit(1);
      if (existing[0] && existing[0].id !== id) {
        res.status(409).json({ error: "An employee with that email already exists" });
        return;
      }
      patch.email = email;
    }
    if (d.department != null) patch.department = d.department;
    if (d.position != null) patch.position = d.position;
    if (d.gender != null) patch.gender = d.gender;
    if (d.phone !== undefined) patch.phone = d.phone;
    if (d.managerName !== undefined) patch.managerName = d.managerName;
    if (d.role != null) patch.role = d.role;
    if (d.password) patch.passwordHash = await bcrypt.hash(d.password, 10);

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const updated = await db
      .update(employeesTable)
      .set(patch)
      .where(eq(employeesTable.id, id))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    res.json(toPublicEmployee(updated[0]));
  } catch (err) {
    req.log.error({ err }, "Failed to update employee");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/employees/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    // Don't let an admin delete the account they're logged in with.
    if (req.user?.id === id) {
      res.status(400).json({ error: "You can't delete your own account" });
      return;
    }

    const existing = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, id))
      .limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    // No DB-level cascade, so remove the employee's dependent rows first to
    // avoid orphaning leaves/requests/attendance.
    await db.transaction(async (tx) => {
      await tx.delete(leavesTable).where(eq(leavesTable.employeeId, id));
      await tx.delete(requestsTable).where(eq(requestsTable.employeeId, id));
      await tx.delete(attendanceTable).where(eq(attendanceTable.employeeId, id));
      await tx.delete(employeesTable).where(eq(employeesTable.id, id));
    });

    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete employee");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ------------------------------------------------------ Attendance overview
router.get("/admin/attendance", async (req, res) => {
  try {
    const today = format(new Date(), "yyyy-MM-dd");
    const status = req.query.status as string | undefined;
    const q = (req.query.q as string | undefined)?.trim().toLowerCase();
    const sort = (req.query.sort as string | undefined) ?? "name";
    const { page, limit, offset } = parsePaging(req);

    const emps = await db.select().from(employeesTable).orderBy(employeesTable.id);
    const todays = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.date, today));
    const byEmp = new Map(todays.map((a) => [a.employeeId, a]));

    let rows = emps.map((e) => {
      const a = byEmp.get(e.id);
      return {
        employeeId: e.id,
        employeeName: e.name,
        department: e.department,
        date: a?.date ?? today,
        punchIn: a?.punchIn ?? null,
        punchOut: a?.punchOut ?? null,
        status: a?.status ?? "absent",
        hoursWorked: a?.hoursWorked ?? null,
      };
    });

    // Summary counts reflect the whole company, not the current filter/page.
    const presentToday = rows.filter((r) => r.status === "present" || r.status === "half_day").length;
    const totalEmployees = rows.length;

    if (status) rows = rows.filter((r) => r.status === status);
    if (q) rows = rows.filter((r) => [r.employeeName, r.department].some((v) => v?.toLowerCase().includes(q)));
    rows = rows.slice().sort((a, b) => {
      if (sort === "status") return a.status.localeCompare(b.status);
      if (sort === "punchIn") return (a.punchIn ?? "99:99").localeCompare(b.punchIn ?? "99:99");
      return (a.employeeName ?? "").localeCompare(b.employeeName ?? "");
    });

    const total = rows.length;
    res.json({ items: rows.slice(offset, offset + limit), total, page, limit, presentToday, totalEmployees });
  } catch (err) {
    req.log.error({ err }, "Failed to load attendance overview");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
