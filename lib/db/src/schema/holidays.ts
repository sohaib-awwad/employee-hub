import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const holidaysTable = pgTable("holidays", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: text("date").notNull(),
  type: text("type").notNull().default("public"),
  description: text("description"),
  dayOfWeek: text("day_of_week"),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHolidaySchema = createInsertSchema(holidaysTable).omit({ id: true, createdAt: true });
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
export type Holiday = typeof holidaysTable.$inferSelect;
