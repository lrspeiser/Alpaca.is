import OpenAI from "openai";
import { log } from "./vite";
import { v4 as uuidv4 } from "uuid";
import fs from 'fs';
import path from 'path';
import type { BingoItem } from "../shared/schema";
import { processOpenAIImageUrl } from "./imageStorage";

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
      Provide a list of 24 things a college student must experience in ${cityName} (food, sights, experiences). Make them iconic!
      
      Make each item brief (5-10 words), specific, action-oriented, and unique to ${cityName}.
      Include a mix of famous landmarks, food experiences, cultural activities, nightlife, and hidden gems that would appeal to students.
      These items should be bucket list type items for a college student and include some wild adventures in addition to the traditional sights and culinary experiences.
      Avoid generic items that could apply to any city.
      Do not include "Arrive in ${cityName}" as this is already the center square.
      
      Response format: Return a JSON object with an "items" array containing objects with this format:
      {
        "items": [
          { "text": "Visit Eiffel Tower" },
          { "text": "Eat croissant at local bakery" },
          ...
        ]
      }
    `;

    // Call OpenAI API with appropriate parameters
    const response = await openai.chat.completions.create({
      model: "gpt-4.1", // This is the most recent model since April 2025. DO NOT change to an older model like gpt-4o
      messages: [
        {
          role: "system",
          content: "You are a travel content creator specialized in crafting engaging travel experiences for college students. Your recommendations should be exciting, fun, educational, and include adventurous bucket list items. Include some wild and memorable experiences alongside traditional tourist highlights. Always return valid JSON conforming to the exact format requested in the prompt."
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
    if (!parsedContent || typeof parsedContent !== 'object') {
      throw new Error("Invalid JSON response from OpenAI - not an object");
    }
    
    if (!parsedContent.items || !Array.isArray(parsedContent.items)) {
      // Log the actual response for debugging
      log(`OpenAI response format error: ${JSON.stringify(parsedContent)}`, "openai");
      throw new Error("Invalid response format from OpenAI - items array missing");
    }
    
    const itemArray = parsedContent.items;
    
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
      model: "gpt-4.1", // This is the most recent model since April 2025. DO NOT change to an older model like gpt-4o
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
    } catch (parseError: unknown) {
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      log(`Error parsing style guide JSON for ${cityName}: ${errorMessage}`, "openai");
      return { styleGuide: [] };
    }
  } catch (error: any) {
    log(`Error generating style guide for ${cityName}: ${error?.message || "Unknown error"}`, "openai");
    return { styleGuide: [] };
  }
}

/**
 * Generate an image for a bingo item using OpenAI's DALL-E-3 model
 * Using square aspect ratio for consistent display in bingo grid
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
  // We used to have special handling for Washington DC, but now we'll generate 
  // images for all cities including Washington DC
  if (cityName.toLowerCase().includes("washington") || cityName.toLowerCase().includes("d.c.")) {
    log(`[CITY DEBUG] Generating image for Washington DC item: ${itemText}`, "openai-debug");
    console.log(`[DC PROCESSING] Processing Washington DC item: "${itemText}"`);
    // Continue with normal image generation, no special handling
  }
  
  try {
    // Record start time for performance tracking
    const startTime = Date.now();
    
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
    
    log(`Starting image generation via OpenAI API with dall-e-3 model, prompt: ${prompt}`, "openai-debug");
    
    // Prepare request body with explicit square size - removed potentially unsupported parameters
    const reqBody = {
      model: "dall-e-3", // Using dall-e-3 for image generation since the gpt-image-1 model is not available
      prompt,
      size: "1024x1024", // Force square aspect ratio
      n: 1
    };
    
    log(`Direct API call with params: ${JSON.stringify(reqBody)}`, "openai-debug");
    console.log(`[OPENAI IMAGE] Generating image for: "${itemText}" in ${cityName}`);
    
    // Make direct API call to OpenAI with timeout and retry logic
    let fetchResponse: Response | undefined;
    const maxRetries = 2;
    let attempts = 0;
    
    while (attempts <= maxRetries) {
      try {
        attempts++;
        log(`API attempt ${attempts}/${maxRetries + 1} for item "${itemText}"`, "openai-debug");
        console.log(`[OPENAI ATTEMPT] Try #${attempts} for "${itemText}"`);
        
        // Use AbortController to implement a timeout - 120s to ensure completion
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.log(`[OPENAI TIMEOUT] Request timed out after 120s for "${itemText}"`);
        }, 120000); // 120 second timeout
        
        // Include debugging headers
        fetchResponse = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "X-Request-ID": `bingo-${Date.now()}-${Math.random().toString(36).substring(2, 10)}` // Add unique ID for tracking
          },
          body: JSON.stringify(reqBody),
          signal: controller.signal
        });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        // Break out of the retry loop if the request was successful
        if (fetchResponse.ok) {
          const processingTime = Date.now() - startTime;
          log(`Successful API response on attempt ${attempts}`, "openai-debug");
          console.log(`[OPENAI SUCCESS] Image generated in ${processingTime}ms for "${itemText}"`);
          break;
        }
        
        // If we get here, the response was not OK
        const errorText = await fetchResponse.text();
        log(`API error on attempt ${attempts}: ${errorText}`, "openai-debug");
        console.log(`[OPENAI ERROR] Attempt ${attempts} failed with: ${errorText.substring(0, 100)}...`);
        
        // For 429 (too many requests) or 5xx errors, retry after a delay
        if (fetchResponse.status === 429 || (fetchResponse.status >= 500 && fetchResponse.status < 600)) {
          if (attempts <= maxRetries) {
            const delay = attempts * 2000; // Exponential backoff: 2s, 4s
            log(`Retrying after ${delay}ms for status ${fetchResponse.status}`, "openai-debug");
            console.log(`[OPENAI RETRY] Waiting ${delay}ms before retry for "${itemText}"`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // For other errors or if we've exhausted retries, break out of the loop
        break;
      } catch (error: any) {
        if (error.name === 'AbortError') {
          log(`Request timed out on attempt ${attempts}`, "openai-debug");
          console.log(`[OPENAI ABORT] Request aborted for "${itemText}": ${error.message}`);
        } else {
          log(`Fetch error on attempt ${attempts}: ${error.message}`, "openai-debug");
          console.log(`[OPENAI FETCH ERROR] Error for "${itemText}": ${error.message}`);
        }
        
        if (attempts <= maxRetries) {
          const delay = attempts * 2000; // Increased backoff: 2s, 4s
          log(`Retrying after ${delay}ms due to error`, "openai-debug");
          console.log(`[OPENAI RETRY] Waiting ${delay}ms after error for "${itemText}"`);
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
    
    // Process the response data from DALL-E-3
    let imageUrl: string | null = null;
    
    // Handle URL format
    if (data.data && data.data.length > 0 && data.data[0].url) {
      imageUrl = data.data[0].url;
      log(`Successfully generated image with URL: ${imageUrl}`, "openai-debug");
    } 
    // Handle base64 format
    else if (data.data && data.data.length > 0 && data.data[0].b64_json) {
      // Create a data URL from the base64 data
      const b64Data = data.data[0].b64_json;
      imageUrl = `data:image/png;base64,${b64Data}`;
      log(`Successfully generated image with base64 data (length: ${b64Data.length})`, "openai-debug");
    }
    
    if (imageUrl) {
      
      try {
        // Download and store the image locally
        const localImageUrl = await processOpenAIImageUrl(
          imageUrl,
          cityName.toLowerCase().replace(/[^a-z0-9]/g, ''), // cityId
          `${cityName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`, // itemId
          itemText,
          true // force new image
        );
        
        if (localImageUrl) {
          log(`Successfully processed and stored image locally: ${localImageUrl}`, "openai-debug");
          return localImageUrl;
        } else {
          // If local processing fails, return the OpenAI URL directly
          log(`Local image processing failed, using direct OpenAI URL: ${imageUrl}`, "openai-debug");
          return imageUrl;
        }
      } catch (processError: any) {
        // If processing fails, log the error but still return the original URL
        log(`Error processing image locally: ${processError.message}`, "openai-debug");
        console.error('Image processing error:', processError);
        return imageUrl;
      }
    }
    
    // No image data found in response - throw an error instead of using placeholder
    log(`No image data found in response format`, "openai-debug");
    throw new Error(`Failed to generate image: OpenAI API response did not contain valid image data for "${itemText}" in ${cityName}`);
  } catch (error: any) {
    // Log detailed error information
    log(`Error generating image for ${itemText}: ${error?.message || "Unknown error"}`, "openai");
    log(`Error details: ${JSON.stringify(error)}`, "openai-debug");
    log(`Error stack: ${error?.stack}`, "openai-debug");
    
    // Throw the error instead of returning a placeholder
    throw new Error(`Failed to generate image for "${itemText}" in ${cityName}: ${error?.message || "Unknown error"}`);
  }
}