import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { log } from './vite';

// The directory where images will be stored
let currentImageDir = path.join(process.cwd(), 'public', 'images');

// Function to get the current image directory
function getImageDir(): string {
  return currentImageDir;
}

// Function to set a new image directory
function setImageDir(dir: string): void {
  currentImageDir = dir;
}

// Ensure the image directory exists
function ensureImageDir() {
  if (!fs.existsSync(IMAGE_DIR)) {
    try {
      fs.mkdirSync(currentImageDir, { recursive: true });
      log(`[IMAGE-STORAGE] Created image directory at ${currentImageDir}`, 'image-storage');
    } catch (error: any) {
      // In production, this might fail due to permissions
      log(`[IMAGE-STORAGE] Error creating image directory: ${error.message}`, 'image-storage');
      log(`[IMAGE-STORAGE] Will attempt to use /tmp/images as fallback`, 'image-storage');
      
      // Try to use /tmp as a fallback
      try {
        const tmpImageDir = '/tmp/images';
        fs.mkdirSync(tmpImageDir, { recursive: true });
        // Override the IMAGE_DIR constant - this is technically not allowed in TypeScript
        // but we need to do this for the fallback to work
        setImageDir(tmpImageDir);
        log(`[IMAGE-STORAGE] Successfully created fallback image directory at ${tmpImageDir}`, 'image-storage');
      } catch (fallbackError: any) {
        log(`[IMAGE-STORAGE] Error creating fallback image directory: ${fallbackError.message}`, 'image-storage');
        throw error; // Throw the original error if fallback also fails
      }
    }
  }
}

/**
 * Generates a filename for an image based on its metadata
 */
function generateImageFilename(cityId: string, itemId: string, itemText: string): string {
  // Create a consistent but unique filename based on the item details
  const hash = crypto
    .createHash('md5')
    .update(`${cityId}-${itemId}-${itemText}`)
    .digest('hex')
    .substring(0, 10);
  
  return `${cityId}-${itemId}-${hash}.png`;
}

/**
 * Downloads and stores an image from a URL
 * Returns the local path to the stored image
 * 
 * This function attempts to save the image to both the primary image directory
 * and a fallback directory in /tmp for better availability in production
 */
export async function downloadAndStoreImage(
  imageUrl: string, 
  cityId: string, 
  itemId: string, 
  itemText: string
): Promise<string> {
  try {
    // Generate a filename for the image
    const filename = generateImageFilename(cityId, itemId, itemText);
    const localPath = path.join(IMAGE_DIR, filename);
    
    // Check if we already have this image
    if (fs.existsSync(localPath)) {
      log(`[IMAGE-STORAGE] Image already exists at ${localPath}`, 'image-storage');
      return `/images/${filename}`;
    }
    
    log(`[IMAGE-STORAGE] Downloading image from ${imageUrl.substring(0, 50)}...`, 'image-storage');
    
    // Fetch the image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BingoAppProxy/1.0)',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    
    // Get the image data
    const imageBuffer = await response.buffer();
    
    // Make sure the directory exists
    ensureImageDir();
    
    // Save the image to disk
    fs.writeFileSync(localPath, imageBuffer);
    
    log(`[IMAGE-STORAGE] Saved image to ${localPath} (${imageBuffer.length} bytes)`, 'image-storage');
    
    // Return the URL path to the image (relative to the server root)
    return `/images/${filename}`;
  } catch (error: any) {
    log(`[IMAGE-STORAGE] Error storing image: ${error.message}`, 'image-storage');
    throw error;
  }
}

/**
 * Gets the local URL for an image based on item details
 * If the image doesn't exist locally, returns null
 */
export function getLocalImageUrl(cityId: string, itemId: string, itemText: string): string | null {
  const filename = generateImageFilename(cityId, itemId, itemText);
  const localPath = path.join(IMAGE_DIR, filename);
  
  if (fs.existsSync(localPath)) {
    return `/images/${filename}`;
  }
  
  return null;
}

/**
 * Processes an OpenAI image URL to store it locally and returns the local URL
 * 
 * @param imageUrl The URL of the OpenAI image
 * @param cityId The ID of the city
 * @param itemId The ID of the item
 * @param itemText The text of the item
 * @param forceNewImage If true, generates a new image even if one exists
 * @returns The local URL of the stored image
 */
export async function processOpenAIImageUrl(
  imageUrl: string,
  cityId: string, 
  itemId: string, 
  itemText: string,
  forceNewImage: boolean = false
): Promise<string> {
  if (!forceNewImage) {
    // First check if we already have this image locally
    const existingUrl = getLocalImageUrl(cityId, itemId, itemText);
    if (existingUrl) {
      return existingUrl;
    }
  }
  
  // Add a timestamp to make the filename unique for regenerated images
  const uniqueItemId = forceNewImage ? `${itemId}-${Date.now()}` : itemId;
  
  // Download and store the image with the potentially modified item ID
  return await downloadAndStoreImage(imageUrl, cityId, uniqueItemId, itemText);
}

/**
 * Sets up static serving of the images directory
 */
export function setupImageServing(app: any) {
  // Ensure the image directory exists
  ensureImageDir();
  
  // Log the path where images will be served from
  log(`[IMAGE-STORAGE] Setting up static image serving from ${IMAGE_DIR}`, 'image-storage');
  
  // Add middleware to log image requests
  app.use('/images', (req: any, res: any, next: any) => {
    // Log image requests for debugging
    log(`[IMAGE-STORAGE] Requested image: ${req.url}`, 'image-storage');
    next();
  });
  
  // Return the image directory path so the server can set up static serving
  return IMAGE_DIR;
}