import { Router } from "express";
import { db } from "@workspace/db";
import { announcementsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const PAGE_SIZE = 6;

const router = Router();

router.get("/announcements", async (req, res) => {
  try {
    const type = req.query.type as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : PAGE_SIZE;
    const offset = (page - 1) * limit;

    let all = await db
      .select()
      .from(announcementsTable)
      .orderBy(desc(announcementsTable.publishedAt));

    if (type && (type === "announcement" || type === "event")) {
      all = all.filter(a => a.type === type);
    }

    const total = all.length;
    const items = all.slice(offset, offset + limit);

    res.json({ items, total, page, limit });
  } catch (err) {
    req.log.error({ err }, "Failed to list announcements");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
