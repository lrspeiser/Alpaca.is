import { useState, useCallback } from 'react';
import { 
  openPhotosDB, 
  getUserPhotoFromIndexedDB, 
  deleteUserPhotoFromIndexedDB 
} from '@/lib/utils';

/**
 * Hook for managing local photos in IndexedDB
 */
export const useLocalPhotos = () => {
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Deletes all photos for a specific city
   * @param cityId The city ID to delete photos for
   * @returns Promise resolving to the number of deleted photos
   */
  const deleteAllPhotosForCity = useCallback(async (cityId: string): Promise<number> => {
    console.log(`[PHOTOS] Deleting all photos for city ${cityId}`);
    setIsDeleting(true);
    
    try {
      const db = await openPhotosDB();
      
      return new Promise<number>((resolve, reject) => {
        const transaction = db.transaction(['userPhotos'], 'readwrite');
        const store = transaction.objectStore('userPhotos');
        const cityIndex = store.index('cityId');
        const request = cityIndex.getAllKeys(cityId);
        
        request.onsuccess = async () => {
          const keys = request.result;
          console.log(`[PHOTOS] Found ${keys.length} photos to delete for city ${cityId}`);
          
          let deletedCount = 0;
          
          // Process each key one by one
          for (const key of keys) {
            try {
              await deleteUserPhotoFromIndexedDB(cityId, key.toString().split('-')[1]);
              deletedCount++;
            } catch (error) {
              console.error(`[PHOTOS] Error deleting photo with key ${key}:`, error);
            }
          }
          
          console.log(`[PHOTOS] Successfully deleted ${deletedCount} photos for city ${cityId}`);
          resolve(deletedCount);
        };
        
        request.onerror = (event) => {
          console.error(`[PHOTOS] Error getting keys for city ${cityId}:`, event);
          reject(new Error(`Failed to get keys for city ${cityId}`));
        };
        
        transaction.oncomplete = () => {
          db.close();
        };
      });
    } catch (error) {
      console.error(`[PHOTOS] Error opening IndexedDB:`, error);
      return 0; // Return 0 deleted photos on error
    } finally {
      setIsDeleting(false);
    }
  }, []);

  /**
   * Deletes a specific photo
   * @param cityId The city ID
   * @param itemId The item ID
   * @returns Promise resolving to true if successful
   */
  const deletePhoto = useCallback(async (cityId: string, itemId: string): Promise<boolean> => {
    try {
      return await deleteUserPhotoFromIndexedDB(cityId, itemId);
    } catch (error) {
      console.error(`[PHOTOS] Error deleting photo for item ${itemId} in city ${cityId}:`, error);
      return false;
    }
  }, []);

  /**
   * Gets a photo from IndexedDB
   * @param cityId The city ID
   * @param itemId The item ID
   * @returns Promise resolving to photo data URL or null
   */
  const getPhoto = useCallback(async (cityId: string, itemId: string): Promise<string | null> => {
    try {
      return await getUserPhotoFromIndexedDB(cityId, itemId);
    } catch (error) {
      console.error(`[PHOTOS] Error getting photo for item ${itemId} in city ${cityId}:`, error);
      return null;
    }
  }, []);

  return {
    isDeleting,
    deleteAllPhotosForCity,
    deletePhoto,
    getPhoto
  };
};
