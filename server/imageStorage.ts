import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { log } from './vite';

// The directory where images will be stored
// Using public/images as primary and /tmp/images as fallback
let primaryImageDir = path.join(process.cwd(), 'public', 'images');
let fallbackImageDir = '/tmp/images';
let currentImageDir = primaryImageDir;

// Function to get the current image directory
export function getImageDir(): string {
  return currentImageDir;
}

// Function to set a new image directory
function setImageDir(dir: string): void {
  currentImageDir = dir;
  log(`[IMAGE-STORAGE] Image directory set to ${currentImageDir}`, 'image-storage');
}

// Ensure the image directory exists
function ensureImageDir() {
  const imgDir = getImageDir();
  if (!fs.existsSync(imgDir)) {
    try {
      fs.mkdirSync(imgDir, { recursive: true });
      log(`[IMAGE-STORAGE] Created image directory at ${imgDir}`, 'image-storage');
    } catch (error: any) {
      // In production, this might fail due to permissions
      log(`[IMAGE-STORAGE] Error creating image directory: ${error.message}`, 'image-storage');
      log(`[IMAGE-STORAGE] Will attempt to use /tmp/images as fallback`, 'image-storage');
      
      // Try to use /tmp as a fallback
      try {
        fs.mkdirSync(fallbackImageDir, { recursive: true });
        // Set the fallback directory as the current image directory
        setImageDir(fallbackImageDir);
        log(`[IMAGE-STORAGE] Successfully created fallback image directory at ${fallbackImageDir}`, 'image-storage');
      } catch (fallbackError: any) {
        log(`[IMAGE-STORAGE] Error creating fallback image directory: ${fallbackError.message}`, 'image-storage');
        throw error; // Throw the original error if fallback also fails
      }
    }
  }
}

/**
 * Generates a filename for an image based on its metadata
 * Exposed as an export to allow pre-creation of filenames before image generation
 */
export function generateImageFilename(cityId: string, itemId: string, itemText: string): string {
  // Create a consistent but unique filename based on the item details
  const hash = crypto
    .createHash('md5')
    .update(`${cityId}-${itemId}-${itemText}`)
    .digest('hex')
    .substring(0, 10);
  
  // Add timestamp to ensure uniqueness across multiple generations
  const timestamp = Date.now();
  
  return `${cityId}bingo-${itemId}-${timestamp}-${hash}.png`;
}

