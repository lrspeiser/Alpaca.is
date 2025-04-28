import { 
  users, 
  cities, 
  bingoItems,
  type User, 
  type InsertUser,
  type BingoItem as DBBingoItem,
  type InsertBingoItem,
  type City as DBCity,
  type InsertCity
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { log } from "./vite";

// We need to import these types directly instead of using aliases
// to avoid import errors
interface BingoItemType {
  id: string;
  text: string;
  completed: boolean;
  isCenterSpace?: boolean;
  image?: string;
  description?: string;
  gridRow?: number; // 0-based row index (0-4)
  gridCol?: number; // 0-based column index (0-4)
}

interface CityType {
  id: string;
  title: string;
  subtitle?: string;
  styleGuide?: any;
  items: BingoItemType[];
}

interface BingoStateType {
  currentCity: string;
  cities: Record<string, CityType>;
}

// modify the interface with any CRUD methods
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByClientId(clientId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createOrUpdateClientUser(clientId: string): Promise<User>;
  
  // Bingo State Methods
  getBingoState(userId?: number, clientId?: string): Promise<BingoStateType>;
  saveBingoState(state: BingoStateType, userId?: number, clientId?: string): Promise<void>;
  
  // Additional methods for more granular operations
  toggleItemCompletion(itemId: string, cityId: string, userId?: number, clientId?: string): Promise<void>;
  resetCity(cityId: string, userId?: number, clientId?: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  async getUserByClientId(clientId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.clientId, clientId));
    return user;
  }
  
  async createOrUpdateClientUser(clientId: string): Promise<User> {
    // First check if user exists with this clientId
    const existingUser = await this.getUserByClientId(clientId);
    
    if (existingUser) {
      // Update the last visited time
      const currentTime = new Date().toISOString();
      const [updatedUser] = await db
        .update(users)
        .set({ lastVisitedAt: currentTime })
        .where(eq(users.clientId, clientId))
        .returning();
      
      return updatedUser;
    } else {
      // Create a new user with just the clientId
      const currentTime = new Date().toISOString();
      const [user] = await db
        .insert(users)
        .values({
          clientId,
          lastVisitedAt: currentTime
        })
        .returning();
      
      return user;
    }
  }
  
  async getBingoState(userId?: number, clientId?: string): Promise<BingoStateType> {
    // Create an empty initial state - no default cities
    const emptyState: BingoStateType = {
      currentCity: "", // No current city
      cities: {}  // No cities by default
    };
    
    try {
      // Log request to help with debugging
      console.log(`[DB] Getting bingo state. userId: ${userId || 'none'}, hasInMemoryState: ${!!this.inMemoryState}`);
      
      // RETRIEVAL STRATEGY 1: Try to load items from individual tables first
      try {
        console.log('[DB] Checking for individual records in database tables');
        
        // Find the current city
        let currentCity = ""; // No default city
        
        // Get city that's marked as current (fallback to first city found)
        const [currentCityRecord] = await db
          .select()
          .from(cities)
          .where(eq(cities.isCurrentCity, true));
          
        if (currentCityRecord) {
          currentCity = currentCityRecord.id;
        } else {
          // If no city is marked as current, use the first city if any exists
          const [firstCity] = await db.select().from(cities).limit(1);
          if (firstCity) {
            currentCity = firstCity.id;
          }
        }
        
        // Get all cities
        const dbCities = await db.select().from(cities);
        
        if (dbCities.length > 0) {
          console.log(`[DB] Found ${dbCities.length} cities in database`);
          
          // Start building state
          const reconstructedState: BingoStateType = {
            currentCity,
            cities: {}
          };
          
          // Process each city
          for (const city of dbCities) {
            // Get all items for this city
            const cityItems = await db
              .select()
              .from(bingoItems)
              .where(eq(bingoItems.cityId, city.id));
              
            console.log(`[DB] Found ${cityItems.length} items for city ${city.id}`);
            
            // Add city to state
            reconstructedState.cities[city.id] = {
              id: city.id,
              title: city.title,
              subtitle: city.subtitle || '',
              styleGuide: city.styleGuide,
              items: cityItems.map(item => {
                // Log each item with an image to debug retrieval
                if (item.image) {
                  console.log(`[DB RETRIEVE] Found item ${item.id} with image URL: ${item.image.substring(0, 30)}...`);
                }
                
                return {
                  id: item.id,
                  text: item.text,
                  completed: item.completed,
                  isCenterSpace: item.isCenterSpace || false,
                  image: item.image || undefined, 
                  description: item.description || undefined,
                  gridRow: item.gridRow !== null ? item.gridRow : undefined,
                  gridCol: item.gridCol !== null ? item.gridCol : undefined,
                  // Ensure center space is at position (2,2)
                  ...(item.isCenterSpace ? { gridRow: 2, gridCol: 2 } : {})
                };
              })
            };
          }
          
          // Check for any city with descriptions to use as a measurement of data quality
          let totalDescriptions = 0;
          for (const cityId in reconstructedState.cities) {
            const city = reconstructedState.cities[cityId];
            const descriptionsInCity = city.items.filter(i => !!i.description).length;
            totalDescriptions += descriptionsInCity;
            
            if (descriptionsInCity > 0) {
              console.log(`[DB] City ${cityId} has ${descriptionsInCity} items with descriptions`);
            }
          }
          
          // If we have any city with items that have descriptions, use the reconstructed state
          if (totalDescriptions > 0) {
            console.log(`[DB] Using reconstructed state with ${totalDescriptions} total descriptions`);
            this.inMemoryState = JSON.parse(JSON.stringify(reconstructedState));
            return reconstructedState;
          }
        }
      } catch (error) {
        console.error('[DB] Error loading from individual tables:', error);
      }
      
      // RETRIEVAL STRATEGY 2: If we have a stored in-memory state, use it as a fallback/cache
      if (this.inMemoryState) {
        console.log('[DB] Using in-memory state');
        return JSON.parse(JSON.stringify(this.inMemoryState)); // Deep clone to avoid reference issues
      }
      
      // RETRIEVAL STRATEGY 3: If we get here, use emptyState without saving it to DB
      console.log('[DB] No existing state found, returning empty state');
      
      // Just return the empty state without auto-creating anything
      return emptyState;
    } catch (error) {
      console.error('[DB] Error in getBingoState:', error);
      return emptyState;
    }
  }
  
  // Persistent state storage
  // We'll use in-memory for caching but prioritize database storage for persistence
  private inMemoryState: BingoStateType | null = null;
  
  async saveBingoState(state: BingoStateType, userId?: number, clientId?: string): Promise<void> {
    // Log the incoming state to debug
    console.log("[DB] Saving bingo state:", {
      currentCity: state.currentCity,
      cities: Object.keys(state.cities).map(cityId => {
        const city = state.cities[cityId];
        return {
          id: city.id,
          title: city.title,
          items: city.items.map(item => ({
            id: item.id,
            text: item.text,
            hasDescription: !!item.description,
            hasImage: !!item.image
          }))
        };
      })
    });
    
    // Log a summary of items with descriptions and images for debugging
    for (const cityId in state.cities) {
      const city = state.cities[cityId];
      const itemsWithDescriptions = city.items.filter(i => !!i.description).length;
      const itemsWithImages = city.items.filter(i => !!i.image).length;
      
      if (itemsWithDescriptions > 0 || itemsWithImages > 0) {
        console.log(`[DB] City ${cityId} has ${itemsWithDescriptions} descriptions and ${itemsWithImages} images`);
      }
    }
    
    // For in-memory storage, we just replace the state completely
    // This ensures we always have the latest data
    this.inMemoryState = JSON.parse(JSON.stringify(state)); // Deep clone to avoid reference issues
    
    try {
      // SAVE STRATEGY: Save individual items to their own tables
      try {
        console.log('[DB] Saving individual records to database tables');
        
        // Process each city in the state
        for (const cityId in state.cities) {
          const city = state.cities[cityId];
          
          // Update current city flag - set all to false first and then set the current one to true
          try {
            await db
              .update(cities)
              .set({
                isCurrentCity: false
              });
              
            // Get the city with this ID to see if it exists
            const [existingCity] = await db
              .select()
              .from(cities)
              .where(eq(cities.id, cityId));
            
            if (existingCity) {
              await db
                .update(cities)
                .set({
                  title: city.title,
                  subtitle: city.subtitle || '',
                  styleGuide: city.styleGuide,
                  isCurrentCity: state.currentCity === cityId
                })
                .where(eq(cities.id, cityId));
            } else {
              await db
                .insert(cities)
                .values({
                  id: cityId,
                  title: city.title,
                  subtitle: city.subtitle || '',
                  styleGuide: city.styleGuide,
                  isCurrentCity: state.currentCity === cityId
                });
            }
          } catch (cityError) {
            console.error(`[DB] Error saving city ${cityId}:`, cityError);
          }
          
          // Save each bingo item individually
          for (const item of city.items) {
            try {
              const [existingItem] = await db
                .select()
                .from(bingoItems)
                .where(eq(bingoItems.id, item.id));
              
              // Debug logging for all items with images
              if (item.image) {
                console.log(`[DB] Item ${item.id} has image URL:`, item.image.substring(0, 30) + '...');
              }
              
              // Debug our test item
              if (item.id === 'prague-4') {
                console.log('[DB] Saving item prague-4 with data:', { 
                  hasDescription: !!item.description,
                  description: item.description ? `${item.description.substring(0, 50)}...` : 'none',
                  hasImage: !!item.image,
                  imageUrl: item.image ? `${item.image.substring(0, 30)}...` : 'none',
                  imageUrlLength: item.image ? item.image.length : 0
                });
              }
              
              if (existingItem) {
                // Set center space (position 2,2 or 3,3 in one-based indexing) 
                const gridRow = item.gridRow !== undefined ? item.gridRow : (item.isCenterSpace ? 2 : undefined);
                const gridCol = item.gridCol !== undefined ? item.gridCol : (item.isCenterSpace ? 2 : undefined);
                
                await db
                  .update(bingoItems)
                  .set({
                    text: item.text,
                    completed: item.completed,
                    isCenterSpace: item.isCenterSpace || false,
                    image: item.image,
                    description: item.description,
                    gridRow: gridRow,
                    gridCol: gridCol
                  })
                  .where(eq(bingoItems.id, item.id));
              } else {
                // Set center space (position 2,2 or 3,3 in one-based indexing) 
                const gridRow = item.gridRow !== undefined ? item.gridRow : (item.isCenterSpace ? 2 : undefined);
                const gridCol = item.gridCol !== undefined ? item.gridCol : (item.isCenterSpace ? 2 : undefined);
                
                await db
                  .insert(bingoItems)
                  .values({
                    id: item.id,
                    text: item.text,
                    completed: item.completed,
                    isCenterSpace: item.isCenterSpace || false,
                    image: item.image,
                    description: item.description,
                    cityId: cityId,
                    gridRow: gridRow,
                    gridCol: gridCol
                  });
              }
            } catch (itemError) {
              console.error(`[DB] Error saving item ${item.id}:`, itemError);
            }
          }
        }
      } catch (error) {
        console.error('[DB] Error saving individual records:', error);
      }
    } catch (error) {
      console.error('[DB] Error in saveBingoState:', error);
    }
  }

  async toggleItemCompletion(itemId: string, cityId: string, userId?: number, clientId?: string): Promise<void> {
    try {
      // First, get the current state
      const state = await this.getBingoState(userId, clientId);
      
      // Make sure we have the city
      if (!state.cities[cityId]) {
        throw new Error(`City ${cityId} not found`);
      }
      
      // Find the item in the city
      const itemIndex = state.cities[cityId].items.findIndex((item: BingoItemType) => item.id === itemId);
      if (itemIndex === -1) {
        throw new Error(`Item ${itemId} not found in city ${cityId}`);
      }
      
      // Toggle completed state
      state.cities[cityId].items[itemIndex].completed = !state.cities[cityId].items[itemIndex].completed;
      
      // Save the updated state
      await this.saveBingoState(state, userId, clientId);
    } catch (error) {
      console.error(`[DB] Error toggling item ${itemId} in city ${cityId}:`, error);
      throw error;
    }
  }

  async resetCity(cityId: string, userId?: number, clientId?: string): Promise<void> {
    try {
      // First, get the current state
      const state = await this.getBingoState(userId, clientId);
      
      // Make sure we have the city
      if (!state.cities[cityId]) {
        throw new Error(`City ${cityId} not found`);
      }
      
      // Reset all items in the city
      const city = state.cities[cityId];
      city.items = city.items.map((item: BingoItemType) => {
        return { ...item, completed: false };
      });
      
      // Save the updated state
      await this.saveBingoState(state, userId, clientId);
    } catch (error) {
      console.error(`[DB] Error resetting city ${cityId}:`, error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();