// Database migration script to update schema for per-user bingo state
import { db } from './db';
import { users, bingoItems, cities, userCompletions } from '../shared/schema';
import { sql } from 'drizzle-orm';
import { log } from './vite';

async function migrateDatabase() {
  log('Starting database migration...', 'migration');
  
  // 1. First, alter the users table to add currentCity column
  try {
    log('Adding currentCity column to users table...', 'migration');
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS current_city TEXT
    `);
    log('Added currentCity column to users table', 'migration');
  } catch (error) {
    log(`Error adding currentCity to users table: ${error}`, 'migration-error');
  }
  
  // 2. Create the user_completions table if it doesn't exist
  try {
    log('Creating user_completions table...', 'migration');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_completions (
        user_id INTEGER NOT NULL REFERENCES users(id),
        item_id TEXT NOT NULL REFERENCES bingo_items(id),
        completed BOOLEAN NOT NULL DEFAULT TRUE,
        user_photo TEXT,
        completed_at TEXT,
        PRIMARY KEY (user_id, item_id)
      )
    `);
    log('Created user_completions table', 'migration');
  } catch (error) {
    log(`Error creating user_completions table: ${error}`, 'migration-error');
  }
  
  // 3. Migrate all existing "completed" bingo items to user_completions
  try {
    log('Migrating completion data to user_completions table...', 'migration');
    
    // First get all users
    const allUsers = await db.select().from(users);
    log(`Found ${allUsers.length} users`, 'migration');
    
    // Then get all completed items
    const completedItems = await db
      .select()
      .from(bingoItems)
      .where(sql`completed = true`);
    
    log(`Found ${completedItems.length} completed items to migrate`, 'migration');
    
    // For each completed item, create a record for each user
    for (const user of allUsers) {
      log(`Processing user ${user.id} (client: ${user.clientId})`, 'migration');
      for (const item of completedItems) {
        try {
          // Check if entry already exists
          const existing = await db.select()
            .from(userCompletions)
            .where(sql`user_id = ${user.id} AND item_id = ${item.id}`)
            .limit(1);
          
          if (existing.length === 0) {
            log(`Creating completion record for user ${user.id}, item ${item.id}`, 'migration');
            await db.insert(userCompletions).values({
              userId: user.id,
              itemId: item.id,
              completed: true,
              userPhoto: item.userPhoto as string | undefined,
              completedAt: new Date().toISOString()
            });
          }
        } catch (itemError) {
          log(`Error processing item ${item.id} for user ${user.id}: ${itemError}`, 'migration-error');
        }
      }
    }
    
    log('Completed migration of completion data', 'migration');
  } catch (error) {
    log(`Error migrating completion data: ${error}`, 'migration-error');
  }
  
  // 4. Add isDefaultCity column to cities table
  try {
    log('Updating cities table schema...', 'migration');
    await db.execute(sql`
      ALTER TABLE cities 
      ADD COLUMN IF NOT EXISTS is_default_city BOOLEAN DEFAULT FALSE
    `);
    
    // Copy values from is_current_city to is_default_city if it exists
    try {
      await db.execute(sql`
        UPDATE cities
        SET is_default_city = is_current_city
        WHERE is_current_city = TRUE
      `);
      log('Copied values from is_current_city to is_default_city', 'migration');
    } catch (columnError) {
      log(`is_current_city column may not exist, skipping copy: ${columnError}`, 'migration-warning');
    }
    
    log('Updated cities table schema', 'migration');
  } catch (error) {
    log(`Error updating cities table: ${error}`, 'migration-error');
  }
  
  // 5. Set current_city for all users based on current default city
  try {
    log('Setting current_city for all users...', 'migration');
    // Find the default city
    const defaultCities = await db.select()
      .from(cities)
      .where(sql`is_default_city = TRUE`);
      
    if (defaultCities.length > 0) {
      const defaultCity = defaultCities[0];
      log(`Setting current city to ${defaultCity.id} for all users without a current city`, 'migration');
      await db.execute(sql`
        UPDATE users
        SET current_city = ${defaultCity.id}
        WHERE current_city IS NULL
      `);
      log('Updated users current_city', 'migration');
    } else {
      // If no default city, try to use any city
      const anyCities = await db.select().from(cities).limit(1);
      if (anyCities.length > 0) {
        const anyCity = anyCities[0];
        log(`No default city found, using ${anyCity.id} as fallback`, 'migration');
        await db.execute(sql`
          UPDATE users
          SET current_city = ${anyCity.id}
          WHERE current_city IS NULL
        `);
        log('Updated users current_city with fallback', 'migration');
      } else {
        log('No cities found in database, skipping user current_city update', 'migration-warning');
      }
    }
  } catch (error) {
    log(`Error setting current_city for users: ${error}`, 'migration-error');
  }
  
  log('Database migration completed!', 'migration');
}

// Export the migration function
export default migrateDatabase;