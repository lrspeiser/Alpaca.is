import { pgTable, text, serial, integer, boolean, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique(),
  password: text("password"),
  clientId: text("client_id").unique(), // For localStorage/cookie-based identification
  lastVisitedAt: text("last_visited_at"), // To track when users last visited
  currentCity: text("current_city"), // Track each user's currently selected city
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  clientId: true,
  lastVisitedAt: true,
  currentCity: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const bingoItems = pgTable("bingo_items", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  isCenterSpace: boolean("is_center_space").default(false),
  image: text("image"), // AI-generated image URL
  description: text("description"),
  cityId: text("city_id").notNull(),
  gridRow: integer("grid_row"), // 0-based row index (0-4)
  gridCol: integer("grid_col"), // 0-based column index (0-4)
});

// Simplified: City content definitions
export const cities = pgTable("cities", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  styleGuide: jsonb("style_guide"),  // Store the style guide as a JSON object
  userId: integer("user_id").references(() => users.id),
  isCurrentCity: boolean("is_current_city").default(false),
  isDefaultCity: boolean("is_default_city").default(false), // Is this the default city for new users
  // Metadata for admin dashboard
  itemCount: integer("item_count").default(0),
  itemsWithDescriptions: integer("items_with_descriptions").default(0),
  itemsWithImages: integer("items_with_images").default(0),
  itemsWithValidImageFiles: integer("items_with_valid_image_files").default(0),
  lastMetadataUpdate: text("last_metadata_update"),
});

// User-specific completions table to track which items each user has completed
export const userCompletions = pgTable("user_completions", {
  userId: integer("user_id").notNull().references(() => users.id),
  itemId: text("item_id").notNull().references(() => bingoItems.id),
  completed: boolean("completed").notNull().default(true),
  userPhoto: text("user_photo"), // User-captured photo (stored as data URL or file path)
  completedAt: text("completed_at"), // When the user completed this item
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.itemId] }),
  }
});

// Create insert schemas
export const insertBingoItemSchema = createInsertSchema(bingoItems);
export const insertCitySchema = createInsertSchema(cities);
export const insertUserCompletionSchema = createInsertSchema(userCompletions);

// Define types
export type InsertBingoItem = z.infer<typeof insertBingoItemSchema>;
export type BingoItem = typeof bingoItems.$inferSelect;

export type InsertCity = z.infer<typeof insertCitySchema>;
export type City = typeof cities.$inferSelect;

export type InsertUserCompletion = z.infer<typeof insertUserCompletionSchema>;
export type UserCompletion = typeof userCompletions.$inferSelect;