/**
 * Downloads and stores an image from a URL
 * Returns the local path to the stored image
 * 
 * This function attempts to save the image to both the primary image directory
 * and a fallback directory in /tmp for better availability in production
 * 
 * @throws Error if download or storage fails
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
    const localPath = path.join(getImageDir(), filename);
    
    // Check if we already have this image
    if (fs.existsSync(localPath)) {
      const fileSize = fs.statSync(localPath).size;
      log(`[IMAGE-STORAGE] Image already exists at ${localPath} (${fileSize} bytes)`, 'image-storage');
      console.log(`[DB-IMAGE] Reusing existing image for "${itemText}" in ${cityId} at path: ${localPath}`);
      return `/images/${filename}`;
    }
    
    // Special case: if the imageUrl is already a local path (starts with /images/), just copy it
    if (imageUrl.startsWith('/images/')) {
      log(`[IMAGE-STORAGE] Image URL is already local: ${imageUrl}`, 'image-storage');
      console.log(`[DB-IMAGE] Local image URL provided for "${itemText}" in ${cityId}: ${imageUrl}`);
      
      // Extract the source filename and path
      const sourceFilename = imageUrl.split('/').pop();
      if (!sourceFilename) {
        throw new Error('Invalid local image URL format');
      }
      
      const sourcePath = path.join(getImageDir(), sourceFilename);
      
      // Check if the source file exists
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source image does not exist at ${sourcePath}`);
      }
      
      // Copy the file (if source and destination are different)
      if (sourcePath !== localPath) {
        fs.copyFileSync(sourcePath, localPath);
        log(`[IMAGE-STORAGE] Copied image from ${sourcePath} to ${localPath}`, 'image-storage');
        console.log(`[DB-IMAGE] Copied image for "${itemText}" in ${cityId} from ${sourcePath} to ${localPath}`);
      }
      
      return `/images/${filename}`;
    }
    
    // Log URL starting point but truncate for privacy/security
    const loggableUrl = imageUrl.startsWith('data:') 
      ? `data:image (base64 data of length ${imageUrl.length})`
      : imageUrl.substring(0, 50) + '...';
    
    log(`[IMAGE-STORAGE] Downloading image from ${loggableUrl} for "${itemText}" in ${cityId}`, 'image-storage');
    console.log(`[DB-IMAGE] Starting download of image for "${itemText}" in ${cityId}`);
    
    let imageBuffer: Buffer;
    
    // Handle both URL and data URL formats
    if (imageUrl.startsWith('data:')) {
      // Extract base64 data from data URL
      const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new Error('Invalid data URL format');
      }
      
      // Convert base64 to buffer
      imageBuffer = Buffer.from(matches[2], 'base64');
      log(`[IMAGE-STORAGE] Extracted image data from data URL (${imageBuffer.length} bytes)`, 'image-storage');
    } else {
      // Fetch the image from URL with a generous timeout (30 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout
      
      try {
        const response = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; BingoAppProxy/1.0)',
          },
          signal: controller.signal,
        });
        
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
        }
        
        // Get the image data
        imageBuffer = await response.buffer();
        log(`[IMAGE-STORAGE] Downloaded image from URL (${imageBuffer.length} bytes)`, 'image-storage');
      } finally {
        clearTimeout(timeoutId); // Clean up the timeout
      }
    }
    
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Image data is empty');
    }
    
    // Make sure the directory exists
    ensureImageDir();
    
    // Save the image to disk
    fs.writeFileSync(localPath, imageBuffer);
    
    // Verify file was written successfully
    if (!fs.existsSync(localPath)) {
      throw new Error(`File was not created at ${localPath}`);
    }
    
    const fileSize = fs.statSync(localPath).size;
    if (fileSize === 0) {
      throw new Error(`File was created but is empty: ${localPath}`);
    }
    
    log(`[IMAGE-STORAGE] Successfully saved image to ${localPath} (${fileSize} bytes)`, 'image-storage');
    console.log(`[DB-IMAGE] Saved image for "${itemText}" in ${cityId} at path: ${localPath} (${fileSize} bytes)`);
    
    // Return the URL path to the image (relative to the server root)
    return `/images/${filename}`;
  } catch (error: any) {
    const errorMsg = `Error storing image for "${itemText}" in ${cityId}: ${error.message}`;
    log(`[IMAGE-STORAGE] ERROR: ${errorMsg}`, 'image-storage');
    console.error(`[DB-IMAGE] FAILED: ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

/**
 * Gets the local URL for an image based on item details
 * If the image doesn't exist locally, returns null
 */
