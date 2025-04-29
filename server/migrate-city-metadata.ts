import { db } from "./db";
import { sql } from "drizzle-orm";
import { log } from "./vite";

/**
 * A migration script to add the new metadata columns to the cities table
 * This should be run once to update the database schema
 */
export async function migrateCityMetadata() {
  try {
    log("[MIGRATION] Starting city metadata migration...", "migration");
    
    // Check if the item_count column already exists
    try {
      await db.execute(sql`SELECT item_count FROM cities LIMIT 1`);
      log("[MIGRATION] Metadata columns already exist, skipping migration", "migration");
      return true;
    } catch (error) {
      // Column doesn't exist, we need to add it
      log("[MIGRATION] Metadata columns don't exist, adding them now", "migration");
      
      // Add the new columns to the cities table
      await db.execute(sql`
        ALTER TABLE cities 
        ADD COLUMN IF NOT EXISTS item_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS items_with_descriptions INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS items_with_images INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS items_with_valid_image_files INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_metadata_update TEXT
      `);
      
      log("[MIGRATION] Added metadata columns to cities table", "migration");
      return true;
    }
  } catch (error) {
    log(`[MIGRATION] Error during city metadata migration: ${error instanceof Error ? error.message : String(error)}`, "error");
    return false;
  }
}

// Automatically execute migration when imported directly
// For ES modules, we can't easily check if file is being run directly
// We'll rely on the index.ts file to call the migration function
