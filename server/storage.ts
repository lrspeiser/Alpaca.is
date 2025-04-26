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
            { id: 'prague-1', text: 'Eat a Trdelník', completed: false },
            { id: 'prague-2', text: 'Walk Charles Bridge at sunrise', completed: false },
            { id: 'prague-3', text: 'See the Astronomical Clock ring', completed: false },
            { id: 'prague-4', text: 'Drink a Pilsner Urquell', completed: false },
            { id: 'prague-5', text: 'Take a photo with John Lennon Wall', completed: false },
            { id: 'prague-6', text: 'Climb Petrin Tower', completed: false },
            { id: 'prague-7', text: 'Eat traditional Svíčková', completed: false },
            { id: 'prague-8', text: 'Ride a historic tram', completed: false },
            { id: 'prague-9', text: 'Buy a puppet or marionette', completed: false },
            { id: 'prague-10', text: 'Visit Prague Castle', completed: false },
            { id: 'prague-11', text: 'Try Becherovka (Herbal Liquor)', completed: false },
            { id: 'prague-12', text: 'See the Dancing House', completed: false },
            { id: 'prague-13', text: 'Arrive in Prague', completed: false, isCenterSpace: true, description: 'Welcome to the beautiful city of Prague! Known as the "City of a Hundred Spires," this historic capital of the Czech Republic is famous for its Old Town Square, Prague Castle, and Charles Bridge.' },
            { id: 'prague-14', text: 'Visit Old Jewish Cemetery', completed: false },
            { id: 'prague-15', text: 'Listen to live jazz at a bar', completed: false },
            { id: 'prague-16', text: 'Touch the St. John of Nepomuk statue', completed: false },
            { id: 'prague-17', text: 'Eat Goulash in bread bowl', completed: false },
            { id: 'prague-18', text: 'Cross Legií Bridge', completed: false },
            { id: 'prague-19', text: 'Visit the National Museum', completed: false },
            { id: 'prague-20', text: 'Buy Bohemian crystal souvenir', completed: false },
            { id: 'prague-21', text: 'Watch sunset from Letná Park', completed: false },
            { id: 'prague-22', text: 'Tour a beer spa', completed: false },
            { id: 'prague-23', text: 'Eat a sausage from Wenceslas Square', completed: false },
            { id: 'prague-24', text: 'Find the narrowest street in Prague', completed: false },
            { id: 'prague-25', text: 'Explore Vyšehrad fortress', completed: false }
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
    
    if (userId) {
      // Try to get state for this user
      const [dbState] = await db
        .select()
        .from(bingoState)
        .where(eq(bingoState.userId, userId));
      
      if (dbState) {
        // User has saved state
        return dbState.data as unknown as BingoStateType;
      }
    }
    
    // Default: return initial state if no saved state exists
    return initialState;
  }
  
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
    
    // For in-memory storage, we just replace the state completely
    // This ensures we always have the latest data
    
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
