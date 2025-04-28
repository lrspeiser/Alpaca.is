import OpenAI from "openai";
import { log } from "./vite";
import { v4 as uuidv4 } from "uuid";
import fs from 'fs';
import path from 'path';
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
 * Updated as of April 2025 to use the newer gpt-image-1 model with square aspect ratio
 * 
 * @param itemText The text of the bingo item
 * @param cityName The name of the city
 * @param description Optional item description to provide context for image generation
 * @returns The URL of the generated image (local file path or OpenAI URL)
 */
export async function generateItemImage(
  itemText: string,
  cityName: string,
  description?: string
): Promise<string> {
  try {
    // Create a detailed prompt for the image that incorporates the description if available
    // Use a more flexible instruction for art style based on the subject matter
    let prompt = `Create a high-quality square image of "${itemText}" in ${cityName} using the artistic style or photographic approach that best suits the subject matter and location. No text overlay. Square 1:1 aspect ratio. Choose between photography, illustration, painting, or other medium that works best for this specific subject.`;
    
    // Add description details to the prompt if available
    if (description) {
      // Truncate description if it's too long
      const shortDescription = description.length > 200 
        ? description.substring(0, 200) + '...' 
        : description;
      
      prompt += ` Context: ${shortDescription}`;
    }
    
    log(`Starting image generation via OpenAI API with gpt-image-1 model (updated April 2025), prompt: ${prompt}`, "openai-debug");
    
    // Prepare request body with explicit square size - removed potentially unsupported parameters
    const reqBody = {
      model: "gpt-image-1", // Using gpt-image-1 for image generation (latest as of April 2025)
      prompt,
      size: "1024x1024", // Force square aspect ratio
      n: 1
    };
    
    log(`Direct API call with params: ${JSON.stringify(reqBody)}`, "openai-debug");
    
    // Make direct API call to OpenAI with timeout and retry logic
    let fetchResponse;
    const maxRetries = 2;
    let attempts = 0;
    
    while (attempts <= maxRetries) {
      try {
        attempts++;
        log(`API attempt ${attempts}/${maxRetries + 1} for item "${itemText}"`, "openai-debug");
        
        // Use AbortController to implement a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        fetchResponse = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify(reqBody),
          signal: controller.signal
        });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        // Break out of the retry loop if the request was successful
        if (fetchResponse.ok) {
          log(`Successful API response on attempt ${attempts}`, "openai-debug");
          break;
        }
        
        // If we get here, the response was not OK
        const errorText = await fetchResponse.text();
        log(`API error on attempt ${attempts}: ${errorText}`, "openai-debug");
        
        // For 429 (too many requests) or 5xx errors, retry after a delay
        if (fetchResponse.status === 429 || (fetchResponse.status >= 500 && fetchResponse.status < 600)) {
          if (attempts <= maxRetries) {
            const delay = attempts * 1000; // Exponential backoff: 1s, 2s
            log(`Retrying after ${delay}ms for status ${fetchResponse.status}`, "openai-debug");
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // For other errors or if we've exhausted retries, break out of the loop
        break;
      } catch (error: any) {
        if (error.name === 'AbortError') {
          log(`Request timed out on attempt ${attempts}`, "openai-debug");
        } else {
          log(`Fetch error on attempt ${attempts}: ${error.message}`, "openai-debug");
        }
        
        if (attempts <= maxRetries) {
          const delay = attempts * 1000;
          log(`Retrying after ${delay}ms due to error`, "openai-debug");
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error; // Re-throw if we've exhausted retries
      }
    }
    
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
        // Use the path module to ensure consistent path handling
        const dirPath = path.join(process.cwd(), 'public', 'images');
        const fullFilePath = path.join(process.cwd(), 'public', 'images', filename);
        
        // Make sure the directory exists
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
          log(`Created images directory at ${dirPath}`, "openai-debug");
        }
        
        // Convert base64 to buffer and save to file
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        fs.writeFileSync(fullFilePath, imageBuffer);
        
        // Return the path to the saved image
        const imageUrl = `/images/${filename}`;
        log(`Successfully saved base64 image to ${fullFilePath}`, "openai-debug");
        return imageUrl;
      } catch (err) {
        // Handle as generic error object
        const error = err as Error;
        log(`Error saving base64 image: ${error.message || 'Unknown error'}`, "openai-debug");
        console.error('Image saving error details:', error);
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