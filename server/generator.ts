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
 * @returns An array of bingo items
 */
export async function generateBingoItems(
  cityId: string,
  cityName: string
): Promise<BingoItem[]> {
  try {
    // Prepare the prompt for OpenAI specifically for college students
    const prompt = `
      What are 24 things a college student must experience in ${cityName} (food, sights, experiences)? Make them iconic and specifically appealing to college-aged travelers.
      
      Make each item brief (5-10 words), specific, action-oriented, and unique to ${cityName}.
      Include a mix of famous landmarks, food experiences, cultural activities, nightlife, and hidden gems that would appeal to students.
      Focus on social experiences, budget-friendly options, and Instagram-worthy moments.
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
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a travel content creator specialized in crafting engaging travel experiences for college students. Your recommendations should be exciting, authentic, and appeal to young adult travelers on a budget."
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
 * Generate a style guide for a city
 * 
 * @param cityName The name of the city
 * @returns A style guide object with art styles and their best uses
 */
export async function generateStyleGuide(cityName: string): Promise<any> {
  try {
    // Create a prompt for generating the style guide
    const prompt = `
    Create a visual style guide for ${cityName} photos that will be used in a travel bingo app.
    
    Generate 5 artistic/photographic styles that would best represent different aspects of ${cityName}.
    
    For each style, provide:
    1. A name for the style (like "Neo-Gothic Fairytale" or "Vintage Film Retro")
    2. What subjects/locations this style works best for
    3. 3-5 keywords that describe this style
    
    Return the result as a JSON object that looks like this:
    {
      "styleGuide": [
        {
          "style": "Neo-Gothic Fairytale",
          "bestFor": "Castles, bridges, cathedrals",
          "keywords": "Dramatic, romantic, misty"
        },
        {
          "style": "Vintage Film Retro",
          "bestFor": "Streets, cafés, squares",
          "keywords": "Nostalgic, faded, timeless"
        }
      ]
    }

    Make the styles diverse and appropriate for ${cityName}'s unique character and architecture.
    `;

    // Call OpenAI API to generate style guide
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a professional art director with expertise in travel photography and city aesthetics. You create detailed style guides that capture a city's unique visual identity."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    // Process the response
    const content = response.choices[0].message.content;
    if (!content) {
      log(`Empty response from OpenAI when generating style guide for ${cityName}`, "openai");
      return { styleGuide: [] };
    }

    // Parse the JSON response
    try {
      const styleGuide = JSON.parse(content);
      log(`Successfully generated style guide for ${cityName} with ${styleGuide.styleGuide.length} styles`, "openai");
      return styleGuide;
    } catch (parseError) {
      log(`Error parsing style guide JSON for ${cityName}: ${parseError.message}`, "openai");
      return { styleGuide: [] };
    }
  } catch (error: any) {
    log(`Error generating style guide for ${cityName}: ${error?.message || "Unknown error"}`, "openai");
    return { styleGuide: [] };
  }
}

/**
 * Generate an image for a bingo item using OpenAI's GPT-Image model
 * Updated as of April 2025 to use the newer gpt-image-1 model with square aspect ratio
 * 
 * @param itemText The text of the bingo item
 * @param cityName The name of the city
 * @param description Optional item description to provide context for image generation
 * @param styleGuide Optional style guide to use for generating the image
 * @returns The URL of the generated image (local file path or OpenAI URL)
 */
export async function generateItemImage(
  itemText: string,
  cityName: string,
  description?: string,
  styleGuide?: any
): Promise<string> {
  try {
    // Base prompt
    let prompt = `Create a high-quality square image of "${itemText}" in ${cityName}.`;
    
    // If we have a style guide, choose an appropriate style based on the item text
    if (styleGuide && styleGuide.styleGuide && styleGuide.styleGuide.length > 0) {
      // Create lowercase versions of text for better matching
      const lowercaseText = itemText.toLowerCase();
      
      // Find the best matching style by checking keywords in the item text
      let bestStyle = styleGuide.styleGuide[0]; // Default to first style
      let bestMatch = 0;
      
      for (const style of styleGuide.styleGuide) {
        // Check if any words from bestFor appear in the item text
        const bestForWords = style.bestFor.toLowerCase().split(/[,\s]+/);
        const keywordWords = style.keywords.toLowerCase().split(/[,\s]+/);
        const allWords = [...bestForWords, ...keywordWords];
        
        let matches = 0;
        for (const word of allWords) {
          if (word.length > 2 && lowercaseText.includes(word)) { // Only consider words longer than 2 characters
            matches++;
          }
        }
        
        if (matches > bestMatch) {
          bestMatch = matches;
          bestStyle = style;
        }
      }
      
      // Add the selected style to the prompt
      prompt += ` Use the "${bestStyle.style}" style (${bestStyle.keywords}). No text overlay. Square 1:1 aspect ratio.`;
      
      log(`Selected "${bestStyle.style}" style for "${itemText}"`, "openai-debug");
    } else {
      // Default prompt if no style guide is available
      prompt += ` Use the artistic style or photographic approach that best suits the subject matter and location. No text overlay. Square 1:1 aspect ratio. Choose between photography, illustration, painting, or other medium that works best for this specific subject.`;
    }
    
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
    let fetchResponse: Response | undefined;
    const maxRetries = 2;
    let attempts = 0;
    
    while (attempts <= maxRetries) {
      try {
        attempts++;
        log(`API attempt ${attempts}/${maxRetries + 1} for item "${itemText}"`, "openai-debug");
        
        // Use AbortController to implement a timeout - increased to 120s per user request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout
        
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
    
    // Handle error responses or if no response was received
    if (!fetchResponse) {
      log(`No response received after all retry attempts`, "openai-debug");
      throw new Error(`Failed to get response from OpenAI API after ${maxRetries + 1} attempts`);
    }
    
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