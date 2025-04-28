// Database migration script to update schema for per-user bingo state
import { db } from './server/db.js';
import { users, bingoItems, cities, userCompletions } from './shared/schema.js';
import { sql } from 'drizzle-orm';

async function migrateDatabase() {
  console.log('Starting database migration...');
  
  // 1. First, alter the users table to add currentCity column
  try {
    console.log('Adding currentCity column to users table...');
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS current_city TEXT
    `);
  } catch (error) {
    console.error('Error adding currentCity to users table:', error);
  }
  
  // 2. Create the user_completions table if it doesn't exist
  try {
    console.log('Creating user_completions table...');
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
  } catch (error) {
    console.error('Error creating user_completions table:', error);
  }
  
  // 3. Populate user_completions from existing bingo_items
  try {
    console.log('Migrating completion data to user_completions table...');
    // First get all users
    const allUsers = await db.select().from(users);
    
    // Then get all completed items
    const completedItems = await db.select().from(bingoItems)
      .where(sql`completed = true`);
    
    console.log(`Found ${allUsers.length} users and ${completedItems.length} completed items`);
    
    // For each completed item, create a record for each user
    for (const user of allUsers) {
      console.log(`Processing user ${user.id} (client: ${user.clientId})`);
      for (const item of completedItems) {
        try {
          // Check if entry already exists
          const existing = await db.select()
            .from(userCompletions)
            .where(sql`user_id = ${user.id} AND item_id = ${item.id}`)
            .limit(1);
          
          if (existing.length === 0) {
            console.log(`Creating completion record for user ${user.id}, item ${item.id}`);
            await db.insert(userCompletions).values({
              userId: user.id,
              itemId: item.id,
              completed: true,
              userPhoto: item.userPhoto,
              completedAt: new Date().toISOString()
            });
          }
        } catch (itemError) {
          console.error(`Error processing item ${item.id} for user ${user.id}:`, itemError);
        }
      }
    }
  } catch (error) {
    console.error('Error migrating completion data:', error);
  }
  
  // 4. Rename isCurrentCity to isDefaultCity in cities table
  try {
    console.log('Updating cities table schema...');
    await db.execute(sql`
      ALTER TABLE cities 
      ADD COLUMN IF NOT EXISTS is_default_city BOOLEAN DEFAULT FALSE
    `);
    
    // Copy values from is_current_city to is_default_city
    await db.execute(sql`
      UPDATE cities
      SET is_default_city = is_current_city
      WHERE is_current_city = TRUE
    `);
  } catch (error) {
    console.error('Error updating cities table:', error);
  }
  
  // 5. Set current_city for all users based on current default city
  try {
    console.log('Setting current_city for all users...');
    // Find the default city
    const [defaultCity] = await db.select()
      .from(cities)
      .where(sql`is_default_city = TRUE`);
      
    if (defaultCity) {
      console.log(`Setting current city to ${defaultCity.id} for all users without a current city`);
      await db.execute(sql`
        UPDATE users
        SET current_city = ${defaultCity.id}
        WHERE current_city IS NULL
      `);
    } else {
      console.log('No default city found');
    }
  } catch (error) {
    console.error('Error setting current_city for users:', error);
  }
  
  console.log('Database migration completed!');
}

// Run the migration
migrateDatabase().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});