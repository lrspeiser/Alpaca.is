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
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are a cool, relatable travel guide specializing in experiences for college students visiting ${cityName}. Your descriptions should be exciting, fun, and educational. Keep responses to 2-3 sentences (max 80 words) and use language that appeals to college-aged travelers.`
        },
        {
          role: "user",
          content: `Give me a fun description of why college students must experience "${itemText}" in ${cityName} that would excite a student while still being educational. Include practical tips (like student discounts, best times, or Instagram spots), fun historical facts, or social aspects. Make it sound exciting and FOMO-inducing!`
        }
      ],
      max_tokens: 150,
      temperature: 0.8, // Slightly higher temperature for more creative responses
    });

    return response.choices[0].message.content || `Discover the excitement of ${itemText} in the awesome city of ${cityName}!`;
  } catch (error: any) {
    log(`Error generating description for ${itemText}: ${error?.message || 'Unknown error'}`, 'openai');
    return `You absolutely have to experience ${itemText} while in ${cityName} - it's a must for every college student's bucket list!`;
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