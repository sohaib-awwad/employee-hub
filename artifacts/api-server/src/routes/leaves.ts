import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { leavesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { differenceInBusinessDays, parseISO, addDays } from "date-fns";
import { requireAuth } from "../middlewares/auth";
import { allowancesFor, isLeaveTypeAllowed } from "../lib/leave";

const LeaveInputSchema = z.object({
  type: z.enum(["annual", "sick", "casual", "maternity", "paternity", "unpaid", "other"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(5),
});

function calcBusinessDays(start: string, end: string): number {
  const s = parseISO(start);
  const e = parseISO(end);
  return differenceInBusinessDays(addDays(e, 1), s);
}

const router: IRouter = Router();

// Every leave route is scoped to the logged-in employee.
router.use(requireAuth);

router.get("/leaves", async (req, res) => {
  try {
    const employeeId = req.user!.id;
    const leaves = await db
      .select()
      .from(leavesTable)
      .where(eq(leavesTable.employeeId, employeeId))
      .orderBy(desc(leavesTable.createdAt));
    res.json(leaves);
  } catch (err) {
    req.log.error({ err }, "Failed to list leaves");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/leaves", async (req, res) => {
  try {
    const employeeId = req.user!.id;
    const parsed = LeaveInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { type, startDate, endDate, reason } = parsed.data;

    // Guard gender-specific leave: a male can't request maternity, etc.
    if (!isLeaveTypeAllowed(type, req.user!.gender)) {
      res.status(400).json({ error: `${type} leave is not available for your account` });
      return;
    }

    const days = calcBusinessDays(startDate, endDate);

    if (days <= 0) {
      res.status(400).json({ error: "End date must be after start date" });
      return;
    }

    const inserted = await db
      .insert(leavesTable)
      .values({
        employeeId,
        type,
        startDate,
        endDate,
        days,
        reason,
        status: "pending",
      })
      .returning();

    res.status(201).json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to create leave");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/leaves/balance", async (req, res) => {
  try {
    const employeeId = req.user!.id;
    const leaves = await db
      .select()
      .from(leavesTable)
      .where(
        and(
          eq(leavesTable.employeeId, employeeId),
          eq(leavesTable.status, "approved")
        )
      );

    const allowances = allowancesFor(req.user!.gender);

    const usedByType: Record<string, number> = {};
    for (const leave of leaves) {
      usedByType[leave.type] = (usedByType[leave.type] || 0) + leave.days;
    }

    const details = Object.entries(allowances).map(([type, total]) => ({
      type,
      total,
      used: usedByType[type] || 0,
      remaining: total - (usedByType[type] || 0),
    }));

    const annual = allowances.annual - (usedByType.annual || 0);
    const sick = allowances.sick - (usedByType.sick || 0);
    const casual = allowances.casual - (usedByType.casual || 0);
    const used = Object.values(usedByType).reduce((a, b) => a + b, 0);
    const remaining = Object.values(allowances).reduce((a, b) => a + b, 0) - used;

    res.json({ annual, sick, casual, used, remaining, details });
  } catch (err) {
    req.log.error({ err }, "Failed to get leave balance");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/leaves/:id", async (req, res) => {
  try {
    const employeeId = req.user!.id;
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const leave = await db
      .select()
      .from(leavesTable)
      .where(and(eq(leavesTable.id, id), eq(leavesTable.employeeId, employeeId)));

    if (!leave[0]) {
      res.status(404).json({ error: "Leave not found" });
      return;
    }

    if (leave[0].status !== "pending") {
      res.status(400).json({ error: "Only pending leaves can be cancelled" });
      return;
    }

    const updated = await db
      .update(leavesTable)
      .set({ status: "cancelled" })
      .where(eq(leavesTable.id, id))
      .returning();

    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to cancel leave");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
