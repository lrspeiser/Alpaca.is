import { 
  users, 
  cities, 
  bingoItems,
  userCompletions,
  type User, 
  type InsertUser,
  type BingoItem as DBBingoItem,
  type InsertBingoItem,
  type City as DBCity,
  type InsertCity,
  type UserCompletion,
  type InsertUserCompletion
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import { log } from "./vite";

// We need to import these types directly instead of using aliases
// to avoid import errors
interface BingoItemType {
  id: string;
  text: string;
  completed: boolean; // This is client-side only, not stored in the DB
  isCenterSpace?: boolean;
  image?: string;
  userPhoto?: string; // This will be populated from userCompletions for the current user
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
  toggleItemCompletion(itemId: string, cityId: string, userId?: number, clientId?: string, forcedState?: boolean): Promise<void>;
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
      
      // Get the default city to set as current city for new users
      let defaultCityId: string | null = null;
      try {
        const [defaultCity] = await db
          .select()
          .from(cities)
          .where(eq(cities.isDefaultCity, true));
          
        if (defaultCity) {
          defaultCityId = defaultCity.id;
        } else {
          // If no default city is set, use the first city
          const [firstCity] = await db.select().from(cities).limit(1);
          if (firstCity) {
            defaultCityId = firstCity.id;
          }
        }
      } catch (error) {
        console.error('[DB] Error getting default city:', error);
      }
      
      const [user] = await db
        .insert(users)
        .values({
          clientId,
          lastVisitedAt: currentTime,
          currentCity: defaultCityId || undefined
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
      // STEP 1: If clientId is provided, try to find the corresponding user
      if (clientId && !userId) {
        try {
          const user = await this.getUserByClientId(clientId);
          if (user) {
            console.log(`[DB] Found user ${user.id} with clientId ${clientId}`);
            userId = user.id;
          } else {
            console.log(`[DB] No user found for clientId ${clientId}, creating one`);
            const newUser = await this.createOrUpdateClientUser(clientId);
            userId = newUser.id;
          }
        } catch (error) {
          console.error('[DB] Error finding/creating user for clientId:', error);
        }
      }
      
      if (!userId) {
        console.log('[DB] No userId available after clientId lookup');
        return emptyState;
      }
      
      // STEP 2: Get the user's current city
      let currentCity = "";
      try {
        const user = await this.getUser(userId);
        if (user && user.currentCity) {
          currentCity = user.currentCity;
          console.log(`[DB] User ${userId} has current city: ${currentCity}`);
        } else {
          // Try to find a default city
          const [defaultCity] = await db
            .select()
            .from(cities)
            .where(eq(cities.isDefaultCity, true));
            
          if (defaultCity) {
            currentCity = defaultCity.id;
            console.log(`[DB] Using default city ${currentCity} for user ${userId}`);
            
            // Update the user's current city
            if (user) {
              await db
                .update(users)
                .set({ currentCity })
                .where(eq(users.id, userId));
            }
          } else {
            // If no default city, use the first city
            const [firstCity] = await db.select().from(cities).limit(1);
            if (firstCity) {
              currentCity = firstCity.id;
              console.log(`[DB] Using first city ${currentCity} for user ${userId}`);
              
              // Update the user's current city
              if (user) {
                await db
                  .update(users)
                  .set({ currentCity })
                  .where(eq(users.id, userId));
              }
            }
          }
        }
      } catch (error) {
        console.error('[DB] Error getting user current city:', error);
      }
      
      // STEP 3: Get all cities and their items
      const reconstructedState: BingoStateType = {
        currentCity,
        cities: {}
      };
      
      try {
        // Get all cities
        const allCities = await db.select().from(cities);
        
        // Load bingo items for each city
        for (const city of allCities) {
          // Get all items for this city
          const cityItems = await db
            .select()
            .from(bingoItems)
            .where(eq(bingoItems.cityId, city.id));
            
          console.log(`[DB] Found ${cityItems.length} items for city ${city.id}`);
          
          // Get user completions for this city if we have a userId
          let userCompletionsMap: Record<string, UserCompletion> = {};
          if (userId) {
            const completions = await db
              .select()
              .from(userCompletions)
              .where(and(
                eq(userCompletions.userId, userId),
                sql`${userCompletions.itemId} IN (${sql.join(cityItems.map(item => sql`${item.id}`), sql`, `)})` 
              ));
              
            console.log(`[DB] Found ${completions.length} user completions for city ${city.id}`);
            
            // Create a map for quick lookup
            userCompletionsMap = completions.reduce((map, completion) => {
              map[completion.itemId] = completion;
              return map;
            }, {} as Record<string, UserCompletion>);
          }
          
          // Add city to state
          reconstructedState.cities[city.id] = {
            id: city.id,
            title: city.title,
            subtitle: city.subtitle || '',
            styleGuide: city.styleGuide,
            items: cityItems.map(item => {
              const userCompletion = userCompletionsMap[item.id];
              
              // Log items with images for debugging
              if (item.image) {
                console.log(`[DB RETRIEVE] Found item ${item.id} with image URL: ${item.image.substring(0, 30)}...`);
              }
              
              // Build bingo item with user-specific completion status
              return {
                id: item.id,
                text: item.text,
                completed: !!userCompletion?.completed,
                userPhoto: userCompletion?.userPhoto || undefined,
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
        
        // Log statistics about loaded data
        let totalItems = 0;
        let completedItems = 0;
        let itemsWithPhotos = 0;
        
        for (const cityId in reconstructedState.cities) {
          const city = reconstructedState.cities[cityId];
          totalItems += city.items.length;
          completedItems += city.items.filter(item => item.completed).length;
          itemsWithPhotos += city.items.filter(item => item.userPhoto).length;
        }
        
        console.log(`[DB] Loaded ${totalItems} items across ${Object.keys(reconstructedState.cities).length} cities`);
        console.log(`[DB] User ${userId} has completed ${completedItems} items and has ${itemsWithPhotos} photos`);
        
        return reconstructedState;
      } catch (error) {
        console.error('[DB] Error loading cities and items:', error);
        return emptyState;
      }
    } catch (error) {
      console.error('[DB] Error in getBingoState:', error);
      return emptyState;
    }
  }
  
  async saveBingoState(state: BingoStateType, userId?: number, clientId?: string): Promise<void> {
    // STEP 1: If clientId is provided, try to find the corresponding user
    if (clientId && !userId) {
      try {
        const user = await this.getUserByClientId(clientId);
        if (user) {
          console.log(`[DB] Found user ${user.id} with clientId ${clientId}`);
          userId = user.id;
        } else {
          console.log(`[DB] No user found for clientId ${clientId}, creating one`);
          const newUser = await this.createOrUpdateClientUser(clientId);
          userId = newUser.id;
        }
      } catch (error) {
        console.error('[DB] Error finding/creating user for clientId:', error);
      }
    }
    
    // CRITICAL FIX: For city/item creation, don't abort if userId is missing
    // This ensures city data is still saved even if user association fails
    if (!userId) {
      console.log('[DB] No userId available after clientId lookup, continuing with city/item creation only');
      // We'll continue with city/item creation and skip user-specific operations below
    }
    
    // STEP 2: Update the user's current city (only if userId is available)
    if (userId) {
      try {
        await db
          .update(users)
          .set({ currentCity: state.currentCity })
          .where(eq(users.id, userId));
          
        console.log(`[DB] Updated current city to ${state.currentCity} for user ${userId}`);
      } catch (error) {
        console.error('[DB] Error updating user current city:', error);
      }
    } else {
      console.log(`[DB] Skipping user current city update as no userId is available`);
    }
    
    // STEP 3: Save all cities and their items
    try {
      // Process each city
      for (const cityId in state.cities) {
        const city = state.cities[cityId];
        
        // Ensure the city exists in the database
        try {
          const [existingCity] = await db
            .select()
            .from(cities)
            .where(eq(cities.id, cityId));
            
          if (existingCity) {
            // City exists, update it
            await db
              .update(cities)
              .set({
                title: city.title,
                subtitle: city.subtitle || '',
                styleGuide: city.styleGuide,
              })
              .where(eq(cities.id, cityId));
              
            console.log(`[DB] Updated city ${cityId}`);
          } else {
            // City doesn't exist, create it
            await db
              .insert(cities)
              .values({
                id: cityId,
                title: city.title,
                subtitle: city.subtitle || '',
                styleGuide: city.styleGuide,
                isDefaultCity: false // New cities are not default by default
              });
              
            console.log(`[DB] Created city ${cityId}`);
          }
        } catch (error) {
          console.error(`[DB] Error saving city ${cityId}:`, error);
        }
        
        // Process city items
        for (const item of city.items) {
          try {
            // Ensure item exists in database
            const [existingItem] = await db
              .select()
              .from(bingoItems)
              .where(eq(bingoItems.id, item.id));
              
            if (existingItem) {
              // Item exists, update it (but not completion status)
              await db
                .update(bingoItems)
                .set({
                  text: item.text,
                  isCenterSpace: item.isCenterSpace || false,
                  image: item.image,
                  description: item.description,
                  gridRow: item.gridRow,
                  gridCol: item.gridCol,
                })
                .where(eq(bingoItems.id, item.id));
            } else {
              // Item doesn't exist, create it
              await db
                .insert(bingoItems)
                .values({
                  id: item.id,
                  text: item.text,
                  isCenterSpace: item.isCenterSpace || false,
                  image: item.image,
                  description: item.description,
                  cityId: cityId,
                  gridRow: item.gridRow,
                  gridCol: item.gridCol,
                });
            }
            
            // Handle user completion status separately (only if userId is available)
            if (userId && item.completed) {
              // Check if user completion record exists
              const [existingCompletion] = await db
                .select()
                .from(userCompletions)
                .where(and(
                  eq(userCompletions.userId, userId),
                  eq(userCompletions.itemId, item.id)
                ));
                
              if (existingCompletion) {
                // Update existing completion
                await db
                  .update(userCompletions)
                  .set({
                    completed: true,
                    userPhoto: item.userPhoto,
                  })
                  .where(and(
                    eq(userCompletions.userId, userId),
                    eq(userCompletions.itemId, item.id)
                  ));
              } else {
                // Create new completion record
                await db
                  .insert(userCompletions)
                  .values({
                    userId: userId,
                    itemId: item.id,
                    completed: true,
                    userPhoto: item.userPhoto,
                    completedAt: new Date().toISOString()
                  });
              }
            } else if (userId && !item.completed) {
              // Item is not completed, delete any existing completion
              await db
                .delete(userCompletions)
                .where(and(
                  eq(userCompletions.userId, userId),
                  eq(userCompletions.itemId, item.id)
                ));
            }
          } catch (error) {
            console.error(`[DB] Error saving item ${item.id}:`, error);
          }
        }
      }
      
      console.log(`[DB] Successfully saved bingo state for user ${userId}`);
    } catch (error) {
      console.error('[DB] Error saving bingo state:', error);
    }
  }

  async toggleItemCompletion(itemId: string, cityId: string, userId?: number, clientId?: string, forcedState?: boolean): Promise<void> {
    // STEP 1: If clientId is provided, try to find the corresponding user
    if (clientId && !userId) {
      try {
        const user = await this.getUserByClientId(clientId);
        if (user) {
          console.log(`[DB] Found user ${user.id} with clientId ${clientId}`);
          userId = user.id;
        } else {
          console.log(`[DB] No user found for clientId ${clientId}, creating one`);
          const newUser = await this.createOrUpdateClientUser(clientId);
          userId = newUser.id;
        }
      } catch (error) {
        console.error('[DB] Error finding/creating user for clientId:', error);
      }
    }
    
    if (!userId) {
      console.log('[DB] No userId available after clientId lookup, cannot toggle item');
      throw new Error('User not found');
    }
    
    try {
      // First check if the item exists
      const [item] = await db
        .select()
        .from(bingoItems)
        .where(and(
          eq(bingoItems.id, itemId),
          eq(bingoItems.cityId, cityId)
        ));
        
      if (!item) {
        throw new Error(`Item ${itemId} not found in city ${cityId}`);
      }
      
      // Get current item completion status
      const [completion] = await db
        .select()
        .from(userCompletions)
        .where(and(
          eq(userCompletions.userId, userId),
          eq(userCompletions.itemId, itemId)
        ));
        
      // Determine new completion state
      let newCompletionState: boolean;
      if (forcedState !== undefined) {
        newCompletionState = forcedState;
      } else {
        newCompletionState = !completion; // Toggle current state
      }
      
      console.log(`[DB] Setting item ${itemId} completion to ${newCompletionState} for user ${userId}`);
      
      if (newCompletionState) {
        // Item should be completed
        if (completion) {
          // Update existing completion
          await db
            .update(userCompletions)
            .set({ completed: true })
            .where(and(
              eq(userCompletions.userId, userId),
              eq(userCompletions.itemId, itemId)
            ));
        } else {
          // Create new completion
          await db
            .insert(userCompletions)
            .values({
              userId: userId,
              itemId: itemId,
              completed: true,
              completedAt: new Date().toISOString()
            });
        }
      } else {
        // Item should not be completed, delete completion record
        await db
          .delete(userCompletions)
          .where(and(
            eq(userCompletions.userId, userId),
            eq(userCompletions.itemId, itemId)
          ));
      }
      
      console.log(`[DB] Successfully toggled item ${itemId} for user ${userId}`);
    } catch (error) {
      console.error(`[DB] Error toggling item ${itemId} in city ${cityId}:`, error);
      throw error;
    }
  }

  async resetCity(cityId: string, userId?: number, clientId?: string): Promise<void> {
    // STEP 1: If clientId is provided, try to find the corresponding user
    if (clientId && !userId) {
      try {
        const user = await this.getUserByClientId(clientId);
        if (user) {
          console.log(`[DB] Found user ${user.id} with clientId ${clientId}`);
          userId = user.id;
        } else {
          console.log(`[DB] No user found for clientId ${clientId}, creating one`);
          const newUser = await this.createOrUpdateClientUser(clientId);
          userId = newUser.id;
        }
      } catch (error) {
        console.error('[DB] Error finding/creating user for clientId:', error);
      }
    }
    
    if (!userId) {
      console.log('[DB] No userId available after clientId lookup, cannot reset city');
      throw new Error('User not found');
    }
    
    try {
      // Get all items for this city
      const cityItems = await db
        .select()
        .from(bingoItems)
        .where(eq(bingoItems.cityId, cityId));
        
      console.log(`[DB] Resetting ${cityItems.length} items in city ${cityId} for user ${userId}`);
      
      // Delete all user completions for this city
      await db
        .delete(userCompletions)
        .where(and(
          eq(userCompletions.userId, userId),
          sql`${userCompletions.itemId} IN (${sql.join(cityItems.map(item => sql`${item.id}`), sql`, `)})`
        ));
        
      console.log(`[DB] Successfully reset city ${cityId} for user ${userId}`);
    } catch (error) {
      console.error(`[DB] Error resetting city ${cityId}:`, error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();