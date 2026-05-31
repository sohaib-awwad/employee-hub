import { pgTable, serial, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leavesTable = pgTable("leaves", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  type: text("type").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  days: real("days").notNull(),
  status: text("status").notNull().default("pending"),
  reason: text("reason").notNull(),
  approvedBy: text("approved_by"),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLeaveSchema = createInsertSchema(leavesTable).omit({ id: true, createdAt: true });
export type InsertLeave = z.infer<typeof insertLeaveSchema>;
export type Leave = typeof leavesTable.$inferSelect;
