import OpenAI from 'openai';
import { log } from './vite';

// Initialize OpenAI client
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  log('Warning: OPENAI_API_KEY environment variable is not set. AI description generation will not work.', 'openai');
}

const openai = new OpenAI({
  apiKey: apiKey,
});

/**
 * Generate a description for a bingo item using OpenAI
 * @param itemText The text of the bingo item
 * @param cityName The name of the city
 * @returns A description of the item with interesting facts or tips
 */
export async function generateItemDescription(itemText: string, cityName: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1", // This is the most recent model since April 2025. DO NOT change to an older model like gpt-4o
      messages: [
        {
          role: "system",
          content: `You are a travel guide writing for college students visiting ${cityName}. Your goal is to create exciting bucket list descriptions that focus on authentic experiences and inspire adventure.`
        },
        {
          role: "user",
          content: `Give fun descriptions of why college students must experience "${itemText}" in ${cityName} in a way that would excite a student while still educating. If it's an adventurous or wild activity, emphasize that aspect. Focus on authentic experiences, cultural significance, and historical context rather than social media trends. Don't mention posting to Instagram or TikTok. Keep responses to 2-3 sentences (max 80 words).`
        }
      ],
      max_tokens: 150,
      temperature: 0.8, // Slightly higher temperature for more creative responses
    });

    return response.choices[0].message.content || `${itemText} is a notable experience in ${cityName} with cultural and historical significance.`;
  } catch (error: any) {
    log(`Error generating description for ${itemText}: ${error?.message || 'Unknown error'}`, 'openai');
    return `${itemText} represents an important part of ${cityName}'s heritage and offers visitors insight into local culture and history.`;
  }
}

/**
 * Generate descriptions for multiple bingo items
 * @param items Array of bingo items with text
 * @param cityName The name of the city
 * @returns Array of descriptions
 */
export async function generateBulkDescriptions(
  items: Array<{ id: string; text: string }>,
  cityName: string
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  
  // Process items in batches to avoid rate limiting
  const batchSize = 5;
  const batches = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  for (const batch of batches) {
    const batchPromises = batch.map(async (item) => {
      const description = await generateItemDescription(item.text, cityName);
      results[item.id] = description;
    });
    
    // Wait for the current batch to complete before moving to the next
    await Promise.all(batchPromises);
    
    // Add a small delay between batches to avoid rate limiting
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}