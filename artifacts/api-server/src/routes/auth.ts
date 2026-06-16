import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, SESSION_COOKIE } from "../middlewares/auth";
import { toPublicEmployee } from "../lib/employee";

const router: IRouter = Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// POST /api/auth/login — verify credentials and start a session.
router.post("/auth/login", async (req, res) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const rows = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.email, email))
      .limit(1);
    const user = rows[0];

    // Same response whether the email is unknown or the password is wrong,
    // so we don't leak which emails exist.
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Signed, httpOnly cookie holding the user id = our session.
    res.cookie(SESSION_COOKIE, String(user.id), {
      httpOnly: true,
      sameSite: "lax",
      signed: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: SEVEN_DAYS_MS,
    });

    res.json(toPublicEmployee(user));
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/logout — clear the session cookie.
router.post("/auth/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.status(204).end();
});

// GET /api/auth/me — the currently logged-in user (replaces "first row").
router.get("/auth/me", requireAuth, (req, res) => {
  res.json(toPublicEmployee(req.user!));
});

export default router;
