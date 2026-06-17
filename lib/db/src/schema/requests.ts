import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Employee-initiated requests that an admin resolves:
//  - "correction": fix an attendance record for a given date
//  - "attendance": a general attendance-related request
export const requestsTable = pgTable("requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  type: text("type").notNull(),
  date: text("date"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRequestSchema = createInsertSchema(requestsTable).omit({ id: true, createdAt: true });
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type EmployeeRequest = typeof requestsTable.$inferSelect;
