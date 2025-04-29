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
    
    // Filter out items missing images
    const itemsMissingImages = washingtonItems.filter(item => !item.image);
    console.log(`[DC REPAIR] Found ${itemsMissingImages.length} items missing images`);
    
    if (itemsMissingImages.length === 0) {
      console.log('[DC REPAIR] No missing images found');
      return;
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