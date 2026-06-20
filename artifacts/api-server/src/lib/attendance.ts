import { db, attendanceTable, breaksTable, type Attendance, type Break } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { format } from "date-fns";

// Hard cap: nobody may stay clocked in for more than 12 hours. If an employee
// forgets to punch out, the shift is auto-closed at punchIn + 12h so the timer
// can't run forever and the records stay honest.
export const MAX_WORK_MINUTES = 12 * 60;

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesBetween(start: string, end: string): number {
  return Math.max(0, toMinutes(end) - toMinutes(start));
}

// Total break minutes for the day; an in-progress break counts up to `now`.
export function totalBreakMinutes(breaks: Break[], now: string): number {
  return breaks.reduce((sum, b) => sum + minutesBetween(b.startTime, b.endTime ?? now), 0);
}

// The wall-clock moment (ms) a shift began, from its date + HH:mm punch-in.
function punchInMoment(date: string, punchIn: string): number {
  return new Date(`${date}T${punchIn}:00`).getTime();
}

/**
 * If `record` is an open shift (punched in, not out) that has been running for
 * 12 hours or more, auto punch it out at punchIn + 12h: close any in-progress
 * break, set net hoursWorked (gross minus breaks), tag a note, and persist.
 * Returns the updated record; if nothing was due it returns `record` unchanged.
 */
export async function autoCloseIfExpired(record: Attendance): Promise<Attendance> {
  if (!record.punchIn || record.punchOut) return record;

  const capMs = punchInMoment(record.date, record.punchIn) + MAX_WORK_MINUTES * 60_000;
  if (Date.now() < capMs) return record;

  const capTime = format(new Date(capMs), "HH:mm");

  // Close any still-running break at the cap so it doesn't outlast the shift.
  await db
    .update(breaksTable)
    .set({ endTime: capTime })
    .where(
      and(
        eq(breaksTable.employeeId, record.employeeId),
        eq(breaksTable.date, record.date),
        isNull(breaksTable.endTime),
      ),
    );

  const breaks = await db
    .select()
    .from(breaksTable)
    .where(and(eq(breaksTable.employeeId, record.employeeId), eq(breaksTable.date, record.date)));

  const netMinutes = Math.max(0, MAX_WORK_MINUTES - totalBreakMinutes(breaks, capTime));
  const hours = Math.round((netMinutes / 60) * 10) / 10;
  const note = record.note?.trim()
    ? record.note
    : "Auto punch-out: reached the 12-hour daily limit.";

  const updated = await db
    .update(attendanceTable)
    .set({ punchOut: capTime, hoursWorked: hours, status: "present", note })
    .where(eq(attendanceTable.id, record.id))
    .returning();

  return updated[0] ?? record;
}

/**
 * Scan every open shift and auto-close any that have passed the 12h cap. Run on
 * startup and on an interval so forgotten punch-ins get closed even when nobody
 * has the app open. Returns how many shifts were closed.
 */
export async function sweepExpiredPunches(): Promise<number> {
  const open = await db.select().from(attendanceTable).where(isNull(attendanceTable.punchOut));
  let closed = 0;
  for (const record of open) {
    if (!record.punchIn) continue;
    const after = await autoCloseIfExpired(record);
    if (after.punchOut) closed++;
  }
  return closed;
}
