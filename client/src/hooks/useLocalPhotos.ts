import { useState, useCallback } from 'react';
import { 
  openPhotosDB, 
  saveUserPhotoToIndexedDB, 
  getUserPhotoFromIndexedDB, 
  PHOTOS_STORE 
} from '@/lib/utils';

/**
 * Hook for managing user photos in IndexedDB
 */
export const useLocalPhotos = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Save a photo to IndexedDB
   */
  const savePhoto = useCallback(async (
    cityId: string,
    itemId: string,
    photoDataUrl: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const success = await saveUserPhotoToIndexedDB(cityId, itemId, photoDataUrl);
      return success;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error saving photo');
      setError(error);
      console.error('Error saving photo:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get a photo from IndexedDB
   */
  const getPhoto = useCallback(async (
    cityId: string,
    itemId: string
  ): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const photo = await getUserPhotoFromIndexedDB(cityId, itemId);
      return photo;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error getting photo');
      setError(error);
      console.error('Error getting photo:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Delete all photos for a specific city
   */
  const deleteAllPhotosForCity = useCallback(async (cityId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const db = await openPhotosDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([PHOTOS_STORE], 'readwrite');
        const store = transaction.objectStore(PHOTOS_STORE);
        const index = store.index('cityId');
        
        const request = index.openCursor(IDBKeyRange.only(cityId));
        let deleteCount = 0;
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            // Delete this photo entry
            store.delete(cursor.primaryKey);
            deleteCount++;
            cursor.continue();
          }
        };
        
        transaction.oncomplete = () => {
          console.log(`[IndexedDB] Deleted ${deleteCount} photos for city ${cityId}`);
          db.close();
          resolve(true);
        };
        
        transaction.onerror = (event) => {
          console.error('Error deleting photos from IndexedDB:', event);
          db.close();
          reject(new Error('Failed to delete photos'));
        };
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error deleting photos');
      setError(error);
      console.error('Error deleting photos for city:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return {
    savePhoto,
    getPhoto,
    deleteAllPhotosForCity,
    isLoading,
    error
  };
};