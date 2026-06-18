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
import { eq, desc } from "drizzle-orm";
import { format } from "date-fns";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { toPublicEmployee } from "../lib/employee";

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

// ---------------------------------------------------------------- Overview
router.get("/admin/overview", async (req, res) => {
  try {
    const [leaves, requests, employees, announcements] = await Promise.all([
      db.select().from(leavesTable),
      db.select().from(requestsTable),
      db.select().from(employeesTable),
      db.select().from(announcementsTable),
    ]);
    res.json({
      pendingLeaves: leaves.filter((l) => l.status === "pending").length,
      pendingRequests: requests.filter((r) => r.status === "pending").length,
      totalEmployees: employees.length,
      totalAnnouncements: announcements.length,
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
    const names = await employeeNameMap();
    let rows = await db.select().from(leavesTable).orderBy(desc(leavesTable.createdAt));
    if (status) rows = rows.filter((r) => r.status === status);
    res.json(rows.map((r) => ({ ...r, employeeName: names.get(r.employeeId) ?? null })));
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
    const names = await employeeNameMap();
    let rows = await db.select().from(requestsTable).orderBy(desc(requestsTable.createdAt));
    if (status) rows = rows.filter((r) => r.status === status);
    res.json(rows.map((r) => ({ ...r, employeeName: names.get(r.employeeId) ?? null })));
  } catch (err) {
    req.log.error({ err }, "Failed to list requests (admin)");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/requests/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const updated = await db
      .update(requestsTable)
      .set({ status: "approved" })
      .where(eq(requestsTable.id, id))
      .returning();
    if (!updated[0]) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
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
    const rows = await db.select().from(employeesTable).orderBy(employeesTable.id);
    res.json(rows.map(toPublicEmployee));
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
  department: z.string().min(1).nullish(),
  position: z.string().min(1).nullish(),
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
    if (d.department != null) patch.department = d.department;
    if (d.position != null) patch.position = d.position;
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

// ------------------------------------------------------ Attendance overview
router.get("/admin/attendance", async (req, res) => {
  try {
    const today = format(new Date(), "yyyy-MM-dd");
    const emps = await db.select().from(employeesTable).orderBy(employeesTable.id);
    const todays = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.date, today));
    const byEmp = new Map(todays.map((a) => [a.employeeId, a]));

    res.json(
      emps.map((e) => {
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
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to load attendance overview");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
