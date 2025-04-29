import { log } from './vite';
import { cities, bingoItems, UserCompletion } from '@shared/schema';
import { db } from './db';
import { storage } from './storage';
import { eq } from 'drizzle-orm';

/**
 * Preload cities from database to ensure they're in the application state
 * This helps with cities like Washington DC that might not be loading properly
 */
export async function preloadCitiesFromDatabase(): Promise<void> {
  try {
    console.log('[PRELOAD] Starting city preloading from database');
    
    // Get all cities
    const allCities = await db.select().from(cities);
    console.log(`[PRELOAD] Found ${allCities.length} cities in database`);
    
    // Get current state
    const state = await storage.getBingoState();
    const existingCities = Object.keys(state.cities);
    
    console.log(`[PRELOAD] Current state has ${existingCities.length} cities: ${existingCities.join(', ')}`);
    
    // Identify missing cities
    const missingCities = allCities.filter(city => !existingCities.includes(city.id));
    
    if (missingCities.length === 0) {
      console.log('[PRELOAD] No missing cities found, all database cities already in application state');
      return;
    }
    
    console.log(`[PRELOAD] Found ${missingCities.length} missing cities: ${missingCities.map(c => c.id).join(', ')}`);
    
    // Load each missing city
    for (const city of missingCities) {
      console.log(`[PRELOAD] Loading city ${city.id}: ${city.title}`);
      
      // Get all items for this city
      const cityItems = await db.select().from(bingoItems).where(eq(bingoItems.cityId, city.id));
      console.log(`[PRELOAD] Found ${cityItems.length} items for city ${city.id}`);
      
      if (cityItems.length === 0) {
        console.log(`[PRELOAD] Skipping city ${city.id} as it has no items`);
        continue;
      }
      
      // Create city object
      const newCity = {
        id: city.id,
        title: city.title || `${city.id} Bingo`,
        subtitle: city.subtitle || 'College Student Edition',
        styleGuide: city.styleGuide && typeof city.styleGuide === 'string' 
          ? JSON.parse(city.styleGuide) 
          : city.styleGuide || { styleGuide: [] },
        items: cityItems.map(item => ({
          id: item.id,
          text: item.text || '',
          completed: false,
          isCenterSpace: item.isCenterSpace === null ? undefined : item.isCenterSpace,
          image: item.image || undefined,
          description: item.description || undefined,
          gridRow: item.gridRow === null ? undefined : item.gridRow,
          gridCol: item.gridCol === null ? undefined : item.gridCol
        }))
      };
      
      // Add to state
      state.cities[city.id] = newCity;
      console.log(`[PRELOAD] Added city ${city.id} to application state`);
    }
    
    // If we need to set a current city
    if (!state.currentCity && missingCities.length > 0) {
      state.currentCity = missingCities[0].id;
      console.log(`[PRELOAD] Set current city to ${state.currentCity}`);
    }
    
    // Save updated state
    await storage.saveBingoState(state);
    console.log('[PRELOAD] Successfully saved updated state with preloaded cities');
    
  } catch (error) {
    console.error('[PRELOAD ERROR]', error);
  }
}

/**
 * Check for Washington, D.C. items and ensure they have at least placeholder images
 * This function checks both missing images (null) and images that might be corrupted or improperly stored
 */
