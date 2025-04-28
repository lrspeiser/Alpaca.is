import migrateDatabase from './migrate';
import { log } from './vite';

// Run the migration
migrateDatabase()
  .then(() => {
    log('Migration completed successfully', 'migration');
    process.exit(0);
  })
  .catch(error => {
    log(`Migration failed: ${error}`, 'migration-error');
    process.exit(1);
  });