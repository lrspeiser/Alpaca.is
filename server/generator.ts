import OpenAI from "openai";
import { log } from "./vite";
import { v4 as uuidv4 } from "uuid";
import type { BingoItem } from "../shared/schema";

// Initialize OpenAI client
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  log('Warning: OPENAI_API_KEY environment variable is not set. AI generation will not work.', 'openai');
}

const openai = new OpenAI({
  apiKey: apiKey,
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
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
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
 * Generate an image for a bingo item using DALL-E
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
    
    // Call OpenAI to generate the image
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural", // Use a natural photography style
    });

    // Return the image URL
    if (response.data && response.data.length > 0) {
      return response.data[0].url || "";
    }
    return "";
  } catch (error: any) {
    log(`Error generating image for ${itemText}: ${error?.message || "Unknown error"}`, "openai");
    return "";
  }
}