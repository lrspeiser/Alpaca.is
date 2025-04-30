import { db } from "./db";
import { cities, bingoItems } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import * as fs from 'fs/promises';
import * as path from 'path';
import { getImageDir } from "./imageStorage";
import { log } from "./vite";

/**
 * Function to update city metadata with accurate counts of:
 * - Total bingo items
 * - Items with descriptions
 * - Items with images in the database
 * - Items with valid image files on disk
 * 
 * This function should be called:
 * 1. On server startup
 * 2. After any operation that changes item counts (create city, generate descriptions, generate images)
 */
export async function updateCityMetadata(cityId?: string) {
  try {
    log(`[METADATA] Beginning update of city metadata${cityId ? ` for ${cityId}` : ' for all cities'}`, 'server');
    
    // Check if files system is available
    const imageDir = getImageDir();
    let fsAvailable = false;
    try {
      await fs.access(imageDir);
      fsAvailable = true;
      log(`[METADATA] Image directory ${imageDir} is accessible`, 'server');
    } catch (error) {
      log(`[METADATA] Warning: Image directory ${imageDir} is not accessible, cannot verify file existence`, 'server');
    }
    
    // If specific cityId provided, only update that city
    const cityQuery = cityId ? db.select().from(cities).where(eq(cities.id, cityId)) : db.select().from(cities);
    const allCities = await cityQuery;
    
    log(`[METADATA] Processing ${allCities.length} cities`, 'server');
    
    for (const city of allCities) {
      // Get all items for this city
      const cityItems = await db.select().from(bingoItems).where(eq(bingoItems.cityId, city.id));
      
      // Calculate counts
      const itemCount = cityItems.length;
      const itemsWithDescriptions = cityItems.filter(item => !!item.description).length;
      const itemsWithImages = cityItems.filter(item => !!item.image).length;
      
      // Count actual image files that exist on disk
      let itemsWithValidImageFiles = 0;
      
      if (fsAvailable) {
        for (const item of cityItems) {
          if (!item.image) continue;
          
          try {
            // Extract filename from image URL/path
            let filename;
            
            if (item.image.startsWith('/images/')) {
              // Format: /images/filename.png 
              filename = path.basename(item.image);
            } else if (item.image.startsWith('/')) {
              // Other absolute paths
              filename = item.image.substring(1);
            } else {
              // Relative paths or full URLs
              filename = item.image;
            }
            
            // Construct the path to the image file
            const imagePath = path.join(process.cwd(), 'public', 'images', filename);
            
            // Check if file exists
            await fs.access(imagePath);
            itemsWithValidImageFiles++;
            
            // Debug: Log successful file access
            log(`[METADATA] Successfully verified image file for item ${item.id}: ${imagePath}`, 'server');
          } catch (error) {
            log(`[METADATA] Image file for item ${item.id} does not exist on disk: ${item.image} (searched at ${process.cwd()}/public/images)`, 'server');
            // File doesn't exist, don't increment counter
          }
        }
      } else {
        // If file system isn't available, assume all images with URLs exist
        itemsWithValidImageFiles = itemsWithImages;
      }
      
      // Update city metadata in database
      await db.update(cities)
        .set({
          itemCount,
          itemsWithDescriptions,
          itemsWithImages,
          itemsWithValidImageFiles,
          lastMetadataUpdate: new Date().toISOString()
        })
        .where(eq(cities.id, city.id));
      
      log(`[METADATA] Updated ${city.id}: items=${itemCount}, descriptions=${itemsWithDescriptions}, images=${itemsWithImages}, valid files=${itemsWithValidImageFiles}`, 'server');
    }
    
    log(`[METADATA] City metadata update completed successfully`, 'server');
    return true;
  } catch (error) {
    log(`[METADATA] Error updating city metadata: ${error instanceof Error ? error.message : String(error)}`, 'server');
    return false;
  }
}

/**
 * Fix missing images for any city
 * Identifies items with image URLs in the database but no actual files on disk
 * @param cityId Optional city ID to repair, if not provided repairs all cities
 */
export async function repairMissingImages(cityId?: string) {
  try {
    log(`[IMAGE REPAIR] Beginning check for missing images${cityId ? ` for ${cityId}` : ' for all cities'}`, 'server');
    
    // First update metadata to ensure we have accurate counts
    await updateCityMetadata(cityId);
    
    // Fetch the cities that need repair
    const cityQuery = cityId 
      ? db.select().from(cities).where(eq(cities.id, cityId))
      : db.select().from(cities).where(sql`${cities.itemsWithImages} > ${cities.itemsWithValidImageFiles}`);
    
    const citiesToRepair = await cityQuery;
    
    if (citiesToRepair.length === 0) {
      log(`[IMAGE REPAIR] No cities with missing images found`, 'server');
      return {
        success: true,
        message: "No cities with missing images found",
        repaired: 0
      };
    }
    
    log(`[IMAGE REPAIR] Found ${citiesToRepair.length} cities with missing images`, 'server');
    
    // Return the list of cities and items that need repair
    // This information will be passed to the image generation function by the API endpoint
    const itemsToRepair: { cityId: string; itemId: string; itemText: string }[] = [];
    
    for (const city of citiesToRepair) {
      // Get all items with images for this city
      const cityItems = await db.select().from(bingoItems)
        .where(eq(bingoItems.cityId, city.id));
      
      const imageDir = getImageDir();
      for (const item of cityItems) {
        if (!item.image) continue; // Skip items without images
        
        try {
          // Extract filename from image URL/path
          let filename;
            
          if (item.image.startsWith('/images/')) {
            // Format: /images/filename.png 
            filename = path.basename(item.image);
          } else if (item.image.startsWith('/')) {
            // Other absolute paths
            filename = item.image.substring(1);
          } else {
            // Relative paths or full URLs
            filename = item.image;
          }
          
          // Construct the path to the image file
          const imagePath = path.join(process.cwd(), 'public', 'images', filename);
          
          // Check if file exists
          await fs.access(imagePath);
          // File exists, continue
          log(`[IMAGE REPAIR] Item ${item.id} has valid image at ${imagePath}`, 'server');
        } catch (error) {
          // File doesn't exist, add to repair list
          log(`[IMAGE REPAIR] Adding item to repair list: ${item.id} (${item.text})`, 'server');
          itemsToRepair.push({
            cityId: city.id,
            itemId: item.id,
            itemText: item.text
          });
        }
      }
    }
    
    log(`[IMAGE REPAIR] Found ${itemsToRepair.length} items needing image repair`, 'server');
    
    return {
      success: true,
      message: `Found ${itemsToRepair.length} items needing image repair across ${citiesToRepair.length} cities`,
      itemsToRepair,
      repaired: itemsToRepair.length
    };
  } catch (error) {
    log(`[IMAGE REPAIR] Error checking for missing images: ${error instanceof Error ? error.message : String(error)}`, 'server');
    return {
      success: false,
      message: `Error checking for missing images: ${error instanceof Error ? error.message : String(error)}`,
      repaired: 0
    };
  }
}
