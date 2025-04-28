import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const bingoItems = pgTable("bingo_items", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  completed: boolean("completed").notNull().default(false),
  isCenterSpace: boolean("is_center_space").default(false),
  image: text("image"), // Image URL can be any length
  description: text("description"),
  cityId: text("city_id").notNull(),
  gridRow: integer("grid_row"), // 0-based row index (0-4)
  gridCol: integer("grid_col"), // 0-based column index (0-4)
});

// Simplified: Combined cities and bingoState tables
export const cities = pgTable("cities", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  styleGuide: jsonb("style_guide"),  // Store the style guide as a JSON object
  userId: integer("user_id"),
  isCurrentCity: boolean("is_current_city").default(false),
});

// Create insert schemas
export const insertBingoItemSchema = createInsertSchema(bingoItems);
export const insertCitySchema = createInsertSchema(cities);

// Define types
export type InsertBingoItem = z.infer<typeof insertBingoItemSchema>;
export type BingoItem = typeof bingoItems.$inferSelect;

export type InsertCity = z.infer<typeof insertCitySchema>;
export type City = typeof cities.$inferSelect;
