import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { toPublicEmployee } from "../lib/employee";

const router: IRouter = Router();

// Returns the logged-in employee (previously returned the first row in the
// table — now it is the authenticated user provided by requireAuth).
router.get("/employees/me", requireAuth, (req, res) => {
  res.json(toPublicEmployee(req.user!));
});

export default router;
