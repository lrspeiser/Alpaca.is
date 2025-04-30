import type { Express, Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { generateBulkDescriptions, generateItemDescription } from "./openai";
import { generateBingoItems, generateItemImage, generateStyleGuide } from "./generator";
import { updateCityMetadata, repairMissingImages, updateImagePathsFromDisk } from "./updateCityMetadata";
import { log } from "./vite";
import { setupImageProxy } from "./imageProxy";
import { setupImageServing, processOpenAIImageUrl } from "./imageStorage";
import * as fs from 'fs';
import * as path from 'path';
import { db } from "./db";
import { eq, inArray } from "drizzle-orm";
import { cities, bingoItems, userCompletions } from "@shared/schema";

// Track in-progress image generations to prevent duplicates
const inProgressImageGenerations = new Map<string, number>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up image proxy for handling OpenAI image URLs
  setupImageProxy(app);
  
  // Add a placeholder image endpoint
  app.get('/api/placeholder-image', (req, res) => {
    const text = req.query.text || 'No image';
    const reason = req.query.reason || 'Unknown reason';
    
    // Create a more informative SVG placeholder
    const svg = `
      <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <rect x="10" y="10" width="280" height="280" fill="#fcfcfc" stroke="#ddd" stroke-width="1"/>
        
        <!-- Camera icon with slash (indicating image unavailable) -->
        <g transform="translate(150, 120)" fill="none" stroke="#888" stroke-width="3">
          <circle cx="0" cy="0" r="35"/>
          <circle cx="0" cy="0" r="15"/>
          <line x1="-30" y1="-30" x2="30" y2="30" stroke="#d32f2f" stroke-width="4"/>
        </g>
        
        <!-- Text for primary message -->
        <text x="50%" y="190" font-family="Arial" font-size="16" fill="#555" text-anchor="middle">${text}</text>
        
        <!-- Text for reason (smaller) -->
        <text x="50%" y="215" font-family="Arial" font-size="12" fill="#777" text-anchor="middle">${reason}</text>
        
        <!-- Try again message -->
        <text x="50%" y="240" font-family="Arial" font-size="12" fill="#2196f3" text-anchor="middle">Try again later</text>
      </svg>
    `;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  });

  // Set up image serving
  try {
    // Set up primary static route for images from public directory
    const imageDir = setupImageServing(app);
    
    // Set up static serving for the images directory
    app.use('/images', express.static(imageDir));
    
    // Add a fallback for missing images
    app.use('/images/:filename', (req, res) => {
      // If we got here, the image wasn't found
      log(`[IMAGE-FALLBACK] Image not found: ${req.params.filename}, using fallback`, 'image-fallback');
      
      // Send a placeholder image or redirect to a default image
      res.redirect('/api/placeholder-image?text=' + encodeURIComponent('Image not available') + 
                   '&reason=' + encodeURIComponent('The requested image file could not be found on the server'));
    });
  } catch (error) {
    log(`[IMAGE-ERROR] Failed to set up image serving: ${error.message}`, 'error');
    // Continue anyway, the app should still work without images
  }
  // Register a client ID for persistent user state without login
  app.post("/api/register-client", async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    try {
      const { clientId } = req.body;
      
      if (!clientId) {
        console.log(`[USER ERROR] Client registration attempt without ID from IP: ${requestIP}`);
        return res.status(400).json({ 
          success: false, 
          error: "Client ID is required" 
        });
      }
      
      // Enhanced logging about new connections
      console.log(`[USER CONNECT] New client ${clientId} from IP: ${requestIP}`);
      console.log(`[USER DEVICE] Client ${clientId} using: ${req.headers['user-agent']}`);
      
      // Register the client ID or update if it exists
      const user = await storage.createOrUpdateClientUser(clientId);
      
      // Log success with timing information
      const processingTime = Date.now() - startTime;
      console.log(`[USER REGISTERED] Client ${clientId} registered as user ${user.id} in ${processingTime}ms`);
      console.log(`[USER HISTORY] Client ${clientId} previous visit: ${user.lastVisitedAt || 'First visit'}`);
      
      return res.json({ 
        success: true, 
        userId: user.id,
        clientId: user.clientId,
        lastVisitedAt: user.lastVisitedAt
      });
    } catch (error) {
      console.error("[ERROR] Failed to register client:", error);
      console.log(`[ERROR DETAILS] Request from IP ${requestIP}, processing time: ${Date.now() - startTime}ms`);
      return res.status(500).json({ 
        success: false, 
        error: "Failed to register client" 
      });
    }
  });
  
  // Get the current bingo state
  app.get("/api/bingo-state", async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    try {
      // Check for clientId in query parameters or headers
      let clientId = req.query.clientId as string | undefined;
      
      // Also check headers for clientId (for non-GET requests or when not in query)
      if (!clientId && req.headers['x-client-id']) {
        clientId = req.headers['x-client-id'] as string;
      }
      
      console.log(`[USER ACTIVITY] Client ${clientId || 'unknown'} from ${requestIP} requested bingo state`);
      console.log(`[USER REFERRER] Page context: ${req.headers.referer || 'direct navigation'}`);
      
      // Get bingo state using clientId if available
      const state = await storage.getBingoState(undefined, clientId);
      
      // Log summary of the state being sent to client
      const citySummary = Object.keys(state.cities).map(cityId => {
        const city = state.cities[cityId];
        return {
          id: city.id,
          title: city.title,
          itemCount: city.items.length,
          itemsWithDescriptions: city.items.filter((item: any) => !!item.description).length,
          itemsWithImages: city.items.filter((item: any) => !!item.image).length
        };
      });
      
      // Calculate completion statistics for the current city if available
      if (state.currentCity && state.cities[state.currentCity]) {
        const currentCity = state.cities[state.currentCity];
        const totalItems = currentCity.items.length;
        const completedItems = currentCity.items.filter((item: any) => item.completed).length;
        const completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
        
        console.log(`[USER PROGRESS] Client ${clientId || 'unknown'} has completed ${completedItems}/${totalItems} (${completionPercentage}%) items in ${currentCity.title}`);
      }
      
      // Log the size of the response data to monitor payload sizes
      const responseSize = JSON.stringify(state).length;
      const processingTime = Date.now() - startTime;
      
      console.log(`[PERFORMANCE] Bingo state retrieved for client ${clientId || 'unknown'} in ${processingTime}ms, response size: ${responseSize} bytes`);
      log(`[SERVER] Sending bingo state to client: current city=${state.currentCity}, cities=${JSON.stringify(citySummary)}`, 'state');
      
      res.json(state);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[SERVER ERROR] Error fetching bingo state for ${clientId || 'unknown'} after ${processingTime}ms:`, error);
      console.log(`[ERROR DETAILS] Request from IP ${requestIP}, client ${clientId || 'unknown'}`);
      res.status(500).json({ error: "Failed to fetch bingo state" });
    }
  });

  // Save the bingo state
  app.post("/api/bingo-state", async (req: Request, res: Response) => {
    try {
      const { state, clientId } = req.body;
      
      // Validate required fields in state object
      if (!state || typeof state !== 'object') {
        return res.status(400).json({ error: "Invalid state object" });
      }
      
      if (!state.currentCity || typeof state.currentCity !== 'string') {
        return res.status(400).json({ error: "Missing or invalid currentCity field" });
      }
      
      if (!state.cities || typeof state.cities !== 'object') {
        return res.status(400).json({ error: "Missing or invalid cities object" });
      }
      
      // For just changing the current city, the cities object might be empty/array
      // Let's get the current state and merge with the new current city
      if (Array.isArray(state.cities) || Object.keys(state.cities).length === 0) {
        console.log("[SERVER] Detected city change request with empty cities object");
        
        // Get the current state first
        const currentState = await storage.getBingoState(undefined, clientId);
        
        // Only update the current city field, keep the rest as is
        const mergedState = {
          ...currentState,
          currentCity: state.currentCity
        };
        
        // Save the merged state
        console.log(`[SERVER] Updating current city to ${state.currentCity} for client ${clientId || 'anonymous'}`);
        await storage.saveBingoState(mergedState, undefined, clientId);
        return res.json({ success: true });
      }
      
      // If we get here, we have a full state object to save - log summary
      try {
        const citySummary = Object.keys(state.cities).map(cityId => {
          const city = state.cities[cityId];
          return {
            id: city.id,
            title: city.title,
            itemCount: city.items.length,
            itemsWithDescriptions: city.items.filter((item: any) => !!item.description).length,
            itemsWithImages: city.items.filter((item: any) => !!item.image).length
          };
        });
        
        log(`[SERVER] Saving bingo state for client ${clientId || 'anonymous'}: current city=${state.currentCity}, cities=${JSON.stringify(citySummary)}`, 'state');
      } catch (summaryError) {
        console.error("[SERVER] Error creating city summary, continuing with save:", summaryError);
      }
      
      // Save state using clientId if available
      await storage.saveBingoState(state, undefined, clientId);
      res.json({ success: true });
    } catch (error) {
      console.error("[SERVER] Error saving bingo state:", error);
      res.status(500).json({ error: "Failed to save bingo state" });
    }
  });

  // Toggle completion status of a bingo item
  app.post("/api/toggle-item", async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    try {
      const schema = z.object({
        itemId: z.string(),
        cityId: z.string(),
        clientId: z.string().optional(),
        forcedState: z.boolean().optional(), // Add support for forcing a specific state
        userPhoto: z.string().optional()     // Optional user photo in base64 format
      });
      
      const validatedData = schema.parse(req.body);
      const { itemId, cityId, clientId, forcedState, userPhoto } = validatedData;
      
      // Get state to retrieve item text for better logging
      const state = await storage.getBingoState(undefined, clientId);
      let itemText = "Unknown item";
      let itemType = "regular";
      
      if (state.cities[cityId] && state.cities[cityId].items) {
        const item = state.cities[cityId].items.find((it: any) => it.id === itemId);
        if (item) {
          itemText = item.text;
          itemType = item.isCenterSpace ? "center space" : "regular";
        }
      }
      
      console.log(`[USER ACTION] Client ${clientId || 'unknown'} from ${requestIP} ${forcedState ? 'marked' : 'toggled'} ${itemType} item "${itemText}" (${itemId}) in ${cityId}`);
      
      if (userPhoto) {
        console.log(`[USER PHOTO] Client ${clientId || 'unknown'} submitted a photo for item "${itemText}" (${itemId})`);
      }
      
      // Use clientId if provided and pass the forcedState parameter
      await storage.toggleItemCompletion(itemId, cityId, undefined, clientId, forcedState);
      
      const processingTime = Date.now() - startTime;
      console.log(`[PERFORMANCE] Item toggle processed in ${processingTime}ms for client ${clientId || 'unknown'}`);
      
      res.json({ success: true });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[SERVER ERROR] Error toggling item completion after ${processingTime}ms:`, error);
      console.log(`[ERROR DETAILS] Request from IP ${requestIP}, client ${(req.body && req.body.clientId) || 'unknown'}`);
      
      res.status(500).json({ error: "Failed to toggle item completion" });
    }
  });

  // Reset all items for a city
  app.post("/api/reset-city", async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    try {
      const schema = z.object({
        cityId: z.string(),
        clientId: z.string().optional()
      });
      
      const validatedData = schema.parse(req.body);
      const { cityId, clientId } = validatedData;
      
      // Get state to retrieve city name for better logging
      const state = await storage.getBingoState(undefined, clientId);
      let cityName = cityId;
      
      if (state.cities[cityId]) {
        cityName = state.cities[cityId].title;
      }
      
      console.log(`[USER ACTION] Client ${clientId || 'unknown'} from ${requestIP} is resetting progress for city "${cityName}" (${cityId})`);
      
      // Use clientId if provided
      await storage.resetCity(cityId, undefined, clientId);
      
      const processingTime = Date.now() - startTime;
      console.log(`[PERFORMANCE] City reset processed in ${processingTime}ms for client ${clientId || 'unknown'}`);
      
      res.json({ success: true });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[SERVER ERROR] Error resetting city after ${processingTime}ms:`, error);
      console.log(`[ERROR DETAILS] Request from IP ${requestIP}, client ${(req.body && req.body.clientId) || 'unknown'}`);
      
      res.status(500).json({ error: "Failed to reset city" });
    }
  });

  // Generate OpenAI descriptions for all items in a city
  app.post("/api/generate-descriptions", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        cityId: z.string(),
        clientId: z.string().optional()
      });
      
      const validatedData = schema.parse(req.body);
      const { cityId, clientId } = validatedData;
      
      // Get the current state
      const state = await storage.getBingoState();
      const city = state.cities[cityId];
      
      if (!city) {
        return res.status(404).json({ error: `City ${cityId} not found` });
      }
      
      // Map the items to the format expected by generateBulkDescriptions
      const items = city.items.map(item => ({
        id: item.id,
        text: item.text
      }));
      
      log(`Generating descriptions for ${items.length} items in ${cityId}`, 'ai-generation');
      
      // Generate descriptions
      const descriptions = await generateBulkDescriptions(items, city.title);
      
      // Update the items with the new descriptions
      const updatedCity = {
        ...city,
        items: city.items.map(item => ({
          ...item,
          description: descriptions[item.id] || item.description
        }))
      };
      
      // Update the state
      const updatedState = {
        ...state,
        cities: {
          ...state.cities,
          [cityId]: updatedCity
        }
      };
      
      // Save the updated state with clientId if provided
      await storage.saveBingoState(updatedState, undefined, clientId);
      
      res.json({ 
        success: true, 
        message: `Generated descriptions for ${Object.keys(descriptions).length} items in ${city.title}`
      });
    } catch (error) {
      console.error("Error generating descriptions:", error);
      res.status(500).json({ error: "Failed to generate descriptions" });
    }
  });

  // Generate new bingo items for a city
  app.post("/api/generate-items", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        cityId: z.string(),
        clientId: z.string().optional()
      });
      
      const validatedData = schema.parse(req.body);
      const { cityId, clientId } = validatedData;
      
      // Get the current state
      const state = await storage.getBingoState();
      const city = state.cities[cityId];
      
      if (!city) {
        return res.status(404).json({ error: `City ${cityId} not found` });
      }
      
      log(`Generating bingo items for ${cityId}`, 'ai-generation');
      
      // Generate bingo items
      const items = await generateBingoItems(cityId, city.title);
      
      if (items.length === 0) {
        return res.status(500).json({ error: "Failed to generate bingo items" });
      }
      
      res.json({ 
        success: true, 
        items: items,
        message: `Generated ${items.length} bingo items for ${city.title}`
      });
    } catch (error) {
      console.error("Error generating bingo items:", error);
      res.status(500).json({ error: "Failed to generate bingo items" });
    }
  });
  
  // Create a new city with full automated generation
  app.post("/api/create-city", async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    try {
      // Validate input - we only need cityId and cityName (plus optional clientId)
      const schema = z.object({
        id: z.string(),
        name: z.string(),
        clientId: z.string().optional()
      });
      
      const validatedData = schema.parse(req.body);
      // Map the field names to our internal naming
      const cityId = validatedData.id;
      const cityName = validatedData.name;
      const clientId = validatedData.clientId;
      
      console.log(`[USER ACTION] Client ${validatedData.clientId || 'unknown'} from ${requestIP} is creating new city "${cityName}" (${cityId})`);
      console.log(`[USER DEVICE] Client ${validatedData.clientId || 'unknown'} using: ${req.headers['user-agent']}`);
      
      log(`Creating new city: ${cityName} (${cityId})`, 'city-creation');
      
      // Get the current bingo state
      // Use clientId if available to help track the city creation
      const state = clientId 
        ? await storage.getBingoState(undefined, clientId)
        : await storage.getBingoState();
      
      // Check if city already exists
      if (state.cities[cityId]) {
        return res.status(400).json({ 
          error: `City with ID ${cityId} already exists`,
          cityId: cityId
        });
      }
      
      // STEP 1: Generate style guide for the city
      log(`Generating style guide for ${cityName}...`, 'city-creation');
      const styleGuide = await generateStyleGuide(cityName);
      
      // STEP 2: Create basic city structure
      const newCity = {
        id: cityId,
        title: `${cityName} Bingo`,
        subtitle: `College Student Edition`,
        styleGuide: styleGuide, // Add the style guide to the city data
        items: [],
        tips: []
      };
      
      // STEP 2: Generate bingo items
      log(`Generating bingo items for ${cityName}...`, 'city-creation');
      const bingoItems = await generateBingoItems(cityId, cityName);
      
      if (bingoItems.length === 0) {
        return res.status(500).json({ error: "Failed to generate bingo items" });
      }
      
      // Add a center "Arrive in City" item
      const centerItem = {
        id: `${cityId}-center`,
        text: `Arrive in ${cityName}`,
        completed: false,
        isCenterSpace: true,
        description: `Welcome to ${cityName}! Check this off as soon as you arrive to start your bingo adventure.`,
        gridRow: 2, // 0-based, so this is the middle row (3rd row)
        gridCol: 2,  // 0-based, so this is the middle column (3rd column)
        cityId: cityId, // Reference to the city this item belongs to
        image: null,
        userPhoto: null
      };
      
      // Create a 5x5 grid with the center item
      const allItems = [...bingoItems];
      allItems.splice(12, 0, centerItem); // Insert at position 12 (middle of 0-24)
      
      // Assign grid positions to all items
      for (let i = 0; i < allItems.length; i++) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        
        // Skip setting position for center item as it's already set
        if (!(row === 2 && col === 2)) {
          allItems[i].gridRow = row;
          allItems[i].gridCol = col;
        }
      }
      
      // Update city with items
      newCity.items = allItems;
      
      // STEP 3: Generate descriptions for all items
      log(`Generating descriptions for ${allItems.length} items...`, 'city-creation');
      
      // Prepare items for bulk description generation
      const itemsForDescription = allItems
        .filter(item => !item.isCenterSpace) // Skip center item as it already has a description
        .map(item => ({ 
          id: item.id, 
          text: item.text 
        }));
      
      // Generate descriptions in bulk
      const descriptions = await generateBulkDescriptions(itemsForDescription, cityName);
      
      // Update items with descriptions
      newCity.items = newCity.items.map(item => {
        if (item.isCenterSpace) return item;
        return {
          ...item,
          description: descriptions[item.id] || ""
        };
      });
      
      // STEP 4: Add the new city to the state
      const updatedState = {
        ...state,
        cities: {
          ...state.cities,
          [cityId]: newCity
        }
      };
      
      // If this is the first city, make it the current city
      if (Object.keys(state.cities).length === 0) {
        updatedState.currentCity = cityId;
      }
      
      // Save the updated state with clientId if provided
      await storage.saveBingoState(updatedState, undefined, clientId);
      
      log(`Successfully created city ${cityName} with ${newCity.items.length} items and descriptions`, 'city-creation');
      
      // Start image generation in the background
      process.nextTick(async () => {
        try {
          log(`Starting background image generation for ${cityName}...`, 'city-creation');
          // Include ALL items including the center space ("Arrive in <cityName>")
          const itemsWithDescriptions = newCity.items
            .map(item => ({
              id: item.id,
              text: item.text,
              description: item.description,
              isCenterSpace: item.isCenterSpace // Include this flag for special handling if needed
            }));
          
          // Process images in batches of 3 with delays to avoid rate limiting
          const batchSize = 3;
          const batches = [];
          
          for (let i = 0; i < itemsWithDescriptions.length; i += batchSize) {
            batches.push(itemsWithDescriptions.slice(i, i + batchSize));
          }
          
          log(`Will process images in ${batches.length} batches of up to ${batchSize} images each`, 'city-creation');
          
          // Track progress
          let completedImages = 0;
          let failedImages = 0;
          
          for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            log(`Processing batch ${i+1}/${batches.length} with ${batch.length} images...`, 'city-creation');
            
            const batchPromises = batch.map(async (item) => {
              try {
                // Generate image with style guide
                const imageUrl = await generateItemImage(
                  item.text, 
                  cityName, 
                  item.description, 
                  newCity.styleGuide,
                  item.id, // Pass the actual item ID for consistent file naming
                  true // Force a new image generation
                );
                
                if (!imageUrl) {
                  log(`Failed to generate image for item ${item.id}`, 'city-creation');
                  failedImages++;
                  return;
                }
                
                // Get the latest state to ensure we have the latest data
                // Use clientId if available for consistency
                log(`Retrieving current state for database update after image generation for item ${item.id}`, 'db-update');
                const currentState = clientId 
                  ? await storage.getBingoState(undefined, clientId)
                  : await storage.getBingoState();
                  
                const currentCity = currentState.cities[cityId];
                
                if (!currentCity) {
                  log(`[DB ERROR] City ${cityId} no longer exists, stopping image generation for item ${item.id}`, 'db-update');
                  console.error(`[DB-IMAGE] Database update failed: City ${cityId} does not exist for item ${item.id}`);
                  return;
                }
                
                // Find the item to update
                const targetItem = currentCity.items.find(i => i.id === item.id);
                if (!targetItem) {
                  log(`[DB ERROR] Item ${item.id} does not exist in city ${cityId}`, 'db-update');
                  console.error(`[DB-IMAGE] Database update failed: Item ${item.id} does not exist in city ${cityId}`);
                  return;
                }
                
                // Log the current image state before updating
                log(`[DB UPDATE] Updating image for item ${item.id} in city ${cityId}`, 'db-update');
                log(`[DB UPDATE] Previous image: ${targetItem.image || 'none'}`, 'db-update');
                log(`[DB UPDATE] New image: ${imageUrl}`, 'db-update');
                
                // Update the item with the image URL
                const updatedItems = currentCity.items.map(i => 
                  i.id === item.id ? { ...i, image: imageUrl } : i
                );
                
                // Update the city
                const updatedCity = {
                  ...currentCity,
                  items: updatedItems
                };
                
                // Update the state
                const updatedState = {
                  ...currentState,
                  cities: {
                    ...currentState.cities,
                    [cityId]: updatedCity
                  }
                };
                
                // Save the updated state with clientId if provided
                try {
                  log(`[DB WRITE] Saving updated state with new image for item ${item.id} in city ${cityId}`, 'db-update');
                  await storage.saveBingoState(updatedState, undefined, clientId);
                  log(`[DB SUCCESS] Successfully updated image for item ${item.id} in city ${cityId}`, 'db-update');
                  console.log(`[DB-IMAGE] Successfully saved image URL to database: ${imageUrl.substring(0, 30)}... for item ${item.id} in city ${cityId}`);
                  
                  // Direct database verification step
                  try {
                    // Import necessary modules
                    const { eq } = await import('drizzle-orm');
                    const { bingoItems } = await import('@shared/schema');
                    const { db } = await import('./db');
                    
                    // Verify the database has the image URL
                    const [updatedItemDb] = await db
                      .select({ id: bingoItems.id, image: bingoItems.image, text: bingoItems.text })
                      .from(bingoItems)
                      .where(eq(bingoItems.id, item.id));
                    
                    if (updatedItemDb && updatedItemDb.image === imageUrl) {
                      // Log successful verification with DATABASE VERIFIED tag
                      log(`[DB VERIFY] ✅ DATABASE VERIFIED: Image path correctly stored for item ${item.id}`, 'db-update');
                      console.log(`[DB-IMAGE] ✅ DATABASE VERIFIED: Item "${updatedItemDb.text}" (${item.id}) contains image: ${imageUrl.substring(0, 30)}...`);
                      
                      // Verify the file exists
                      if (imageUrl.startsWith('/images/')) {
                        const imagePath = path.join(process.cwd(), 'public', imageUrl);
                        if (fs.existsSync(imagePath)) {
                          const fileSize = fs.statSync(imagePath).size;
                          console.log(`[DB-IMAGE] ✅ IMAGE FILE VERIFIED: ${imagePath} exists (${fileSize} bytes)`);
                        } else {
                          console.log(`[DB-IMAGE] ⚠️ WARNING: Image file not found at ${imagePath} despite successful database update`);
                        }
                      }
                    } else {
                      // Log detailed error if verification failed
                      const actualImageUrl = updatedItemDb?.image || 'null';
                      log(`[DB VERIFY] ❌ VERIFICATION FAILED: Image URL mismatch for item ${item.id}`, 'db-update');
                      console.error(`[DB-IMAGE] ❌ VERIFICATION FAILED: Expected "${imageUrl.substring(0, 30)}..." but database contains "${actualImageUrl.substring(0, 30)}..."`);
                    }
                  } catch (verifyError) {
                    // Log error but continue since this is just verification
                    log(`[DB VERIFY] Error during verification: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`, 'db-update');
                    console.error(`[DB-IMAGE] VERIFICATION ERROR for item ${item.id}: Unable to verify database update`);
                  }
                  
                  completedImages++;
                  log(`Generated image for item ${item.id} (${completedImages}/${itemsWithDescriptions.length})`, 'city-creation');
                } catch (dbError) {
                  log(`[DB ERROR] Failed to save image update for item ${item.id}: ${dbError instanceof Error ? dbError.message : String(dbError)}`, 'db-update');
                  console.error(`[DB-IMAGE] Database update FAILED for item ${item.id} in city ${cityId}: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
                  throw new Error(`Database update failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
                }
              } catch (error) {
                log(`Error generating image for item ${item.id}: ${error instanceof Error ? error.message : String(error)}`, 'city-creation');
                failedImages++;
              }
            });
            
            // Wait for the current batch to complete
            await Promise.all(batchPromises);
            
            // Add a delay between batches to avoid rate limiting
            if (i < batches.length - 1) {
              log(`Batch ${i+1} complete. Waiting 5 seconds before starting next batch...`, 'city-creation');
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          }
          
          log(`Image generation complete: ${completedImages} successful, ${failedImages} failed`, 'city-creation');
        } catch (error) {
          log(`Error during batch image generation: ${error instanceof Error ? error.message : String(error)}`, 'city-creation');
        }
      });
      
      // Calculate performance metrics
      const processingTime = Date.now() - startTime;
      console.log(`[PERFORMANCE] City ${cityName} created in ${processingTime}ms with ${newCity.items.length} items by client ${clientId || 'unknown'}`);
      
      res.json({
        success: true,
        cityId: cityId,
        cityName: cityName,
        message: `Created new city "${cityName}" with ${newCity.items.length} items. Image generation is running in the background.`
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[SERVER ERROR] Error creating city after ${processingTime}ms:`, error);
      console.log(`[ERROR DETAILS] Request from IP ${requestIP}`);
      
      res.status(500).json({ error: "Failed to create city" });
    }
  });

  // Generate a description for a single bingo item
  // Administrative endpoint to update city metadata
  app.post("/api/update-city-metadata", async (req: Request, res: Response) => {
    try {
      const { cityId } = req.body; // Optional city ID to update just one city
      
      // Run the updateCityMetadata function for the specified city or all cities
      const result = await updateCityMetadata(cityId);
      
      res.json({
        success: true,
        message: cityId 
          ? `Successfully updated metadata for city ${cityId}` 
          : "Successfully updated metadata for all cities"
      });
    } catch (error) {
      console.error("Error updating city metadata:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to update city metadata",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Administrative endpoint to update image paths from disk files
  app.post("/api/update-image-paths", async (req: Request, res: Response) => {
    try {
      const { cityId } = req.body; // Optional city ID to update just one city
      
      // First update image paths from disk
      const updateResult = await updateImagePathsFromDisk(cityId);
      
      // Then update metadata to reflect the changes
      await updateCityMetadata(cityId);
      
      res.json({
        success: true,
        message: updateResult.message,
        updatedCount: updateResult.updatedCount
      });
    } catch (error) {
      console.error("Error updating image paths:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to update image paths",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Administrative endpoint to repair missing images for any city
  app.post("/api/repair-missing-images", async (req: Request, res: Response) => {
    try {
      const { cityId } = req.body; // Optional city ID to repair just one city
      
      // First, check for missing images
      const repairInfo = await repairMissingImages(cityId);
      
      // If there are items to repair, generate images for them
      if (repairInfo.itemsToRepair && repairInfo.itemsToRepair.length > 0) {
        log(`[IMAGE REPAIR] Found ${repairInfo.itemsToRepair.length} images to repair`, 'server');
        
        // Return the information to the client, the actual image generation will be done
        // through the normal image generation endpoint (which has rate limiting, etc.)
        return res.json({
          success: true,
          message: `Found ${repairInfo.itemsToRepair.length} images that need repair`,
          itemsToRepair: repairInfo.itemsToRepair,
          repaired: 0,
          needsRepair: repairInfo.itemsToRepair.length
        });
      }
      
      // No images to repair
      return res.json({
        success: true,
        message: cityId 
          ? `No missing images found for city ${cityId}` 
          : "No missing images found in any city",
        repaired: 0,
        needsRepair: 0
      });
    } catch (error) {
      console.error("Error repairing missing images:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to repair missing images",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/generate-description", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        itemId: z.string(),
        cityId: z.string(),
        clientId: z.string().optional()
      });
      
      const validatedData = schema.parse(req.body);
      const { itemId, cityId, clientId } = validatedData;
      
      // Get the current state
      const state = await storage.getBingoState();
      const city = state.cities[cityId];
      
      if (!city) {
        return res.status(404).json({ error: `City ${cityId} not found` });
      }
      
      // Find the item
      const item = city.items.find(item => item.id === itemId);
      
      if (!item) {
        return res.status(404).json({ error: `Item ${itemId} not found in city ${cityId}` });
      }
      
      log(`Generating description for "${item.text}" in ${city.title}`, 'ai-generation');
      
      // Generate description
      const description = await generateItemDescription(item.text, city.title);
      console.log(`Generated description for "${item.text}":`, description);
      
      // Update the item with the new description
      const updatedItems = city.items.map(i => 
        i.id === itemId ? { ...i, description } : i
      );
      
      // Update the city
      const updatedCity = {
        ...city,
        items: updatedItems
      };
      
      // Update the state
      const updatedState = {
        ...state,
        cities: {
          ...state.cities,
          [cityId]: updatedCity
        }
      };
      
      // Save the updated state with clientId if provided
      await storage.saveBingoState(updatedState, undefined, clientId);
      
      res.json({ 
        success: true, 
        description,
        message: `Generated description for "${item.text}" in ${city.title}`
      });
    } catch (error) {
      console.error("Error generating description:", error);
      res.status(500).json({ error: "Failed to generate description" });
    }
  });

  // Save a user-captured photo for a bingo item
  app.post("/api/save-user-photo", async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    try {
      const schema = z.object({
        itemId: z.string(),
        cityId: z.string(),
        photoDataUrl: z.string(),
        clientId: z.string().optional()
      });
      
      const validatedData = schema.parse(req.body);
      const { itemId, cityId, photoDataUrl, clientId } = validatedData;
      
      // Get the current state
      const state = await storage.getBingoState(undefined, clientId);
      const city = state.cities[cityId];
      
      if (!city) {
        console.log(`[USER ERROR] Client ${clientId || 'unknown'} tried to save photo for nonexistent city ${cityId}`);
        return res.status(404).json({ error: `City ${cityId} not found` });
      }
      
      // Find the item
      const item = city.items.find(item => item.id === itemId);
      
      if (!item) {
        console.log(`[USER ERROR] Client ${clientId || 'unknown'} tried to save photo for nonexistent item ${itemId}`);
        return res.status(404).json({ error: `Item ${itemId} not found in city ${cityId}` });
      }
      
      console.log(`[USER PHOTO] Client ${clientId || 'unknown'} from ${requestIP} is saving a photo for "${item.text}" (${itemId}) in ${city.title}`);
      log(`Saving user photo for item ${itemId} in ${cityId}`, 'user-photos');
      
      // Check if photoDataUrl is a valid data URL
      if (!photoDataUrl.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Invalid photo data format' });
      }
      
      let localPhotoPath = '';
      try {
        // Extract base64 data from data URL
        const base64Data = photoDataUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Generate a unique filename
        const filename = `user-photo-${itemId}-${Date.now()}.jpg`;
        const photoDir = path.join(process.cwd(), 'public', 'images');
        
        // Ensure directory exists
        if (!fs.existsSync(photoDir)) {
          fs.mkdirSync(photoDir, { recursive: true });
        }
        
        // Save the file
        const filePath = path.join(photoDir, filename);
        fs.writeFileSync(filePath, buffer);
        
        // Create a URL path for the saved image
        localPhotoPath = `/images/${filename}`;
        
        log(`User photo saved to ${localPhotoPath}`, 'user-photos');
      } catch (error: any) {
        log(`Error saving user photo: ${error.message}`, 'user-photos');
        return res.status(500).json({ error: 'Failed to save photo' });
      }
      
      // Update the item with the user photo URL
      const updatedItems = city.items.map(i => 
        i.id === itemId ? { ...i, userPhoto: localPhotoPath } : i
      );
      
      // Update the city
      const updatedCity = {
        ...city,
        items: updatedItems
      };
      
      // Update the state
      const updatedState = {
        ...state,
        cities: {
          ...state.cities,
          [cityId]: updatedCity
        }
      };
      
      // Save the updated state with clientId if provided
      await storage.saveBingoState(updatedState, undefined, clientId);
      
      const processingTime = Date.now() - startTime;
      console.log(`[PERFORMANCE] User photo saved in ${processingTime}ms for client ${clientId || 'unknown'}`);
      console.log(`[USER MILESTONE] Client ${clientId || 'unknown'} completed item "${item.text}" with photo in ${city.title}`);
      
      res.json({ 
        success: true, 
        photoUrl: localPhotoPath,
        message: `Saved user photo for "${item.text}" in ${city.title}`
      });
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      console.error(`[SERVER ERROR] Error saving user photo after ${processingTime}ms:`, error);
      console.log(`[ERROR DETAILS] Request from IP ${requestIP}`);
      res.status(500).json({ error: "Failed to save user photo" });
    }
  });

  // Generate an image for a bingo item
  // Dedicated admin API that provides all necessary data in one call
  app.get("/api/admin-data", async (req: Request, res: Response) => {
    try {
      const requestIP = req.ip || req.connection.remoteAddress || 'unknown';
      console.log(`[ADMIN] Admin data requested from ${requestIP}`);
      
      // Get city metadata directly from database
      const citiesData = await db.select().from(cities);
      
      // For each city, get the count of completed items
      const result = await Promise.all(citiesData.map(async (city) => {
        try {
          // Get items for this city
          const cityItems = await db.select().from(bingoItems).where(eq(bingoItems.cityId, city.id));
          
          // Get all completions for all items in this city
          // We need to first get the IDs of all items in this city
          const cityItemIds = cityItems.map(item => item.id);
          
          // Now get all completions for these items
          const completions = cityItemIds.length > 0 
            ? await db.select().from(userCompletions)
                .where(inArray(userCompletions.itemId, cityItemIds))
            : [];

          // Calculate completion statistics
          const completedItemsCount = new Set(completions.map(c => c.itemId)).size;
          
          return {
            id: city.id,
            title: city.title,
            subtitle: city.subtitle,
            itemCount: city.itemCount || cityItems.length,
            itemsWithDescriptions: city.itemsWithDescriptions || cityItems.filter(item => !!item.description).length,
            itemsWithImages: city.itemsWithImages || cityItems.filter(item => !!item.image).length,
            itemsWithValidImageFiles: city.itemsWithValidImageFiles,
            completedItemsCount,
            lastMetadataUpdate: city.lastMetadataUpdate,
            items: cityItems.map(item => ({
              id: item.id,
              text: item.text,
              description: item.description,
              image: item.image,
              isCenterSpace: item.isCenterSpace,
              gridRow: item.gridRow,
              gridCol: item.gridCol
            }))
          };
        } catch (cityError) {
          console.error(`[ADMIN] Error processing city ${city.id}:`, cityError);
          // Return partial data for this city if there's an error
          return {
            id: city.id,
            title: city.title,
            subtitle: city.subtitle,
            itemCount: city.itemCount || 0,
            itemsWithDescriptions: city.itemsWithDescriptions || 0,
            itemsWithImages: city.itemsWithImages || 0,
            itemsWithValidImageFiles: city.itemsWithValidImageFiles || 0,
            completedItemsCount: 0,
            lastMetadataUpdate: city.lastMetadataUpdate,
            items: []
          };
        }
      }));
      
      res.json({
        success: true,
        cities: result
      });
    } catch (error) {
      console.error("Error fetching admin data:", error);
      res.status(500).json({ success: false, error: "Failed to fetch admin data" });
    }
  });

  app.post("/api/generate-image", async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestIP = req.ip || req.connection.remoteAddress || 'unknown';
    // Set default values outside try block so they're available in the catch block
    let cityId = 'unknown';
    let clientId = 'unknown';
    let itemId = 'unknown';
    
    try {
      const schema = z.object({
        itemId: z.string().optional(),
        itemText: z.string().optional(),
        description: z.string().optional(),
        cityId: z.string(),
        clientId: z.string().optional(),
        forceNewImage: z.boolean().optional().default(false),
        styleGuide: z.any().optional() // Accept style guide from client side
      }).refine(data => data.itemId || data.itemText, {
        message: "Either itemId or itemText must be provided"
      });
      
      const validatedData = schema.parse(req.body);
      const { 
        itemText: providedItemText, 
        description: providedDescription, 
        forceNewImage,
        styleGuide: clientStyleGuide 
      } = validatedData;
      
      // Update the variables declared outside try block
      cityId = validatedData.cityId;
      clientId = validatedData.clientId || 'unknown';
      itemId = validatedData.itemId || 'text-only';
      
      // Create a unique key for this image generation request
      const generationKey = `${cityId}-${itemId}`;
      
      // Check if this item is already being processed
      if (inProgressImageGenerations.has(generationKey)) {
        const existingStartTime = inProgressImageGenerations.get(generationKey);
        const elapsedTime = Date.now() - existingStartTime!;
        console.log(`[BATCH-DEDUP] Detected duplicate request for item ${itemId} in city ${cityId}`);
        console.log(`[BATCH-DEDUP] Original request has been processing for ${elapsedTime}ms`);
        
        // If it's been processing for too long (>2 minutes), allow a new generation to start
        if (elapsedTime < 120000) { // 2 minutes in milliseconds
          console.log(`[BATCH-DEDUP] Skipping duplicate image generation for ${itemId} to avoid race conditions`);
          return res.json({
            success: false,
            error: "This item is already being processed",
            inProgress: true,
            message: `Image for ${itemId} is already being generated (started ${Math.round(elapsedTime/1000)}s ago)`
          });
        } else {
          console.log(`[BATCH-DEDUP] Original request timeout (${elapsedTime}ms > 120000ms), allowing new request`);
          // Continue with generation, but update the timestamp
          inProgressImageGenerations.set(generationKey, Date.now());
        }
      } else {
        // Mark this item as in-progress
        inProgressImageGenerations.set(generationKey, Date.now());
        console.log(`[BATCH-DEDUP] Starting image generation for ${itemId}, added to tracking map`);
      }
      
      // Use a try-finally to ensure we always clean up the tracking map
      try {
        console.log(`[USER ACTION] Client ${clientId} from ${requestIP} is generating image for city ${cityId}`);
        console.log(`[USER DEVICE] Client ${clientId} using: ${req.headers['user-agent']}`);
        
        // Get the current state
        const state = await storage.getBingoState();
      
      // Enhanced logging around city lookup
      console.log(`[DEBUG] Attempting to generate image for city: ${cityId}`);
      console.log(`[DEBUG] Available cities in state: ${Object.keys(state.cities).join(', ')}`);
      
      let city = state.cities[cityId];
      
      if (!city) {
        // Enhanced error logging when city not found
        console.log(`[ERROR] City ${cityId} not found in state object. Available cities: ${Object.keys(state.cities).join(', ')}`);
        
        // Try to fetch directly from database as fallback
        try {
          // Import necessary modules
          const { eq } = await import('drizzle-orm');
          const { cities, bingoItems } = await import('@shared/schema');
          const { db } = await import('./db');
          
          console.log(`[DB LOOKUP] Attempting to fetch city ${cityId} directly from database`);
          const [cityFromDb] = await db.select().from(cities).where(eq(cities.id, cityId));
          
          if (cityFromDb) {
            console.log(`[DB RECOVERY] Found city ${cityId} in database: ${cityFromDb.title}`);
            const cityItemsFromDb = await db.select().from(bingoItems).where(eq(bingoItems.cityId, cityId));
            console.log(`[DB RECOVERY] Found ${cityItemsFromDb.length} items for city ${cityId} in database`);
            
            if (cityItemsFromDb.length > 0) {
              // Create minimal city object to continue processing
              city = {
                id: cityFromDb.id,
                title: cityFromDb.title,
                subtitle: cityFromDb.subtitle || '',
                items: cityItemsFromDb.map(item => ({
                  id: item.id,
                  text: item.text,
                  completed: false,
                  isCenterSpace: item.isCenterSpace === null ? undefined : item.isCenterSpace,
                  image: item.image,
                  description: item.description,
                  gridRow: item.gridRow,
                  gridCol: item.gridCol
                }))
              };
              console.log(`[DB RECOVERY] Created fallback city object for ${cityId}`);
            } else {
              console.log(`[DB ERROR] No items found for city ${cityId} in database`);
              return res.status(404).json({ error: `City ${cityId} found in database but has no items` });
            }
          } else {
            console.log(`[DB ERROR] City ${cityId} not found in database either`);
            return res.status(404).json({ error: `City ${cityId} not found in application state or database` });
          }
        } catch (dbError) {
          console.error(`[DB ERROR] Failed to fetch city ${cityId} from database:`, dbError);
          return res.status(404).json({ error: `City ${cityId} not found and database lookup failed` });
        }
      }
      
      let itemText = providedItemText;
      let targetItem;
      
      // If itemId is provided, find the item
      if (itemId) {
        targetItem = city.items.find(item => item.id === itemId);
        if (!targetItem) {
          return res.status(404).json({ error: `Item ${itemId} not found in city ${cityId}` });
        }
        itemText = targetItem.text;
      }
      
      log(`Generating image for "${itemText}" in ${city.title}`, 'ai-generation');
      
      // Generate image
      let imageUrl = "";
      try {
        log(`Starting image generation for "${itemText}" in ${city.title}`, 'ai-generation');
        
        // Log OPENAI_API_KEY status (without revealing the actual key)
        const hasApiKey = !!process.env.OPENAI_API_KEY;
        log(`OPENAI_API_KEY is ${hasApiKey ? 'set' : 'NOT SET'}`, 'ai-generation');
        
        // Log city title and item text to make sure they are valid
        log(`City title: "${city.title}", Item text: "${itemText}"`, 'ai-generation');
        
        // Prioritize the provided description, fall back to the item's description
        const description = providedDescription || targetItem?.description;
        
        // Log if we have a description to include in the image generation
        if (description) {
          log(`Including item description in image generation (length: ${description.length})`, 'ai-generation');
        }
        
        // Get style guide from database if not available in the city object
        let styleGuideToUse = clientStyleGuide || city.styleGuide;
        
        // If we still don't have a style guide, check directly in the database
        if (!styleGuideToUse) {
          try {
            // Fetch style guide from database
            const [cityData] = await db.select().from(cities).where(eq(cities.id, cityId));
            if (cityData && cityData.styleGuide) {
              styleGuideToUse = cityData.styleGuide;
              log(`Retrieved style guide directly from database for ${cityId}`, 'ai-generation');
            }
          } catch (styleGuideError) {
            log(`Error fetching style guide from database: ${styleGuideError}`, 'ai-generation');
          }
        }
        
        // Log style guide status 
        if (clientStyleGuide) {
          log(`Using client-provided style guide for image generation`, 'ai-generation');
        } else if (styleGuideToUse) {
          log(`Using style guide for image generation: ${JSON.stringify(styleGuideToUse).substring(0, 100)}...`, 'ai-generation');
        } else {
          log(`No style guide available for image generation`, 'ai-generation');
        }
        
        // Attempt to generate the image with description and style guide if available
        imageUrl = await generateItemImage(
          itemText!, 
          city.title, 
          description, 
          styleGuideToUse,
          itemId, // Pass the actual item ID for consistent file naming
          forceNewImage // Pass the force flag from request body
        );
        
        if (!imageUrl) {
          const errorMsg = `Image generation failed - empty URL returned for "${itemText}" in ${city.title}`;
          log(errorMsg, 'ai-generation');
          return res.status(500).json({ error: errorMsg });
        }
        
        log(`Successfully generated image from OpenAI for "${itemText}" - URL: ${imageUrl.slice(0, 50)}...`, 'ai-generation');
        
        // The image has already been processed and stored locally by generateItemImage
        // Verify image exists at expected location
        if (imageUrl.startsWith('/images/')) {
          const filename = imageUrl.split('/').pop();
          const fullPath = path.join(process.cwd(), 'public', 'images', filename || '');
          
          if (!fs.existsSync(fullPath)) {
            log(`[DB-IMAGE] WARNING: Image file does not exist at expected location: ${fullPath}`, 'ai-generation');
          } else {
            const fileSize = fs.statSync(fullPath).size;
            if (fileSize === 0) {
              log(`[DB-IMAGE] WARNING: Image file exists but is empty: ${fullPath}`, 'ai-generation');
            } else {
              log(`[DB-IMAGE] Verified image file: ${fullPath} (${fileSize} bytes)`, 'ai-generation');
            }
          }
        } else {
          log(`[DB-IMAGE] Image URL is not a local path: ${imageUrl.substring(0, 30)}...`, 'ai-generation');
        }
      } catch (imageError: any) {
        const errorDetails = {
          message: imageError?.message || 'Unknown error',
          code: imageError?.code,
          status: imageError?.status,
          type: imageError?.type,
          stack: imageError?.stack?.split('\n').slice(0, 3).join('\n') // First 3 lines only
        };
        
        log(`Image generation error: ${JSON.stringify(errorDetails)}`, 'ai-generation');
        return res.status(500).json({ 
          error: "Failed to generate image", 
          details: errorDetails
        });
      }
      
      // If we have an itemId, update the item with the new image
      if (itemId && targetItem) {
        log(`Adding image URL to item ${itemId}: length=${imageUrl.length}, starts with: ${imageUrl.substring(0, 30)}...`, 'ai-generation');
        
        // Create a deep copy to ensure we don't have reference issues
        const updatedItems = city.items.map(i => 
          i.id === itemId ? { ...i, image: imageUrl } : i
        );
        
        // Double-check that the image URL is properly set in the new item
        const updatedItem = updatedItems.find(i => i.id === itemId);
        if (updatedItem && updatedItem.image === imageUrl) {
          log(`Successfully set image URL on item ${itemId}`, 'ai-generation');
        } else {
          log(`WARNING: Failed to set image URL on item ${itemId}`, 'ai-generation');
        }
        
        // Update the city with the modified items
        const updatedCity = {
          ...city,
          items: updatedItems
        };
        
        // Update the state with the modified city
        const updatedState = {
          ...state,
          cities: {
            ...state.cities,
            [cityId]: updatedCity
          }
        };
        
        // Double-check in state object
        const checkItem = updatedState.cities[cityId].items.find(i => i.id === itemId);
        log(`Final image URL check for ${itemId}: ${checkItem?.image ? 'URL present' : 'No URL'}`, 'ai-generation');
        
        // Import necessary modules for database operations
        const { eq } = await import('drizzle-orm');
        const { bingoItems } = await import('@shared/schema');
        const { db } = await import('./db');
        
        // Function to verify database update was successful
        const verifyDatabaseUpdate = async (): Promise<boolean> => {
          try {
            const [verifiedItem] = await db
              .select({ id: bingoItems.id, image: bingoItems.image, text: bingoItems.text })
              .from(bingoItems)
              .where(eq(bingoItems.id, itemId));
            
            if (verifiedItem && verifiedItem.image === imageUrl) {
              log(`[VERIFY] Database verification successful for item ${itemId}`, 'db-update');
              return true;
            } else {
              const actualImage = verifiedItem?.image || 'null';
              log(`[VERIFY] Database verification failed. Expected: ${imageUrl.substring(0, 30)}..., Got: ${actualImage.substring(0, 30)}...`, 'db-update');
              return false;
            }
          } catch (verifyError: any) {
            log(`[VERIFY] Database verification error: ${verifyError?.message || 'Unknown error'}`, 'db-update');
            return false;
          }
        };
        
        // Function to update the database with retries
        const updateDatabaseWithRetry = async (maxRetries = 3): Promise<boolean> => {
          let retryCount = 0;
          let updateSuccess = false;
          
          while (retryCount < maxRetries && !updateSuccess) {
            try {
              if (retryCount > 0) {
                log(`[RETRY] Attempt ${retryCount + 1}/${maxRetries} to update database for item ${itemId}`, 'db-update');
              }
              
              // First try the state update method
              log(`[DB WRITE] Saving updated state with new image for item ${itemId} in city ${cityId}`, 'db-update');
              await storage.saveBingoState(updatedState, undefined, clientId);
              log(`[DB SUCCESS] Successfully updated image for item ${itemId} in city ${cityId} via state`, 'db-update');
              
              // Then try direct database update
              log(`[DB DIRECT] Directly updating image URL in database for item ${itemId}`, 'db-update');
              await db
                .update(bingoItems)
                .set({ image: imageUrl })
                .where(eq(bingoItems.id, itemId));
              
              // Verify the update in the database
              updateSuccess = await verifyDatabaseUpdate();
              
              if (updateSuccess) {
                log(`[DB SUCCESS] ✅ DATABASE VERIFIED: Image update confirmed for item ${itemId}`, 'db-update');
                const [updatedItemDb] = await db
                  .select({ text: bingoItems.text })
                  .from(bingoItems)
                  .where(eq(bingoItems.id, itemId));
                
                console.log(`[DB-IMAGE] ✅ DATABASE VERIFIED: Item "${updatedItemDb?.text || itemText}" (${itemId}) successfully updated with image: ${imageUrl.substring(0, 30)}...`);
                console.log(`[DB-IMAGE] ✅ FULL PATH: ${imageUrl}`);
                
                // Log file existence verification
                const imagePath = imageUrl.startsWith('/images/') ? 
                  path.join(process.cwd(), 'public', imageUrl) : null;
                
                if (imagePath && fs.existsSync(imagePath)) {
                  const fileSize = fs.statSync(imagePath).size;
                  console.log(`[DB-IMAGE] ✅ IMAGE FILE VERIFIED: ${imagePath} exists (${fileSize} bytes)`);
                } else if (imagePath) {
                  console.log(`[DB-IMAGE] ⚠️ WARNING: Image file not found at ${imagePath} despite successful database update`);
                }
                
                break;
              } else {
                log(`[DB ERROR] Update verification failed on attempt ${retryCount + 1}/${maxRetries}`, 'db-update');
              }
            } catch (updateError: any) {
              log(`[DB ERROR] Update failed on attempt ${retryCount + 1}/${maxRetries}: ${updateError?.message || 'Unknown error'}`, 'db-update');
            }
            
            retryCount++;
            if (retryCount < maxRetries && !updateSuccess) {
              // Exponential backoff: 500ms, 1000ms, 2000ms...
              const backoffMs = 500 * Math.pow(2, retryCount - 1);
              log(`[RETRY] Waiting ${backoffMs}ms before next retry...`, 'db-update');
              await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
          }
          
          return updateSuccess;
        };
        
        // Execute the database update with retries
        const updateSuccessful = await updateDatabaseWithRetry();
        
        if (!updateSuccessful) {
          log(`[DB ERROR] ❌ Failed to update database after maximum retries for item ${itemId}`, 'db-update');
          console.error(`[DB-IMAGE] ❌ CRITICAL: Database update failed for item ${itemId} after multiple retries`);
          // This is serious enough to throw an error to the client
          throw new Error(`Failed to update database after multiple retries for item ${itemId}`);
        }
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`[PERFORMANCE] Image generation completed in ${processingTime}ms for client ${clientId || 'unknown'}`);
      console.log(`[USER SUCCESS] Client ${clientId || 'unknown'} generated image for "${itemText}" in ${city.title}`);
      
      return res.json({ 
        success: true, 
        imageUrl: imageUrl,
        message: `Generated image for "${itemText}" in ${city.title}`
      });
    } finally {
      // Always remove from in-progress map when done
      if (itemId && cityId) {
        const generationKey = `${cityId}-${itemId}`;
        inProgressImageGenerations.delete(generationKey);
        console.log(`[BATCH-DEDUP] Completed image generation for ${itemId}, removed from tracking map`);
      }
    }
  } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[SERVER ERROR] Error generating image after ${processingTime}ms:`, error);
      console.log(`[ERROR DETAILS] Request from IP ${requestIP}, client ${clientId || 'unknown'}, city ${cityId || 'unknown'}`);
      
      // Check which OpenAI API key we're using (without revealing it)
      console.log(`[DEBUG] OPENAI_API_KEY availability: ${!!process.env.OPENAI_API_KEY}`);
      
      res.status(500).json({ error: "Failed to generate image" });
    }
  });
  
  const httpServer = createServer(app);

  return httpServer;
}