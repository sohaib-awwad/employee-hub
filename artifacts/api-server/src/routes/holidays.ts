import { Router } from "express";
import { db } from "@workspace/db";
import { holidaysTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/holidays", async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    const holidays = await db
      .select()
      .from(holidaysTable)
      .where(eq(holidaysTable.year, year))
      .orderBy(asc(holidaysTable.date));

    res.json(holidays);
  } catch (err) {
    req.log.error({ err }, "Failed to list holidays");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
