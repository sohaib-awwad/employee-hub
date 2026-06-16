import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  department: text("department").notNull(),
  position: text("position").notNull(),
  joinDate: text("join_date").notNull(),
  avatarInitials: text("avatar_initials").notNull(),
  phone: text("phone"),
  managerId: integer("manager_id"),
  managerName: text("manager_name"),
  // Auth: "employee" (default) or "admin" — drives route guards and the
  // role-based landing page on the frontend.
  role: text("role").notNull().default("employee"),
  // Auth: bcrypt hash of the user's password. Never returned by the API.
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
