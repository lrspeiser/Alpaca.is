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
});

export const cities = pgTable("cities", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  backgroundImage: text("background_image").notNull(),
  userId: integer("user_id"),
});

export const cityTips = pgTable("city_tips", {
  id: serial("id").primaryKey(),
  cityId: text("city_id").notNull(),
  title: text("title").notNull(),
  text: text("text").notNull(),
});

export const bingoState = pgTable("bingo_state", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  currentCity: text("current_city").notNull(),
  data: jsonb("data").notNull(),
});

export const insertBingoItemSchema = createInsertSchema(bingoItems);
export const insertCitySchema = createInsertSchema(cities);
export const insertCityTipSchema = createInsertSchema(cityTips);
export const insertBingoStateSchema = createInsertSchema(bingoState).pick({
  userId: true,
  currentCity: true,
  data: true,
});

export type InsertBingoItem = z.infer<typeof insertBingoItemSchema>;
export type BingoItem = typeof bingoItems.$inferSelect;

export type InsertCity = z.infer<typeof insertCitySchema>;
export type City = typeof cities.$inferSelect;

export type InsertCityTip = z.infer<typeof insertCityTipSchema>;
export type CityTip = typeof cityTips.$inferSelect;

export type InsertBingoState = z.infer<typeof insertBingoStateSchema>;
export type BingoState = typeof bingoState.$inferSelect;
