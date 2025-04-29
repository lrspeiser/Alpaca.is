import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Local storage helpers
export const saveToLocalStorage = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

export const loadFromLocalStorage = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return fallback;
  }
};

/**
 * Generates a random client ID for user identification
 * @returns A unique client ID string
 */
export const generateClientId = (): string => {
  // Create a random string with timestamp to ensure uniqueness
  const timestamp = new Date().getTime();
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomPart}`;
};

/**
 * Retrieves the client ID from localStorage or generates a new one
 * @returns The client ID
 */
export const getClientId = (): string => {
  const CLIENT_ID_KEY = 'bingo_client_id';
  const existingClientId = localStorage.getItem(CLIENT_ID_KEY);
  
  if (existingClientId) {
    return existingClientId;
  }
  
  // Generate a new client ID if none exists
  const newClientId = generateClientId();
  localStorage.setItem(CLIENT_ID_KEY, newClientId);
  return newClientId;
};

/**
 * Save current city selection to localStorage
 * @param cityId The ID of the selected city
 */
export const saveCurrentCity = (cityId: string): void => {
  const CURRENT_CITY_KEY = 'bingo_current_city';
  localStorage.setItem(CURRENT_CITY_KEY, cityId);
};

/**
 * Get the most recently selected city from localStorage
 * @param defaultCity Fallback city ID if none is stored
 * @returns The stored or default city ID
 */
export const getSavedCurrentCity = (defaultCity: string): string => {
  const CURRENT_CITY_KEY = 'bingo_current_city';
  return localStorage.getItem(CURRENT_CITY_KEY) || defaultCity;
};

/**
 * IndexedDB utilities for storing and retrieving user photos
 */

// Constants for IndexedDB
export const DB_NAME = 'BingoPhotosDB';
export const DB_VERSION = 1;
export const PHOTOS_STORE = 'userPhotos';

/**
 * Opens the IndexedDB database for user photos
 * @returns Promise resolving to an open database connection
 */
export const openPhotosDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Error opening IndexedDB:', event);
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create the user photos object store if it doesn't exist
      if (!db.objectStoreNames.contains(PHOTOS_STORE)) {
        const store = db.createObjectStore(PHOTOS_STORE, { keyPath: 'id' });
        store.createIndex('cityId', 'cityId', { unique: false });
        store.createIndex('cityItem', ['cityId', 'itemId'], { unique: true });
        console.log('[IndexedDB] Created user photos store');
      }
    };
  });
};

/**
 * Interface for user photo objects stored in IndexedDB
 */
export interface UserPhoto {
  id: string;
  cityId: string;
  itemId: string;
  photoDataUrl: string;
  timestamp: number;
}

/**
 * Saves a user photo to IndexedDB
 * @param cityId The city ID
 * @param itemId The bingo item ID
 * @param photoDataUrl The photo as a data URL
 * @returns Promise resolving to true if successful
 */
export const saveUserPhotoToIndexedDB = async (
  cityId: string,
  itemId: string,
  photoDataUrl: string
): Promise<boolean> => {
  try {
    const db = await openPhotosDB();
    const id = `${cityId}-${itemId}`;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PHOTOS_STORE], 'readwrite');
      const store = transaction.objectStore(PHOTOS_STORE);
      
      const photo: UserPhoto = {
        id,
        cityId,
        itemId,
        photoDataUrl,
        timestamp: Date.now()
      };
      
      const request = store.put(photo);
      
      request.onsuccess = () => {
        console.log(`[IndexedDB] Saved photo for item ${itemId} in city ${cityId}`);
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error('Error saving photo to IndexedDB:', event);
        reject(new Error('Failed to save photo'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error in saveUserPhotoToIndexedDB:', error);
    return false;
  }
};

/**
 * Retrieves a user photo from IndexedDB
 * @param cityId The city ID
 * @param itemId The bingo item ID
 * @returns Promise resolving to the photo data URL or null if not found
 */
export const getUserPhotoFromIndexedDB = async (
  cityId: string,
  itemId: string
): Promise<string | null> => {
  try {
    const db = await openPhotosDB();
    const id = `${cityId}-${itemId}`;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PHOTOS_STORE], 'readonly');
      const store = transaction.objectStore(PHOTOS_STORE);
      
      const request = store.get(id);
      
      request.onsuccess = () => {
        const result = request.result as UserPhoto;
        if (result) {
          console.log(`[IndexedDB] Retrieved photo for item ${itemId} in city ${cityId}`);
          resolve(result.photoDataUrl);
        } else {
          console.log(`[IndexedDB] No photo found for item ${itemId} in city ${cityId}`);
          resolve(null);
        }
      };
      
      request.onerror = (event) => {
        console.error('Error retrieving photo from IndexedDB:', event);
        reject(new Error('Failed to retrieve photo'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error in getUserPhotoFromIndexedDB:', error);
    return null;
  }
};

/**
 * Deletes a user photo from IndexedDB
 * @param cityId The city ID
 * @param itemId The bingo item ID
 * @returns Promise resolving to true if successful
 */
export const deleteUserPhotoFromIndexedDB = async (
  cityId: string,
  itemId: string
): Promise<boolean> => {
  try {
    const db = await openPhotosDB();
    const id = `${cityId}-${itemId}`;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PHOTOS_STORE], 'readwrite');
      const store = transaction.objectStore(PHOTOS_STORE);
      
      const request = store.delete(id);
      
      request.onsuccess = () => {
        console.log(`[IndexedDB] Deleted photo for item ${itemId} in city ${cityId}`);
        resolve(true);
      };
      
      request.onerror = (event) => {
        console.error('Error deleting photo from IndexedDB:', event);
        reject(new Error('Failed to delete photo'));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error in deleteUserPhotoFromIndexedDB:', error);
    return false;
  }
};
