import type { Express, Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { generateBulkDescriptions, generateItemDescription } from "./openai";
import { generateBingoItems, generateItemImage, generateStyleGuide } from "./generator";
import { log } from "./vite";
import { setupImageProxy } from "./imageProxy";
import { setupImageServing, processOpenAIImageUrl } from "./imageStorage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up image proxy for handling OpenAI image URLs
  setupImageProxy(app);
  
  // Set up static serving for stored images
  const imageDir = setupImageServing(app);
  
  // Set up additional static route for the image directory
  app.use('/images', express.static(imageDir));
  // Register a client ID for persistent user state without login
  app.post("/api/register-client", async (req: Request, res: Response) => {
    try {
      const { clientId } = req.body;
      
      if (!clientId) {
        return res.status(400).json({ 
          success: false, 
          error: "Client ID is required" 
        });
      }
      
      // Register the client ID or update if it exists
      const user = await storage.createOrUpdateClientUser(clientId);
      
      return res.json({ 
        success: true, 
        userId: user.id,
        clientId: user.clientId,
        lastVisitedAt: user.lastVisitedAt
      });
    } catch (error) {
      console.error("[ERROR] Failed to register client:", error);
      return res.status(500).json({ 
        success: false, 
        error: "Failed to register client" 
      });
    }
  });
  
  // Get the current bingo state
  app.get("/api/bingo-state", async (req: Request, res: Response) => {
    try {
      // Check for clientId in query parameters or headers
      let clientId = req.query.clientId as string | undefined;
      
      // Also check headers for clientId (for non-GET requests or when not in query)
      if (!clientId && req.headers['x-client-id']) {
        clientId = req.headers['x-client-id'] as string;
      }
      
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
      
      // Check for prague-4 (Pilsner) item specifically
      if (state.cities.prague) {
        const testItem = state.cities.prague.items.find((item: any) => item.id === 'prague-4');
        if (testItem) {
          console.log('[DB DEBUG] prague-4 item in bingo state API:', {
            id: testItem.id,
            text: testItem.text,
            hasDescription: !!testItem.description,
            description: testItem.description ? testItem.description.substring(0, 50) + '...' : 'none',
            hasImage: !!testItem.image,
            imageUrl: testItem.image ? testItem.image.substring(0, 30) + '...' : 'none'
          });
        }
      }
      
      log(`[SERVER] Sending bingo state to client: current city=${state.currentCity}, cities=${JSON.stringify(citySummary)}`, 'state');
      res.json(state);
    } catch (error) {
      console.error("[SERVER] Error fetching bingo state:", error);
      res.status(500).json({ error: "Failed to fetch bingo state" });
    }
  });

  // Save the bingo state
  app.post("/api/bingo-state", async (req: Request, res: Response) => {
    try {
      const { state, clientId } = req.body;
      
      // Log summary of the state being saved
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
    try {
      const schema = z.object({
        itemId: z.string(),
        cityId: z.string(),
        clientId: z.string().optional()
      });
      
      const validatedData = schema.parse(req.body);
      const { itemId, cityId, clientId } = validatedData;
      
      // Use clientId if provided
      await storage.toggleItemCompletion(itemId, cityId, undefined, clientId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error toggling item completion:", error);
      res.status(500).json({ error: "Failed to toggle item completion" });
    }
  });

  // Reset all items for a city
  app.post("/api/reset-city", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        cityId: z.string(),
        clientId: z.string().optional()
      });
      
      const validatedData = schema.parse(req.body);
      const { cityId, clientId } = validatedData;
      
      // Use clientId if provided
      await storage.resetCity(cityId, undefined, clientId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error resetting city:", error);
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
    try {
      // Validate input - we only need cityId and cityName (plus optional clientId)
      const schema = z.object({
        cityId: z.string(),
        cityName: z.string(),
        clientId: z.string().optional()
      });
      
      const validatedData = schema.parse(req.body);
      const { cityId, cityName, clientId } = validatedData;
      
      log(`Creating new city: ${cityName} (${cityId})`, 'city-creation');
      
      // Get the current bingo state
      const state = await storage.getBingoState();
      
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
        backgroundImage: "/images/placeholder-background.jpg", // Default placeholder
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
        gridCol: 2  // 0-based, so this is the middle column (3rd column)
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
                const imageUrl = await generateItemImage(item.text, cityName, item.description, newCity.styleGuide);
                
                if (!imageUrl) {
                  log(`Failed to generate image for item ${item.id}`, 'city-creation');
                  failedImages++;
                  return;
                }
                
                // Get the latest state to ensure we have the latest data
                const currentState = await storage.getBingoState();
                const currentCity = currentState.cities[cityId];
                
                if (!currentCity) {
                  log(`City ${cityId} no longer exists, stopping image generation`, 'city-creation');
                  return;
                }
                
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
                await storage.saveBingoState(updatedState, undefined, clientId);
                completedImages++;
                log(`Generated image for item ${item.id} (${completedImages}/${itemsWithDescriptions.length})`, 'city-creation');
              } catch (error) {
                log(`Error generating image for item ${item.id}: ${error.message}`, 'city-creation');
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
          log(`Error during batch image generation: ${error.message}`, 'city-creation');
        }
      });
      
      res.json({
        success: true,
        cityId: cityId,
        cityName: cityName,
        message: `Created new city "${cityName}" with ${newCity.items.length} items. Image generation is running in the background.`
      });
    } catch (error) {
      console.error("Error creating city:", error);
      res.status(500).json({ error: "Failed to create city" });
    }
  });

  // Generate a description for a single bingo item
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
        return res.status(404).json({ error: `City ${cityId} not found` });
      }
      
      // Find the item
      const item = city.items.find(item => item.id === itemId);
      
      if (!item) {
        return res.status(404).json({ error: `Item ${itemId} not found in city ${cityId}` });
      }
      
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
      
      res.json({ 
        success: true, 
        photoUrl: localPhotoPath,
        message: `Saved user photo for "${item.text}" in ${city.title}`
      });
    } catch (error: any) {
      console.error("Error saving user photo:", error);
      res.status(500).json({ error: "Failed to save user photo" });
    }
  });

  // Generate an image for a bingo item
  app.post("/api/generate-image", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        itemId: z.string().optional(),
        itemText: z.string().optional(),
        description: z.string().optional(),
        cityId: z.string(),
        clientId: z.string().optional(),
        forceNewImage: z.boolean().optional().default(false)
      }).refine(data => data.itemId || data.itemText, {
        message: "Either itemId or itemText must be provided"
      });
      
      const validatedData = schema.parse(req.body);
      const { itemId, itemText: providedItemText, description: providedDescription, cityId, clientId, forceNewImage } = validatedData;
      
      // Get the current state
      const state = await storage.getBingoState();
      const city = state.cities[cityId];
      
      if (!city) {
        return res.status(404).json({ error: `City ${cityId} not found` });
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
        
        // Attempt to generate the image with description if available
        imageUrl = await generateItemImage(itemText!, city.title, description);
        
        if (!imageUrl) {
          const errorMsg = `Image generation failed - empty URL returned for "${itemText}" in ${city.title}`;
          log(errorMsg, 'ai-generation');
          return res.status(500).json({ error: errorMsg });
        }
        
        log(`Successfully generated image from OpenAI for "${itemText}" - URL: ${imageUrl.slice(0, 50)}...`, 'ai-generation');
        
        // Now store the OpenAI image locally
        log(`Storing OpenAI image locally...`, 'ai-generation');
        try {
          // Always force a new image when explicitly generating an image for an item
          const forceNewImage = !!itemId; // Force new image when regenerating for a specific item
          
          log(`Processing image with forceNewImage=${forceNewImage}`, 'ai-generation');
          
          const localImageUrl = await processOpenAIImageUrl(
            imageUrl,
            cityId,
            itemId || `generated-${Date.now()}`,
            itemText || 'Generated Image',
            forceNewImage
          );
          
          log(`Image stored locally at ${localImageUrl}`, 'ai-generation');
          
          // Replace the OpenAI URL with our local URL
          imageUrl = localImageUrl;
        } catch (storageError: any) {
          log(`Warning: Failed to store image locally: ${storageError.message}`, 'ai-generation');
          log(`Falling back to original OpenAI URL (this may expire)`, 'ai-generation');
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
        
        // Save the updated state to the database with clientId if provided
        await storage.saveBingoState(updatedState, undefined, clientId);
        
        // Also directly update the database item 
        try {
          log(`Directly updating image URL in database for item ${itemId}`, 'ai-generation');
          
          // Import necessary modules
          const { eq } = await import('drizzle-orm');
          const { bingoItems } = await import('@shared/schema');
          const { db } = await import('./db');
          
          // Update the database directly
          await db
            .update(bingoItems)
            .set({ image: imageUrl })
            .where(eq(bingoItems.id, itemId));
            
          log(`Direct database update completed for item ${itemId}`, 'ai-generation');
        } catch (error: any) {
          log(`Error during direct database update: ${error?.message || 'Unknown error'}`, 'ai-generation');
        }
      }
      
      res.json({ 
        success: true, 
        imageUrl: imageUrl,
        message: `Generated image for "${itemText}" in ${city.title}`
      });
    } catch (error) {
      console.error("Error generating image:", error);
      res.status(500).json({ error: "Failed to generate image" });
    }
  });
  
  const httpServer = createServer(app);

  return httpServer;
}