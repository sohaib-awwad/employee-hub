import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { attendanceTable, breaksTable } from "@workspace/db";
import { eq, and, asc, desc, isNull } from "drizzle-orm";
import { format } from "date-fns";
import { requireAuth } from "../middlewares/auth";
import type { Attendance, Break } from "@workspace/db";

function getToday(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function nowHHmm(): string {
  return format(new Date(), "HH:mm");
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesBetween(start: string, end: string): number {
  return Math.max(0, toMinutes(end) - toMinutes(start));
}

// Total break minutes for the day; an in-progress break counts up to `now`.
function totalBreakMinutes(breaks: Break[], now: string): number {
  return breaks.reduce((sum, b) => sum + minutesBetween(b.startTime, b.endTime ?? now), 0);
}

// The shape the attendance page consumes for "today": the record plus its
// breaks and a couple of derived conveniences.
async function buildTodayPayload(record: Attendance) {
  const breaks = await db
    .select()
    .from(breaksTable)
    .where(and(eq(breaksTable.employeeId, record.employeeId), eq(breaksTable.date, record.date)))
    .orderBy(asc(breaksTable.startTime));
  const now = nowHHmm();
  return {
    ...record,
    breaks: breaks.map((b) => ({ id: b.id, startTime: b.startTime, endTime: b.endTime })),
    onBreak: breaks.some((b) => b.endTime == null),
    breakMinutes: totalBreakMinutes(breaks, now),
  };
}

const router: IRouter = Router();

// Every attendance route is scoped to the logged-in employee.
router.use(requireAuth);

async function getOrCreateToday(employeeId: number): Promise<Attendance> {
  const today = getToday();
  const records = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.employeeId, employeeId), eq(attendanceTable.date, today)));
  if (records[0]) return records[0];
  const inserted = await db
    .insert(attendanceTable)
    .values({ employeeId, date: today, status: "absent" })
    .returning();
  return inserted[0];
}

router.get("/attendance/today", async (req, res) => {
  try {
    const record = await getOrCreateToday(req.user!.id);
    res.json(await buildTodayPayload(record));
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
    const now = nowHHmm();

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
    const now = nowHHmm();

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

    // Auto-close any in-progress break so it doesn't run past punch-out.
    await db
      .update(breaksTable)
      .set({ endTime: now })
      .where(and(eq(breaksTable.employeeId, employeeId), eq(breaksTable.date, today), isNull(breaksTable.endTime)));

    const breaks = await db
      .select()
      .from(breaksTable)
      .where(and(eq(breaksTable.employeeId, employeeId), eq(breaksTable.date, today)));

    // Net working time = gross time on the clock minus all break time.
    const gross = minutesBetween(existing[0].punchIn, now);
    const breakMins = totalBreakMinutes(breaks, now);
    const netMinutes = Math.max(0, gross - breakMins);
    const hours = Math.round((netMinutes / 60) * 10) / 10;

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

router.post("/attendance/break/start", async (req, res) => {
  try {
    const employeeId = req.user!.id;
    const today = getToday();
    const now = nowHHmm();

    const record = await getOrCreateToday(employeeId);
    if (!record.punchIn) {
      res.status(400).json({ error: "Punch in before starting a break." });
      return;
    }
    if (record.punchOut) {
      res.status(400).json({ error: "You've already punched out for today." });
      return;
    }

    const breaks = await db
      .select()
      .from(breaksTable)
      .where(and(eq(breaksTable.employeeId, employeeId), eq(breaksTable.date, today)));
    if (breaks.some((b) => b.endTime == null)) {
      res.status(400).json({ error: "You're already on a break." });
      return;
    }

    await db.insert(breaksTable).values({ employeeId, date: today, startTime: now });
    res.json(await buildTodayPayload(record));
  } catch (err) {
    req.log.error({ err }, "Failed to start break");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/attendance/break/end", async (req, res) => {
  try {
    const employeeId = req.user!.id;
    const today = getToday();
    const now = nowHHmm();

    const record = await getOrCreateToday(employeeId);
    const open = await db
      .select()
      .from(breaksTable)
      .where(and(eq(breaksTable.employeeId, employeeId), eq(breaksTable.date, today)))
      .orderBy(desc(breaksTable.startTime));
    const current = open.find((b) => b.endTime == null);

    if (!current) {
      res.status(400).json({ error: "You're not currently on a break." });
      return;
    }

    await db.update(breaksTable).set({ endTime: now }).where(eq(breaksTable.id, current.id));
    res.json(await buildTodayPayload(record));
  } catch (err) {
    req.log.error({ err }, "Failed to end break");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
