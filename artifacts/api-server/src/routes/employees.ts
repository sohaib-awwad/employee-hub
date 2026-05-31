import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/employees/me", async (req, res) => {
  try {
    const employee = await db
      .select()
      .from(employeesTable)
      .limit(1);

    if (!employee[0]) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    res.json(employee[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to get employee profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
