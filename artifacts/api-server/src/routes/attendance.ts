import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { attendanceTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { format } from "date-fns";
import { requireAuth } from "../middlewares/auth";

function getToday(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function calcHours(punchIn: string, punchOut: string): number {
  const [inH, inM] = punchIn.split(":").map(Number);
  const [outH, outM] = punchOut.split(":").map(Number);
  return Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 10) / 10;
}

const router: IRouter = Router();

// Every attendance route is scoped to the logged-in employee.
router.use(requireAuth);

router.get("/attendance/today", async (req, res) => {
  try {
    const employeeId = req.user!.id;
    const today = getToday();
    const records = await db
      .select()
      .from(attendanceTable)
      .where(and(eq(attendanceTable.employeeId, employeeId), eq(attendanceTable.date, today)));

    if (records[0]) {
      res.json(records[0]);
      return;
    }

    // Create absent record for today
    const inserted = await db
      .insert(attendanceTable)
      .values({ employeeId, date: today, status: "absent" })
      .returning();
    res.json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to get today attendance");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/attendance", async (req, res) => {
  try {
    const employeeId = req.user!.id;
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    let records = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.employeeId, employeeId))
      .orderBy(desc(attendanceTable.date));

    if (month && year) {
      const prefix = `${year}-${String(month).padStart(2, "0")}`;
      records = records.filter(r => r.date.startsWith(prefix));
    } else if (year) {
      records = records.filter(r => r.date.startsWith(String(year)));
    }

    res.json(records);
  } catch (err) {
    req.log.error({ err }, "Failed to list attendance");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/attendance/punch-in", async (req, res) => {
  try {
    const employeeId = req.user!.id;
    const today = getToday();
    const now = format(new Date(), "HH:mm");

    const existing = await db
      .select()
      .from(attendanceTable)
      .where(and(eq(attendanceTable.employeeId, employeeId), eq(attendanceTable.date, today)));

    if (existing[0] && existing[0].punchIn) {
      res.status(400).json({ error: "Already punched in today" });
      return;
    }

    let record;
    if (existing[0]) {
      const updated = await db
        .update(attendanceTable)
        .set({ punchIn: now, status: "present" })
        .where(eq(attendanceTable.id, existing[0].id))
        .returning();
      record = updated[0];
    } else {
      const inserted = await db
        .insert(attendanceTable)
        .values({ employeeId, date: today, punchIn: now, status: "present" })
        .returning();
      record = inserted[0];
    }

    res.json(record);
  } catch (err) {
    req.log.error({ err }, "Failed to punch in");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/attendance/punch-out", async (req, res) => {
  try {
    const employeeId = req.user!.id;
    const today = getToday();
    const now = format(new Date(), "HH:mm");

    const existing = await db
      .select()
      .from(attendanceTable)
      .where(and(eq(attendanceTable.employeeId, employeeId), eq(attendanceTable.date, today)));

    if (!existing[0] || !existing[0].punchIn) {
      res.status(400).json({ error: "Must punch in first" });
      return;
    }

    if (existing[0].punchOut) {
      res.status(400).json({ error: "Already punched out today" });
      return;
    }

    const hours = calcHours(existing[0].punchIn, now);
    const updated = await db
      .update(attendanceTable)
      .set({ punchOut: now, hoursWorked: hours })
      .where(eq(attendanceTable.id, existing[0].id))
      .returning();

    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to punch out");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
