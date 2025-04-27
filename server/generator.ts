import OpenAI from "openai";
import { log } from "./vite";
import { v4 as uuidv4 } from "uuid";
import type { BingoItem } from "../shared/schema";

// Initialize OpenAI client
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  log('Warning: OPENAI_API_KEY environment variable is not set. AI generation will not work.', 'openai');
}

// Client for text generation
const openai = new OpenAI({
  apiKey: apiKey,
  defaultQuery: {} // Ensure no shared default query parameters
});

// Completely separate client for image generation - no shared configuration
const imageOpenAI = new OpenAI({
  apiKey: apiKey,
  defaultQuery: {}, // Explicit empty default query to prevent inheritance
  defaultHeaders: {} // Explicit empty default headers to prevent inheritance
});

/**
 * Generate bingo items for a city using OpenAI
 * 
 * @param cityId The ID of the city
 * @param cityName The name of the city
 * @param theme The theme or focus for the bingo items
 * @returns An array of bingo items
 */
export async function generateBingoItems(
  cityId: string,
  cityName: string,
  theme: string
): Promise<BingoItem[]> {
  try {
    // Prepare the prompt for OpenAI
    const prompt = `
      Generate 24 interesting and diverse tourist activities or sights for a travel bingo card for ${cityName}.
      Focus on this theme: "${theme}".
      
      Make each item brief (5-10 words), specific, action-oriented, and unique to ${cityName}.
      Include a mix of famous landmarks, food experiences, cultural activities, and hidden gems.
      Avoid generic items that could apply to any city.
      Do not include "Arrive in ${cityName}" as this is already the center square.
      
      Response format: Return a JSON array of objects with this format:
      [
        { "text": "Visit Eiffel Tower" },
        { "text": "Eat croissant at local bakery" },
        ...
      ]
    `;

    // Call OpenAI API with appropriate parameters
    const response = await openai.chat.completions.create({
      model: "gpt-4.1", // Using gpt-4.1 which is the latest model as of April 26, 2025
      messages: [
        {
          role: "system",
          content: "You are a helpful travel content creator crafting concise, engaging bingo activities for tourists."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1000,
    });

    // Process the response
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    // Parse the JSON response and validate
    const parsedContent = JSON.parse(content);
    if (!Array.isArray(parsedContent) && !Array.isArray(parsedContent.items)) {
      throw new Error("Invalid response format from OpenAI");
    }

    const itemArray = Array.isArray(parsedContent) ? parsedContent : parsedContent.items;
    
    // Map the items to our format with IDs
    const bingoItems: BingoItem[] = itemArray.map((item: any) => ({
      id: `${cityId}-${uuidv4().slice(0, 8)}`,
      text: item.text,
      completed: false,
      description: "" // We'll generate descriptions later
    }));

    return bingoItems;
  } catch (error: any) {
    log(`Error generating bingo items: ${error?.message || "Unknown error"}`, "openai");
    return [];
  }
}

/**
 * Generate an image for a bingo item using OpenAI's GPT-Image model
 * Updated as of April 2025 to use the newer gpt-image-1 model
 * 
 * @param itemText The text of the bingo item
 * @param cityName The name of the city
 * @returns The URL of the generated image
 */
export async function generateItemImage(
  itemText: string,
  cityName: string
): Promise<string> {
  try {
    // Create a detailed prompt for the image
    const prompt = `A high-quality travel photograph of "${itemText}" in ${cityName}. No text overlay. Realistic style, vivid colors, daytime scene, tourist perspective.`;
    
    log(`Starting image generation via OpenAI API with gpt-image-1 model (updated April 2025), prompt: ${prompt}`, "openai-debug");
    
    // Prepare request body
    const reqBody = {
      model: "gpt-image-1", // Using gpt-image-1 for image generation (latest as of April 2025)
      prompt,
      n: 1
    };
    
    log(`Direct API call with params: ${JSON.stringify(reqBody)}`, "openai-debug");
    
    // Make direct API call to OpenAI
    const fetchResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(reqBody)
    });
    
    // Handle error responses
    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      log(`OpenAI API error (${fetchResponse.status}): ${errorText}`, "openai-debug");
      
      // Try to parse the error response
      try {
        const errorJson = JSON.parse(errorText);
        console.error('Detailed OpenAI error:', JSON.stringify(errorJson, null, 2));
      } catch (e) {
        // If it's not valid JSON, just use the raw text
        console.error('OpenAI error (raw text):', errorText);
      }
      
      throw new Error(`OpenAI API error: ${fetchResponse.status} - ${errorText}`);
    }
    
    // Process successful response
    const data = await fetchResponse.json();
    log(`OpenAI API success response received`, "openai-debug");
    
    // Check for base64 data in response (gpt-image-1 model returns base64 instead of URL)
    if (data.data && data.data.length > 0 && data.data[0].b64_json) {
      log(`Successfully received base64 image data from GPT-image-1 model`, "openai-debug");
      
      // For gpt-image-1 model we get base64 data directly
      const imageBase64 = data.data[0].b64_json;
      
      // Generate a filename
      const filename = `generated-${Date.now()}.png`;
      const filePath = `./public/images/${filename}`;
      
      try {
        // Make sure the directory exists
        const fs = require('fs');
        const path = require('path');
        const dirPath = './public/images';
        
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
          log(`Created images directory at ${dirPath}`, "openai-debug");
        }
        
        // Convert base64 to buffer and save to file
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        fs.writeFileSync(filePath, imageBuffer);
        
        // Return the path to the saved image
        const imageUrl = `/images/${filename}`;
        log(`Successfully saved base64 image to ${filePath}`, "openai-debug");
        return imageUrl;
      } catch (err) {
        // Handle as generic error object
        const error = err as Error;
        log(`Error saving base64 image: ${error.message || 'Unknown error'}`, "openai-debug");
        return "";
      }
    }
    
    // Check for URL in response (old model format)
    else if (data.data && data.data.length > 0 && data.data[0].url) {
      const imageUrl = data.data[0].url;
      log(`Successfully generated image with URL: ${imageUrl}`, "openai-debug");
      return imageUrl;
    }
    
    // No image data found in response
    log(`No image data found in response format`, "openai-debug");
    return "";
  } catch (error: any) {
    // Log detailed error information
    log(`Error generating image for ${itemText}: ${error?.message || "Unknown error"}`, "openai");
    log(`Error details: ${JSON.stringify(error)}`, "openai-debug");
    log(`Error stack: ${error?.stack}`, "openai-debug");
    return "";
  }
}