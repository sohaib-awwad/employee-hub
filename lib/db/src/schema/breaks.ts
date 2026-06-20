import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per break the employee takes during a day. A break is "open" (in
// progress) while endTime is null. Breaks don't count towards working hours —
// total break time is subtracted at punch-out.
export const breaksTable = pgTable("breaks", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  date: text("date").notNull(), // yyyy-mm-dd
  startTime: text("start_time").notNull(), // HH:mm
  endTime: text("end_time"), // HH:mm, null while the break is in progress
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBreakSchema = createInsertSchema(breaksTable).omit({ id: true, createdAt: true });
export type InsertBreak = z.infer<typeof insertBreakSchema>;
export type Break = typeof breaksTable.$inferSelect;
