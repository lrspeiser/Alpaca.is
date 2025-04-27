import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { generateBulkDescriptions, generateItemDescription } from "./openai";
import { generateBingoItems, generateItemImage } from "./generator";
import { log } from "./vite";
import { setupImageProxy } from "./imageProxy";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get the current bingo state
  app.get("/api/bingo-state", async (req: Request, res: Response) => {
    try {
      // For now, we're not implementing authentication, so userId is undefined
      // In a real app, you would get the userId from the session
      const state = await storage.getBingoState();
      
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
      const state = req.body;
      
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
      
      log(`[SERVER] Saving bingo state: current city=${state.currentCity}, cities=${JSON.stringify(citySummary)}`, 'state');
      
      // For now, we're not implementing authentication, so userId is undefined
      await storage.saveBingoState(state);
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
        cityId: z.string()
      });
      
      const validatedData = schema.parse(req.body);
      
      // For now, we're not implementing authentication, so userId is undefined
      await storage.toggleItemCompletion(validatedData.itemId, validatedData.cityId);
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
        cityId: z.string()
      });
      
      const validatedData = schema.parse(req.body);
      
      // For now, we're not implementing authentication, so userId is undefined
      await storage.resetCity(validatedData.cityId);
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
        cityId: z.string()
      });
      
      const validatedData = schema.parse(req.body);
      const cityId = validatedData.cityId;
      
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
      
      // Save the updated state
      await storage.saveBingoState(updatedState);
      
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
        theme: z.string()
      });
      
      const validatedData = schema.parse(req.body);
      const { cityId, theme } = validatedData;
      
      // Get the current state
      const state = await storage.getBingoState();
      const city = state.cities[cityId];
      
      if (!city) {
        return res.status(404).json({ error: `City ${cityId} not found` });
      }
      
      log(`Generating bingo items for ${cityId} with theme: ${theme}`, 'ai-generation');
      
      // Generate bingo items
      const items = await generateBingoItems(cityId, city.title, theme);
      
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

  // Generate a description for a single bingo item
  app.post("/api/generate-description", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        itemId: z.string(),
        cityId: z.string()
      });
      
      const validatedData = schema.parse(req.body);
      const { itemId, cityId } = validatedData;
      
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
      
      // Save the updated state
      await storage.saveBingoState(updatedState);
      
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

  // Generate an image for a bingo item
  app.post("/api/generate-image", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        itemId: z.string().optional(),
        itemText: z.string().optional(),
        cityId: z.string()
      }).refine(data => data.itemId || data.itemText, {
        message: "Either itemId or itemText must be provided"
      });
      
      const validatedData = schema.parse(req.body);
      const { itemId, itemText: providedItemText, cityId } = validatedData;
      
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
        
        // Attempt to generate the image
        imageUrl = await generateItemImage(itemText!, city.title);
        
        if (!imageUrl) {
          const errorMsg = `Image generation failed - empty URL returned for "${itemText}" in ${city.title}`;
          log(errorMsg, 'ai-generation');
          return res.status(500).json({ error: errorMsg });
        }
        
        log(`Successfully generated image for "${itemText}" - URL: ${imageUrl}`, 'ai-generation');
        log(`Image URL for storage: ${imageUrl.slice(0, 50)}...`, 'ai-generation');
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
        
        // Save the updated state to the database
        await storage.saveBingoState(updatedState);
        
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