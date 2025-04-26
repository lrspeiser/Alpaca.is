import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { generateBulkDescriptions, generateItemDescription } from "./openai";
import { generateBingoItems, generateItemImage } from "./generator";
import { log } from "./vite";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get the current bingo state
  app.get("/api/bingo-state", async (req: Request, res: Response) => {
    try {
      // For now, we're not implementing authentication, so userId is undefined
      // In a real app, you would get the userId from the session
      const state = await storage.getBingoState();
      res.json(state);
    } catch (error) {
      console.error("Error fetching bingo state:", error);
      res.status(500).json({ error: "Failed to fetch bingo state" });
    }
  });

  // Save the bingo state
  app.post("/api/bingo-state", async (req: Request, res: Response) => {
    try {
      const state = req.body;
      // For now, we're not implementing authentication, so userId is undefined
      await storage.saveBingoState(state);
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving bingo state:", error);
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
      const imageUrl = await generateItemImage(itemText!, city.title);
      
      if (!imageUrl) {
        return res.status(500).json({ error: "Failed to generate image" });
      }
      
      // If we have an itemId, update the item with the new image
      if (itemId && targetItem) {
        const updatedItems = city.items.map(i => 
          i.id === itemId ? { ...i, image: imageUrl } : i
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