export function getLocalImageUrl(cityId: string, itemId: string, itemText: string): string | null {
  const filename = generateImageFilename(cityId, itemId, itemText);
  const localPath = path.join(getImageDir(), filename);
  
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
 * @throws Error if image processing fails
 */
export async function processOpenAIImageUrl(
  imageUrl: string,
  cityId: string, 
  itemId: string, 
  itemText: string,
  forceNewImage: boolean = false,
  predefinedPath?: string // New parameter to use a predefined path
): Promise<string> {
  try {
    log(`[IMAGE-STORAGE] Processing image for "${itemText}" in ${cityId}`, 'image-storage');
    
    if (!forceNewImage) {
      // First check if we already have this image locally
      const existingUrl = getLocalImageUrl(cityId, itemId, itemText);
      if (existingUrl) {
        log(`[IMAGE-STORAGE] Using existing image at ${existingUrl} for "${itemText}"`, 'image-storage');
        return existingUrl;
      }
    }
    
    // If a predefined path is provided, use it directly
    if (predefinedPath && predefinedPath.startsWith('/images/')) {
      log(`[IMAGE-STORAGE] Using predefined path: ${predefinedPath} for "${itemText}"`, 'image-storage');
      
      // Extract the filename from the predefined path
      const predefinedFilename = predefinedPath.split('/').pop();
      if (!predefinedFilename) {
        throw new Error('Invalid predefined path format');
      }
      
      // Define the full path where the image will be saved
      const fullPath = path.join(getImageDir(), predefinedFilename);
      
      // Ensure the directory exists
      ensureImageDir();
      
      // Download and process the image data
      let imageBuffer: Buffer;
      
      // Handle both URL and data URL formats
      if (imageUrl.startsWith('data:')) {
        // Extract base64 data from data URL
        const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Invalid data URL format');
        }
        
        // Convert base64 to buffer
        imageBuffer = Buffer.from(matches[2], 'base64');
        log(`[IMAGE-STORAGE] Extracted image data from data URL (${imageBuffer.length} bytes)`, 'image-storage');
      } else {
        // Fetch the image from URL with a generous timeout (30 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout
        
        try {
          const response = await fetch(imageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; BingoAppProxy/1.0)',
            },
            signal: controller.signal,
          });
          
          if (!response.ok) {
            throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
          }
          
          // Get the image data
          imageBuffer = await response.buffer();
          log(`[IMAGE-STORAGE] Downloaded image from URL (${imageBuffer.length} bytes)`, 'image-storage');
        } finally {
          clearTimeout(timeoutId); // Clean up the timeout
        }
      }
      
      // Write the image to the predefined path
      fs.writeFileSync(fullPath, imageBuffer);
      
      // Verify file was written successfully
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File was not created at ${fullPath}`);
      }
      
      const fileSize = fs.statSync(fullPath).size;
      if (fileSize === 0) {
        throw new Error(`File was created but is empty: ${fullPath}`);
      }
      
      log(`[IMAGE-STORAGE] Successfully saved image to predefined path: ${fullPath} (${fileSize} bytes)`, 'image-storage');
      console.log(`[DB-IMAGE] Saved image for "${itemText}" in ${cityId} at predefined path: ${fullPath} (${fileSize} bytes)`);
      
      return predefinedPath;
    }
    
    // No predefined path, generate our own
    // Add a timestamp to make the filename unique for regenerated images
    const uniqueItemId = forceNewImage ? `${itemId}-${Date.now()}` : itemId;
    
    // Download and store the image with the potentially modified item ID
    const localUrl = await downloadAndStoreImage(imageUrl, cityId, uniqueItemId, itemText);
    
    if (!localUrl) {
      throw new Error(`Failed to generate local URL for image of "${itemText}"`);
    }
    
    // Verify the file was actually saved
    const filename = localUrl.split('/').pop();
    const fullPath = path.join(getImageDir(), filename || '');
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Image file does not exist at expected location: ${fullPath}`);
    }
    
    const fileSize = fs.statSync(fullPath).size;
    log(`[IMAGE-STORAGE] Verified image was saved at ${fullPath} (${fileSize} bytes)`, 'image-storage');
    
    return localUrl;
  } catch (error: any) {
    const errorMsg = `Failed to process and store image for "${itemText}" in ${cityId}: ${error.message}`;
    log(`[IMAGE-STORAGE] ERROR: ${errorMsg}`, 'image-storage');
    console.error(`[IMAGE-STORAGE] ERROR: ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

/**
 * Sets up static serving of the images directory
 */
export function setupImageServing(app: any) {
  // Ensure the image directory exists
  ensureImageDir();
  
  // Log the path where images will be served from
  log(`[IMAGE-STORAGE] Setting up static image serving from ${getImageDir()}`, 'image-storage');
  
  // Add middleware to log image requests
  app.use('/images', (req: any, res: any, next: any) => {
    // Log image requests for debugging
    log(`[IMAGE-STORAGE] Requested image: ${req.url}`, 'image-storage');
    next();
  });
  
  // Return the image directory path so the server can set up static serving
  return getImageDir();
}