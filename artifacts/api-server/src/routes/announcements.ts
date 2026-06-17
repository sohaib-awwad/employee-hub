import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { announcementsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const PAGE_SIZE = 6;

const router: IRouter = Router();

router.get("/announcements", requireAuth, async (req, res) => {
  try {
    const type = req.query.type as string | undefined;
    const priority = req.query.priority as string | undefined;
    const q = (req.query.q as string | undefined)?.trim().toLowerCase();
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : PAGE_SIZE;
    const offset = (page - 1) * limit;

    let all = await db
      .select()
      .from(announcementsTable)
      .orderBy(desc(announcementsTable.publishedAt));

    // Priority + search are applied first so the tab counts reflect them.
    if (priority && (priority === "low" || priority === "medium" || priority === "high")) {
      all = all.filter(a => a.priority === priority);
    }
    if (q) {
      all = all.filter(
        a => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q),
      );
    }

    const announcementCount = all.filter(a => a.type === "announcement").length;
    const eventCount = all.filter(a => a.type === "event").length;

    // Type tab is applied after counting so each tab shows its own total.
    const filtered =
      type === "announcement" || type === "event"
        ? all.filter(a => a.type === type)
        : all;

    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);

    res.json({ items, total, page, limit, announcementCount, eventCount });
  } catch (err) {
    req.log.error({ err }, "Failed to list announcements");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
