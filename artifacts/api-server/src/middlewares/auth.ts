import type { Request, Response, NextFunction } from "express";
import { db, employeesTable, type Employee } from "@workspace/db";
import { eq } from "drizzle-orm";

// Make `req.user` available (and typed) on every Express request once
// requireAuth has run.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: Employee;
    }
  }
}

export const SESSION_COOKIE = "sid";

// Reads the signed session cookie, looks up the employee it points to, and
// returns the row (or null if the cookie is missing/invalid/tampered).
async function loadUserFromCookie(req: Request): Promise<Employee | null> {
  const raw = req.signedCookies?.[SESSION_COOKIE];
  const id = raw ? Number(raw) : NaN;
  if (!id || Number.isNaN(id)) return null;

  const rows = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, id))
    .limit(1);

  return rows[0] ?? null;
}

// Gate for any logged-in user. On success, attaches the full employee row to
// req.user so downstream handlers act as that user.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await loadUserFromCookie(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    req.log.error({ err }, "Auth check failed");
    res.status(500).json({ error: "Internal server error" });
  }
}

// Gate for admins only. Must run AFTER requireAuth (which sets req.user).
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
