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
  createUser(user: InsertUser): Promise<User>;
  
  // Bingo State Methods
  getBingoState(userId?: number): Promise<BingoStateType>;
  saveBingoState(state: BingoStateType, userId?: number): Promise<void>;
  
  // Additional methods for more granular operations
  toggleItemCompletion(itemId: string, cityId: string, userId?: number): Promise<void>;
  resetCity(cityId: string, userId?: number): Promise<void>;
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
  
  async getBingoState(userId?: number): Promise<BingoStateType> {
    // Create an initial bingo state if needed
    const initialState: BingoStateType = {
      currentCity: "prague", // Default city
      cities: {
        prague: {
          id: "prague",
          title: "Prague Bingo",
          subtitle: "Complete activities to unlock achievements",
          items: [
            { id: 'prague-1', text: 'Eat a Trdelník', completed: false, image: undefined },
            { id: 'prague-2', text: 'Walk Charles Bridge at sunrise', completed: false, image: undefined },
            { id: 'prague-3', text: 'See the Astronomical Clock ring', completed: false, image: undefined },
            { id: 'prague-4', text: 'Drink a Pilsner Urquell', completed: false, image: undefined },
            { id: 'prague-5', text: 'Take a photo with John Lennon Wall', completed: false, image: undefined },
            { id: 'prague-6', text: 'Climb Petrin Tower', completed: false, image: undefined },
            { id: 'prague-7', text: 'Eat traditional Svíčková', completed: false, image: undefined },
            { id: 'prague-8', text: 'Ride a historic tram', completed: false, image: undefined },
            { id: 'prague-9', text: 'Buy a puppet or marionette', completed: false, image: undefined },
            { id: 'prague-10', text: 'Visit Prague Castle', completed: false, image: undefined },
            { id: 'prague-11', text: 'Try Becherovka (Herbal Liquor)', completed: false, image: undefined },
            { id: 'prague-12', text: 'See the Dancing House', completed: false, image: undefined },
            { id: 'prague-13', text: 'Arrive in Prague', completed: false, isCenterSpace: true, description: 'Welcome to the beautiful city of Prague! Known as the "City of a Hundred Spires," this historic capital of the Czech Republic is famous for its Old Town Square, Prague Castle, and Charles Bridge.', image: undefined },
            { id: 'prague-14', text: 'Visit Old Jewish Cemetery', completed: false, image: undefined },
            { id: 'prague-15', text: 'Listen to live jazz at a bar', completed: false, image: undefined },
            { id: 'prague-16', text: 'Touch the St. John of Nepomuk statue', completed: false, image: undefined },
            { id: 'prague-17', text: 'Eat Goulash in bread bowl', completed: false, image: undefined },
            { id: 'prague-18', text: 'Cross Legií Bridge', completed: false, image: undefined },
            { id: 'prague-19', text: 'Visit the National Museum', completed: false, image: undefined },
            { id: 'prague-20', text: 'Buy Bohemian crystal souvenir', completed: false, image: undefined },
            { id: 'prague-21', text: 'Watch sunset from Letná Park', completed: false, image: undefined },
            { id: 'prague-22', text: 'Tour a beer spa', completed: false, image: undefined },
            { id: 'prague-23', text: 'Eat a sausage from Wenceslas Square', completed: false, image: undefined },
            { id: 'prague-24', text: 'Find the narrowest street in Prague', completed: false, image: undefined },
            { id: 'prague-25', text: 'Explore Vyšehrad fortress', completed: false, image: undefined }
          ]
        }
        // Only including Prague for brevity - other cities would be added here
      }
    };
    
    try {
      // Log request to help with debugging
      console.log(`[DB] Getting bingo state. userId: ${userId || 'none'}, hasInMemoryState: ${!!this.inMemoryState}`);
      
      // RETRIEVAL STRATEGY 1: Try to load items from individual tables first
      try {
        console.log('[DB] Checking for individual records in database tables');
        
        // Find the current city
        let currentCity = "prague"; // Default
        
        // Get city that's marked as current (fallback to first city found)
        const [currentCityRecord] = await db
          .select()
          .from(cities)
          .where(eq(cities.isCurrentCity, true));
          
        if (currentCityRecord) {
          currentCity = currentCityRecord.id;
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
          
          // Debug the content to verify descriptions are there
          if (reconstructedState.cities.prague) {
            const testItem = reconstructedState.cities.prague.items.find(i => i.id === 'prague-4');
            if (testItem) {
              console.log('[DB DEBUG] prague-4 item from individual tables:', { 
                id: testItem.id,
                text: testItem.text,
                hasDescription: !!testItem.description,
                description: testItem.description ? `${testItem.description.substring(0, 50)}...` : 'none',
                hasImage: !!testItem.image
              });
            }
            
            // If we have items with descriptions, use this reconstructed state
            const itemsWithDescriptions = reconstructedState.cities.prague.items.filter(i => !!i.description).length;
            if (itemsWithDescriptions > 1) { // More than just the center space
              console.log(`[DB] Using reconstructed state with ${itemsWithDescriptions} descriptions`);
              this.inMemoryState = JSON.parse(JSON.stringify(reconstructedState));
              return reconstructedState;
            }
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
      
      // RETRIEVAL STRATEGY 3: If we get here, use initialState and save it to DB
      console.log('[DB] No existing state found, creating initial state');
      
      // Create initial state and save it
      try {
        await this.saveBingoState(initialState);
      } catch (error) {
        console.error('[DB] Failed to save initial state:', error);
      }
      
      return initialState;
    } catch (error) {
      console.error('[DB] Error in getBingoState:', error);
      return initialState;
    }
  }
  
  // Persistent state storage
  // We'll use in-memory for caching but prioritize database storage for persistence
  private inMemoryState: BingoStateType | null = null;
  
  async saveBingoState(state: BingoStateType, userId?: number): Promise<void> {
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
    
    // Check for prague-4 item to debug description saving issue
    if (state.cities.prague) {
      const item = state.cities.prague.items.find(i => i.id === 'prague-4');
      if (item) {
        console.log('[DB DEBUG] SAVING prague-4 item with:', {
          text: item.text,
          hasDescription: !!item.description,
          descriptionPreview: item.description ? item.description.substring(0, 50) + '...' : 'none'
        });
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

  async toggleItemCompletion(itemId: string, cityId: string, userId?: number): Promise<void> {
    try {
      // First, get the current state
      const state = await this.getBingoState(userId);
      
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
      await this.saveBingoState(state, userId);
    } catch (error) {
      console.error(`[DB] Error toggling item ${itemId} in city ${cityId}:`, error);
      throw error;
    }
  }

  async resetCity(cityId: string, userId?: number): Promise<void> {
    try {
      // First, get the current state
      const state = await this.getBingoState(userId);
      
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
      await this.saveBingoState(state, userId);
    } catch (error) {
      console.error(`[DB] Error resetting city ${cityId}:`, error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();