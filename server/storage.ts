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
import { initialBingoState } from "@client/data/cities";
import { BingoState } from "@client/types";

// modify the interface with any CRUD methods
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Bingo State Methods
  getBingoState(userId?: number): Promise<BingoState>;
  saveBingoState(state: BingoState, userId?: number): Promise<void>;
  
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
  
  async getBingoState(userId?: number): Promise<BingoState> {
    let state: BingoState;
    
    if (userId) {
      // Try to get state for this user
      const [dbState] = await db
        .select()
        .from(bingoState)
        .where(eq(bingoState.userId, userId));
      
      if (dbState) {
        // User has saved state
        return dbState.data as unknown as BingoState;
      }
    }
    
    // Default: return initial state if no saved state exists
    return initialBingoState;
  }
  
  async saveBingoState(state: BingoState, userId?: number): Promise<void> {
    // If we have a userId, save to database
    if (userId) {
      const [existingState] = await db
        .select()
        .from(bingoState)
        .where(eq(bingoState.userId, userId));
      
      if (existingState) {
        // Update existing state
        await db
          .update(bingoState)
          .set({ 
            currentCity: state.currentCity,
            data: state as any
          })
          .where(eq(bingoState.userId, userId));
      } else {
        // Insert new state
        await db
          .insert(bingoState)
          .values({
            userId,
            currentCity: state.currentCity,
            data: state as any
          });
      }
    }
  }
  
  async toggleItemCompletion(itemId: string, cityId: string, userId?: number): Promise<void> {
    // Get the current state
    const state = await this.getBingoState(userId);
    
    // Find the city and update the item
    if (state.cities[cityId]) {
      const city = state.cities[cityId];
      const itemIndex = city.items.findIndex(item => item.id === itemId);
      
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
      city.items = city.items.map(item => {
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
