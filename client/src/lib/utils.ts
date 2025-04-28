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
