import { log } from './vite';
import { cities, bingoItems, UserCompletion } from '@shared/schema';
import { db } from './db';
import { storage } from './storage';
import { eq } from 'drizzle-orm';

/**
 * Preload cities from database to ensure they're in the application state
 * This ensures all cities defined in the database are available in the app
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

// City-agnostic repair function is no longer needed directly in preload.ts
// It has been replaced by the more comprehensive functions in updateCityMetadata.ts:
// - updateCityMetadata() - Updates metadata counts for cities
// - repairMissingImages() - Identifies items with missing image files
//
// The API routes now use these functions instead, which work for all cities, not just Washington DC.