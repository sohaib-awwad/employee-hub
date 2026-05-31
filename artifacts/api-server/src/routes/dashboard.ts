import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable, attendanceTable, leavesTable, holidaysTable } from "@workspace/db";
import { eq, and, gte, asc, desc } from "drizzle-orm";
import { format, startOfMonth, endOfMonth, parseISO, isAfter } from "date-fns";

const EMPLOYEE_ID = 1;

const LEAVE_ALLOWANCES: Record<string, number> = {
  annual: 21, sick: 10, casual: 7,
  maternity: 90, paternity: 14, unpaid: 30, other: 5,
};

function getToday(): string {
  return format(new Date(), "yyyy-MM-dd");
}

const router = Router();

router.get("/dashboard", async (req, res) => {
  try {
    const today = getToday();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

    // Employee
    const employees = await db.select().from(employeesTable).limit(1);
    const employee = employees[0];
    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    // Today's attendance
    let todayAttendance = await db
      .select()
      .from(attendanceTable)
      .where(and(eq(attendanceTable.employeeId, EMPLOYEE_ID), eq(attendanceTable.date, today)))
      .then(r => r[0]);

    if (!todayAttendance) {
      const inserted = await db
        .insert(attendanceTable)
        .values({ employeeId: EMPLOYEE_ID, date: today, status: "absent" })
        .returning();
      todayAttendance = inserted[0];
    }

    // Leave balance
    const approvedLeaves = await db
      .select()
      .from(leavesTable)
      .where(and(eq(leavesTable.employeeId, EMPLOYEE_ID), eq(leavesTable.status, "approved")));

    const usedByType: Record<string, number> = {};
    for (const leave of approvedLeaves) {
      usedByType[leave.type] = (usedByType[leave.type] || 0) + leave.days;
    }

    const details = Object.entries(LEAVE_ALLOWANCES).map(([type, total]) => ({
      type, total,
      used: usedByType[type] || 0,
      remaining: total - (usedByType[type] || 0),
    }));

    const used = Object.values(usedByType).reduce((a, b) => a + b, 0);
    const remaining = Object.values(LEAVE_ALLOWANCES).reduce((a, b) => a + b, 0) - used;
    const leaveBalance = {
      annual: LEAVE_ALLOWANCES.annual - (usedByType.annual || 0),
      sick: LEAVE_ALLOWANCES.sick - (usedByType.sick || 0),
      casual: LEAVE_ALLOWANCES.casual - (usedByType.casual || 0),
      used, remaining, details,
    };

    // Upcoming holidays
    const allHolidays = await db
      .select()
      .from(holidaysTable)
      .where(eq(holidaysTable.year, year))
      .orderBy(asc(holidaysTable.date));

    const upcomingHolidays = allHolidays
      .filter(h => h.date >= today)
      .slice(0, 5);

    // Recent attendance (last 10 days)
    const recentAttendance = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.employeeId, EMPLOYEE_ID))
      .orderBy(desc(attendanceTable.date))
      .limit(10);

    // Monthly stats
    const monthAttendance = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.employeeId, EMPLOYEE_ID))
      .then(r => r.filter(a => a.date.startsWith(monthPrefix)));

    const presentDays = monthAttendance.filter(a => a.status === "present" || a.status === "half_day").length;
    const absentDays = monthAttendance.filter(a => a.status === "absent").length;
    const leaveDays = monthAttendance.filter(a => a.status === "on_leave").length;
    const totalWorkingDays = monthAttendance.filter(a => a.status !== "weekend" && a.status !== "holiday").length || 1;
    const attendanceRate = Math.round((presentDays / totalWorkingDays) * 100);

    res.json({
      employee,
      todayAttendance,
      leaveBalance,
      upcomingHolidays,
      recentAttendance,
      monthlyStats: { presentDays, absentDays, leaveDays, totalWorkingDays, attendanceRate },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
