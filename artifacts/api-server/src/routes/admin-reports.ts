import { Router, type IRouter } from "express";
import { db, employeesTable, attendanceTable, leavesTable, holidaysTable } from "@workspace/db";
import { eq, and, gte, lte, inArray, asc } from "drizzle-orm";
import {
  format,
  parseISO,
  eachDayOfInterval,
  getDay,
  differenceInBusinessDays,
  addDays,
} from "date-fns";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { allowancesFor } from "../lib/leave";

const router: IRouter = Router();

// The whole file is admin-only.
router.use(requireAuth, requireAdmin);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function today(): string {
  return format(new Date(), "yyyy-MM-dd");
}

// Business days (Mon–Fri) in an inclusive ISO date range — matches the leave
// math in routes/leaves.ts so the report and the balances agree.
function businessDaysInclusive(start: string, end: string): number {
  if (end < start) return 0;
  return differenceInBusinessDays(addDays(parseISO(end), 1), parseISO(start));
}

// Lexical min/max are valid for yyyy-mm-dd strings.
const maxDate = (a: string, b: string) => (a > b ? a : b);
const minDate = (a: string, b: string) => (a < b ? a : b);

/**
 * GET /admin/attendance-report?employeeId=N&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Builds a per-employee attendance report for an arbitrary period: working
 * days, days worked, holidays (and whether each was recorded in attendance),
 * and leave-balance consumption. The frontend renders this JSON to a PDF.
 *
 * `employeeId` is a query param (not a path param) so the generated zod lib
 * doesn't collide a path-param schema with the query-param type of the same
 * operation — see lib/api-zod naming.
 */