export async function repairWashingtonDCImages(): Promise<void> {
  try {
    console.log('[DC REPAIR] Checking Washington DC images');
    
    // Direct database lookup to get all Washington DC items
    const washingtonItems = await db.select().from(bingoItems).where(eq(bingoItems.cityId, 'washingtondc'));
    
    if (washingtonItems.length === 0) {
      console.log('[DC REPAIR] No Washington DC items found in database');
      return;
    }
    
    console.log(`[DC REPAIR] Found ${washingtonItems.length} Washington DC items in database`);
    
    // Log all items and their image paths for debugging
    washingtonItems.forEach(item => {
      console.log(`[DC REPAIR] Item ${item.id}: "${item.text}" | Image: ${item.image || 'null'}`);
    });
    
    // Filter out items missing images
    const itemsMissingImages = washingtonItems.filter(item => !item.image);
    console.log(`[DC REPAIR] Found ${itemsMissingImages.length} items missing images (null value)`);
    
    if (itemsMissingImages.length === 0) {
      console.log('[DC REPAIR] No missing images found in database');
      console.log('[DC REPAIR] Verifying image paths in application state');
      
      // Check if images exist in the actual files
      const fs = await import('fs');
      const path = await import('path');
      
      // Count items with invalid file paths
      let invalidFilePaths = 0;
      
      for (const item of washingtonItems) {
        if (item.image && item.image.startsWith('/images/')) {
          const imagePath = path.join(process.cwd(), 'public', item.image);
          if (!fs.existsSync(imagePath)) {
            invalidFilePaths++;
            console.log(`[DC REPAIR] ⚠️ Image file missing for ${item.id}: ${item.image}`);
          }
        }
      }
      
      if (invalidFilePaths === 0) {
        console.log('[DC REPAIR] All image files verified and exist');
        return;
      } else {
        console.log(`[DC REPAIR] Found ${invalidFilePaths} items with missing image files`);
        
        // Prepare a list of items that need image regeneration
        const itemsNeedingRegeneration = washingtonItems.filter(item => {
          if (!item.image || !item.image.startsWith('/images/')) return true;
          
          const fs = require('fs');
          const path = require('path');
          const imagePath = path.join(process.cwd(), 'public', item.image);
          return !fs.existsSync(imagePath);
        });
        
        console.log(`[DC REPAIR] Will attempt to regenerate ${itemsNeedingRegeneration.length} images`);
        
        // Import the generateItemImage function
        const { generateItemImage } = await import('./generator');
        
        // Process items in batches to avoid rate limiting
        const batchSize = 3;
        const batches = [];
        for (let i = 0; i < itemsNeedingRegeneration.length; i += batchSize) {
          batches.push(itemsNeedingRegeneration.slice(i, i + batchSize));
        }
        
        console.log(`[DC REPAIR] Processing ${batches.length} batches of image regeneration`);
        
        let successCount = 0;
        let failureCount = 0;
        
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          console.log(`[DC REPAIR] Processing batch ${i+1}/${batches.length} with ${batch.length} items`);
          
          // Generate images for this batch in parallel
          const results = await Promise.allSettled(batch.map(async (item) => {
            try {
              // Generate the image
              console.log(`[DC REPAIR] Generating image for "${item.text}" (${item.id})`);
              const imageUrl = await generateItemImage(
                item.text || 'Washington DC attraction', 
                'Washington, D.C.', 
                item.description || 'A popular attraction in Washington DC', 
                null, // No style guide for repair
                item.id, // Use actual item ID
                true // Force new image generation
              );
              
              if (!imageUrl) {
                console.log(`[DC REPAIR] Failed to generate image for ${item.id}`);
                return { success: false, itemId: item.id };
              }
              
              // Update the database record
              await db
                .update(bingoItems)
                .set({ image: imageUrl })
                .where(eq(bingoItems.id, item.id));
              
              console.log(`[DC REPAIR] Successfully generated and saved image for ${item.id}: ${imageUrl}`);
              return { success: true, itemId: item.id, imageUrl };
            } catch (error) {
              console.error(`[DC REPAIR] Error generating image for ${item.id}:`, error);
              return { success: false, itemId: item.id, error };
            }
          }));
          
          // Process results
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value.success) {
              successCount++;
            } else {
              failureCount++;
            }
          }
          
          // Add a delay between batches
          if (i < batches.length - 1) {
            console.log('[DC REPAIR] Waiting 3 seconds before next batch...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
        
        console.log(`[DC REPAIR] Image regeneration complete: ${successCount} successful, ${failureCount} failed`);
        
        // Update application state with the latest image paths from database
        const appState = await storage.getBingoState();
        
        if (appState.cities['washingtondc']) {
          // Get the latest database records
          const refreshedItems = await db.select().from(bingoItems).where(eq(bingoItems.cityId, 'washingtondc'));
          
          // Create a lookup map of DB items by ID for quick access
          const dbItemsMap = {};
          for (const item of refreshedItems) {
            dbItemsMap[item.id] = item;
          }
          
          // Update each item in application state with latest DB image path
          let stateUpdatedCount = 0;
          for (const stateItem of appState.cities['washingtondc'].items) {
            if (dbItemsMap[stateItem.id] && dbItemsMap[stateItem.id].image) {
              // Update the path in application state
              const oldPath = stateItem.image || 'none';
              const newPath = dbItemsMap[stateItem.id].image;
              
              if (oldPath !== newPath) {
                stateItem.image = newPath;
                stateUpdatedCount++;
                console.log(`[DC REPAIR] Updated app state image for ${stateItem.id}: ${oldPath} → ${newPath}`);
              }
            }
          }
          
          if (stateUpdatedCount > 0) {
            console.log(`[DC REPAIR] Synced ${stateUpdatedCount} image paths from database to application state`);
            // Save the updated state
            await storage.saveBingoState(appState);
            console.log('[DC REPAIR] Successfully saved updated application state');
          } else {
            console.log('[DC REPAIR] No image updates needed in application state');
          }
        } else {
          console.log('[DC REPAIR] Washington DC not found in application state');
        }
        
        return; // Skip the placeholder code below since we've done regeneration
      }
    }
    
    // Add placeholder images directly to the database
    let updatedCount = 0;
    for (const item of itemsMissingImages) {
      const itemText = item.text || 'Washington DC Item';
      const placeholderUrl = `/api/placeholder-image?text=${encodeURIComponent(itemText)}&reason=${encodeURIComponent('Washington DC image being processed')}`;
      
      try {
        await db
          .update(bingoItems)
          .set({ image: placeholderUrl })
          .where(eq(bingoItems.id, item.id));
        
        updatedCount++;
        console.log(`[DC REPAIR] Added placeholder image for item ${item.id}`);
      } catch (dbError) {
        console.error(`[DC REPAIR] Database update failed for item ${item.id}:`, dbError);
      }
    }
    
    console.log(`[DC REPAIR] Updated ${updatedCount} items in the database with placeholder images`);
    
    // Now update the application state
    const appState = await storage.getBingoState();
    
    if (appState.cities['washingtondc']) {
      console.log('[DC REPAIR] Updating Washington DC in application state');
      
      // Update the images in the application state
      let stateUpdatedCount = 0;
      for (const stateItem of appState.cities['washingtondc'].items) {
        if (!stateItem.image) {
          const itemText = stateItem.text || 'Washington DC Item';
          const placeholderUrl = `/api/placeholder-image?text=${encodeURIComponent(itemText)}&reason=${encodeURIComponent('Washington DC image being processed')}`;
          stateItem.image = placeholderUrl;
          stateUpdatedCount++;
        }
      }
      
      console.log(`[DC REPAIR] Updated ${stateUpdatedCount} items in application state with placeholder images`);
      
      // Save updated application state
      await storage.saveBingoState(appState);
      console.log('[DC REPAIR] Successfully saved updated state with Washington DC placeholder images');
    } else {
      console.log('[DC REPAIR] Washington DC not found in application state, but database was updated');
    }
    
  } catch (error) {
    console.error('[DC REPAIR ERROR]', error);
  }
}