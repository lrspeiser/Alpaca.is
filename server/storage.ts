import { 
  users, 
  cities, 
  bingoItems, 
  cityTips, 
  bingoState,
  type User, 
  type InsertUser,
  type BingoState as DBBingoState,
  type InsertBingoState,
  type BingoItem as DBBingoItem,
  type InsertBingoItem,
  type City as DBCity,
  type InsertCity,
  type CityTip as DBCityTip,
  type InsertCityTip
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

// We need to import these types directly instead of using aliases
// to avoid import errors
interface BingoItemType {
  id: string;
  text: string;
  completed: boolean;
  isCenterSpace?: boolean;
  image?: string;
  description?: string;
}

interface CityTipType {
  title: string;
  text: string;
}

interface CityType {
  id: string;
  title: string;
  subtitle?: string;
  backgroundImage: string;
  items: BingoItemType[];
  tips: CityTipType[];
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
          backgroundImage: "https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&q=80&w=1000&ixlib=rb-4.0.3",
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
          ],
          tips: [
            { title: 'Trdelník', text: 'A sweet pastry rolled around a stick and roasted over an open flame, often coated with sugar and walnuts' },
            { title: 'Svíčková', text: 'Traditional Czech dish of beef sirloin with cream sauce and bread dumplings' },
            { title: 'Becherovka', text: 'An herbal liquor with a unique taste - you\'ll either love it or hate it!' },
            { title: 'Narrowest Street', text: 'Find Vinarna Certovka, so narrow it has its own traffic light for pedestrians' },
            { title: 'Beer Spa', text: 'Experience bathing in beer while enjoying unlimited beer consumption' }
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
        
        // Get all cities
        const dbCities = await db.select().from(cities);
        
        if (dbCities.length > 0) {
          console.log(`[DB] Found ${dbCities.length} cities in database`);
          
          // Start building state
          const reconstructedState: BingoStateType = {
            currentCity: "prague", // Default
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
            
            // Get all tips for this city
            const cityTipItems = await db
              .select()
              .from(cityTips)
              .where(eq(cityTips.cityId, city.id));
            
            // Add city to state
            reconstructedState.cities[city.id] = {
              id: city.id,
              title: city.title,
              subtitle: city.subtitle || '',
              backgroundImage: city.backgroundImage,
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
                  description: item.description || undefined
                };
              }),
              tips: cityTipItems.map((tip: any) => ({
                title: tip.title,
                text: tip.text
              }))
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
      
      // RETRIEVAL STRATEGY 2: Try to get the global app state (for admin view)
      try {
        const [globalState] = await db
          .select()
          .from(bingoState)
          .where(eq(bingoState.id, 1)); // Use ID 1 for global state
        
        if (globalState) {
          console.log('[DB] Found global bingo state in database');
          const stateData = globalState.data as unknown as BingoStateType;
          
          // Debug the content to verify descriptions are there
          if (stateData.cities.prague) {
            const testItem = stateData.cities.prague.items.find(i => i.id === 'prague-4');
            if (testItem) {
              console.log('[DB DEBUG] prague-4 item from global state:', { 
                id: testItem.id,
                text: testItem.text,
                hasDescription: !!testItem.description,
                description: testItem.description ? `${testItem.description.substring(0, 50)}...` : 'none',
                hasImage: !!testItem.image
              });
            }
          }
          
          // Cache the result in memory for faster access
          this.inMemoryState = JSON.parse(JSON.stringify(stateData));
          return stateData;
        }
      } catch (error) {
        console.error('[DB] Error getting global state:', error);
      }
      
      // RETRIEVAL STRATEGY 3: If we have a stored in-memory state, use it as a fallback/cache
      if (this.inMemoryState) {
        console.log('[DB] Using in-memory state');
        return JSON.parse(JSON.stringify(this.inMemoryState)); // Deep clone to avoid reference issues
      }
      
      // RETRIEVAL STRATEGY 4: Use user-specific state if provided
      if (userId) {
        // Try to get state for this user
        const [userState] = await db
          .select()
          .from(bingoState)
          .where(eq(bingoState.userId, userId));
        
        if (userState) {
          // User has saved state
          console.log('[DB] Found user-specific bingo state in database');
          return userState.data as unknown as BingoStateType;
        }
      }
      
      // RETRIEVAL STRATEGY 5: If we get here, use initialState and save it to DB
      console.log('[DB] No existing state found, creating initial state');
      
      // Create a global state entry and save initial items
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
      // SAVE STRATEGY 1: Always save a global app state (id=1) for admin access
      // This ensures descriptions and images are preserved between server restarts
      try {
        const [globalState] = await db
          .select()
          .from(bingoState)
          .where(eq(bingoState.id, 1));
        
        if (globalState) {
          console.log('[DB] Updating global bingo state (id=1)');
          await db
            .update(bingoState)
            .set({ 
              currentCity: state.currentCity,
              data: state as any
            })
            .where(eq(bingoState.id, 1));
        } else {
          console.log('[DB] Creating new global bingo state (id=1)');
          await db
            .insert(bingoState)
            .values({
              id: 1,
              currentCity: state.currentCity,
              data: state as any
            });
        }
      } catch (error) {
        console.error('[DB] Error saving global state:', error);
      }

      // SAVE STRATEGY 1B: ALSO save individual items to their own tables for redundancy
      // This ensures we have multiple ways to recover data
      try {
        console.log('[DB] Saving individual records to database tables');
        
        // Process each city in the state
        for (const cityId in state.cities) {
          const city = state.cities[cityId];
          
          // Save/update the city record
          try {
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
                  backgroundImage: city.backgroundImage
                })
                .where(eq(cities.id, cityId));
            } else {
              await db
                .insert(cities)
                .values({
                  id: cityId,
                  title: city.title,
                  subtitle: city.subtitle || '',
                  backgroundImage: city.backgroundImage
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
                await db
                  .update(bingoItems)
                  .set({
                    text: item.text,
                    completed: item.completed,
                    isCenterSpace: item.isCenterSpace || false,
                    image: item.image,
                    description: item.description
                  })
                  .where(eq(bingoItems.id, item.id));
              } else {
                await db
                  .insert(bingoItems)
                  .values({
                    id: item.id,
                    text: item.text,
                    completed: item.completed,
                    isCenterSpace: item.isCenterSpace || false,
                    image: item.image,
                    description: item.description,
                    cityId: cityId
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
      
      // SAVE STRATEGY 2: If we have a userId, save to user-specific state
      if (userId) {
        try {
          const [userState] = await db
            .select()
            .from(bingoState)
            .where(eq(bingoState.userId, userId));
          
          if (userState) {
            // Update existing state
            console.log(`[DB] Updating user state for userId=${userId}`);
            await db
              .update(bingoState)
              .set({ 
                currentCity: state.currentCity,
                data: state as any
              })
              .where(eq(bingoState.userId, userId));
          } else {
            // Insert new state
            console.log(`[DB] Creating new user state for userId=${userId}`);
            await db
              .insert(bingoState)
              .values({
                userId,
                currentCity: state.currentCity,
                data: state as any
              });
          }
        } catch (error) {
          console.error('[DB] Error saving user state:', error);
        }
      }
    } catch (error) {
      console.error('[DB] Error in saveBingoState:', error);
    }
  }
  
  async toggleItemCompletion(itemId: string, cityId: string, userId?: number): Promise<void> {
    // Get the current state
    const state = await this.getBingoState(userId);
    
    // Find the city and update the item
    if (state.cities[cityId]) {
      const city = state.cities[cityId];
      const itemIndex = city.items.findIndex((item: BingoItemType) => item.id === itemId);
      
      if (itemIndex !== -1 && !city.items[itemIndex].isCenterSpace) {
        // Toggle the item's completion status
        city.items[itemIndex].completed = !city.items[itemIndex].completed;
        
        // Save the updated state
        await this.saveBingoState(state, userId);
      }
    }
  }
  
  async resetCity(cityId: string, userId?: number): Promise<void> {
    // Get the current state
    const state = await this.getBingoState(userId);
    
    // Find the city and reset all items except center space
    if (state.cities[cityId]) {
      const city = state.cities[cityId];
      
      // Reset all items except center space
      city.items = city.items.map((item: BingoItemType) => {
        if (item.isCenterSpace) return item;
        return { ...item, completed: false };
      });
      
      // Save the updated state
      await this.saveBingoState(state, userId);
    }
  }
}

// Use the DatabaseStorage implementation instead of MemStorage
export const storage = new DatabaseStorage();
