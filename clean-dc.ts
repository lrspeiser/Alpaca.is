import { db } from "./server/db";
import { cities, bingoItems, userCompletions } from "./shared/schema";
import { eq, and, sql } from "drizzle-orm";
import * as fs from 'fs';
import * as path from 'path';
import { log } from "./server/vite";

/**
 * This script deletes all Washington DC related data from the database
 * and removes corresponding image files from the disk.
 */
async function cleanupWashingtonDC() {
  const cityId = 'washingtondc';
  
  try {
    console.log(`Starting cleanup of Washington DC (${cityId}) data...`);
    
    // 1. First get all items for this city to identify files to delete
    const cityItems = await db.select().from(bingoItems)
      .where(eq(bingoItems.cityId, cityId));
    
    console.log(`Found ${cityItems.length} bingo items for Washington DC`);
    
    // 2. Delete user completions for this city's items
    const itemIds = cityItems.map(item => item.id);
    
    if (itemIds.length > 0) {
      const deleteCompletions = await db.delete(userCompletions)
        .where(sql`${userCompletions.itemId} IN (${itemIds.join(',')})`);
      
      console.log(`Deleted user completions for Washington DC items`);
    }
    
    // 3. Delete all bingo items for this city
    const deleteItems = await db.delete(bingoItems)
      .where(eq(bingoItems.cityId, cityId));
    
    console.log(`Deleted all bingo items for Washington DC`);
    
    // 4. Delete the city itself
    const deleteCity = await db.delete(cities)
      .where(eq(cities.id, cityId));
    
    console.log(`Deleted Washington DC city record from database`);
    
    // 5. Delete image files related to Washington DC
    const imagesDir = path.join(process.cwd(), 'public', 'images');
    let deletedFiles = 0;
    
    try {
      const files = fs.readdirSync(imagesDir);
      for (const file of files) {
        if (file.includes(`${cityId}bingo-`) || file.includes(`-${cityId}-`)) {
          fs.unlinkSync(path.join(imagesDir, file));
          deletedFiles++;
        }
      }
      console.log(`Deleted ${deletedFiles} image files related to Washington DC`);
    } catch (fsError) {
      console.error(`Error deleting image files: ${fsError}`);
    }
    
    console.log(`Successfully completed Washington DC cleanup`);
    process.exit(0);
  } catch (error) {
    console.error(`Error during cleanup: ${error}`);
    process.exit(1);
  }
}

// Run the cleanup function
cleanupWashingtonDC();