router.get("/admin/attendance-report", async (req, res) => {
  try {
    const id = parseInt(String(req.query.employeeId ?? ""), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid employee id" });
      return;
    }

    const employee = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, id))
      .limit(1)
      .then((r) => r[0]);
    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
      res.status(400).json({ error: "from and to must be YYYY-MM-DD dates" });
      return;
    }
    if (from > to) {
      res.status(400).json({ error: "The start date must be on or before the end date." });
      return;
    }
    if (from < employee.joinDate) {
      res.status(400).json({ error: `The start date can't be before the employee joined (${employee.joinDate}).` });
      return;
    }
    if (to > today()) {
      res.status(400).json({ error: "The end date can't be in the future." });
      return;
    }

    // ---- Load the raw data for the period ---------------------------------
    const attendance = await db
      .select()
      .from(attendanceTable)
      .where(
        and(
          eq(attendanceTable.employeeId, id),
          gte(attendanceTable.date, from),
          lte(attendanceTable.date, to),
        ),
      )
      .orderBy(asc(attendanceTable.date));

    const approvedLeaves = await db
      .select()
      .from(leavesTable)
      .where(and(eq(leavesTable.employeeId, id), eq(leavesTable.status, "approved")));

    const fromYear = parseInt(from.slice(0, 4), 10);
    const toYear = parseInt(to.slice(0, 4), 10);
    const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i);
    const holidayRows = await db
      .select()
      .from(holidaysTable)
      .where(inArray(holidaysTable.year, years));
    const holidaysInRange = holidayRows
      .filter((h) => h.date >= from && h.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date));

    // ---- Index by date for O(1) day lookups -------------------------------
    const attByDate = new Map(attendance.map((a) => [a.date, a]));
    const holidayByDate = new Map(holidaysInRange.map((h) => [h.date, h]));
    // Every date covered by an approved leave (inclusive).
    const leaveDates = new Set<string>();
    for (const lv of approvedLeaves) {
      const s = maxDate(lv.startDate, from);
      const e = minDate(lv.endDate, to);
      if (s > e) continue;
      for (const d of eachDayOfInterval({ start: parseISO(s), end: parseISO(e) })) {
        leaveDates.add(format(d, "yyyy-MM-dd"));
      }
    }

    // ---- Walk every calendar day in the range -----------------------------
    type DayRow = {
      date: string;
      weekday: string;
      status: string;
      punchIn: string | null;
      punchOut: string | null;
      hoursWorked: number | null;
      holidayName: string | null;
      note: string | null;
    };
    const days: DayRow[] = [];

    let workingDays = 0;
    let weekendDays = 0;
    let daysWorked = 0;
    let halfDays = 0;
    let onLeaveDays = 0;
    let absentDays = 0;
    let totalHoursWorked = 0;

    for (const d of eachDayOfInterval({ start: parseISO(from), end: parseISO(to) })) {
      const date = format(d, "yyyy-MM-dd");
      const dow = getDay(d); // 0 = Sun … 6 = Sat
      const isWeekend = dow === 0 || dow === 6;
      const holiday = holidayByDate.get(date);
      const att = attByDate.get(date);
      const isWorkingDay = !isWeekend && !holiday;

      totalHoursWorked += att?.hoursWorked ?? 0;

      // A display status for the day-by-day sheet (prefer the recorded status,
      // otherwise infer from the calendar).
      let status: string;
      if (att?.status && att.status !== "absent") status = att.status;
      else if (holiday) status = "holiday";
      else if (isWeekend) status = "weekend";
      else if (leaveDates.has(date)) status = "on_leave";
      else status = att?.status ?? "absent";

      if (isWeekend) weekendDays++;

      if (isWorkingDay) {
        workingDays++;
        const worked = att?.status === "present" || att?.status === "half_day";
        if (worked) {
          daysWorked++;
          if (att?.status === "half_day") halfDays++;
        } else if (att?.status === "on_leave" || leaveDates.has(date)) {
          onLeaveDays++;
        } else {
          absentDays++;
        }
      }

      days.push({
        date,
        weekday: format(d, "EEE"),
        status,
        punchIn: att?.punchIn ?? null,
        punchOut: att?.punchOut ?? null,
        hoursWorked: att?.hoursWorked ?? null,
        holidayName: holiday?.name ?? null,
        note: att?.note ?? null,
      });
    }

    // ---- Holidays: recorded (an attendance row marks it) vs not -----------
    const holidays = holidaysInRange.map((h) => ({
      date: h.date,
      name: h.name,
      type: h.type,
      recorded: attByDate.get(h.date)?.status === "holiday",
    }));
    const holidaysRecorded = holidays.filter((h) => h.recorded).length;

    // ---- Leave: standing balance + what was consumed in this period -------
    const allowances = allowancesFor(employee.gender);
    const usedByTypeAll: Record<string, number> = {};
    for (const lv of approvedLeaves) {
      usedByTypeAll[lv.type] = (usedByTypeAll[lv.type] ?? 0) + lv.days;
    }
    const balance = Object.entries(allowances).map(([type, total]) => ({
      type,
      total,
      used: usedByTypeAll[type] ?? 0,
      remaining: total - (usedByTypeAll[type] ?? 0),
    }));

    // Approved leaves that overlap the report window.
    const overlapping = approvedLeaves
      .filter((lv) => lv.startDate <= to && lv.endDate >= from)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const takenByType: Record<string, number> = {};
    for (const lv of overlapping) {
      const s = maxDate(lv.startDate, from);
      const e = minDate(lv.endDate, to);
      takenByType[lv.type] = (takenByType[lv.type] ?? 0) + businessDaysInclusive(s, e);
    }
    const takenInPeriod = Object.entries(takenByType).map(([type, days]) => ({ type, days }));
    const entries = overlapping.map((lv) => ({
      type: lv.type,
      startDate: lv.startDate,
      endDate: lv.endDate,
      days: lv.days,
      status: lv.status,
    }));

    const attendanceRate = workingDays > 0 ? Math.round((daysWorked / workingDays) * 100) : 0;

    res.json({
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        position: employee.position,
        gender: employee.gender,
        joinDate: employee.joinDate,
      },
      period: { from, to },
      generatedAt: new Date().toISOString(),
      generatedBy: req.user!.name,
      summary: {
        calendarDays: days.length,
        workingDays,
        weekendDays,
        daysWorked,
        halfDays,
        absentDays,
        onLeaveDays,
        holidays: holidays.length,
        holidaysRecorded,
        holidaysNotRecorded: holidays.length - holidaysRecorded,
        totalHoursWorked: Math.round(totalHoursWorked * 10) / 10,
        attendanceRate,
      },
      days,
      holidays,
      leave: { balance, takenInPeriod, entries },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to build attendance report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
