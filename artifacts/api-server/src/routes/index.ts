import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import employeesRouter from "./employees";
import attendanceRouter from "./attendance";
import leavesRouter from "./leaves";
import holidaysRouter from "./holidays";
import dashboardRouter from "./dashboard";
import announcementsRouter from "./announcements";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(employeesRouter);
router.use(attendanceRouter);
router.use(leavesRouter);
router.use(holidaysRouter);
router.use(dashboardRouter);
router.use(announcementsRouter);

export default router;
