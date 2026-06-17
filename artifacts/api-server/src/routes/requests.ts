import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requestsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";

const RequestInputSchema = z.object({
  type: z.enum(["correction", "attendance"]),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  reason: z.string().min(5),
});

const router: IRouter = Router();

// All request routes are scoped to the logged-in employee.
router.use(requireAuth);

router.get("/requests", async (req, res) => {
  try {
    const employeeId = req.user!.id;
    const rows = await db
      .select()
      .from(requestsTable)
      .where(eq(requestsTable.employeeId, employeeId))
      .orderBy(desc(requestsTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list requests");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/requests", async (req, res) => {
  try {
    const employeeId = req.user!.id;
    const parsed = RequestInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const { type, date, reason } = parsed.data;
    const inserted = await db
      .insert(requestsTable)
      .values({ employeeId, type, date: date ?? null, reason, status: "pending" })
      .returning();

    res.status(201).json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to create request");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
