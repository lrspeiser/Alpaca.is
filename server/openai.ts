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
      model: "gpt-4o", // Using gpt-4o which is OpenAI's latest model
      messages: [
        {
          role: "system",
          content: `You are a knowledgeable travel guide providing detailed, engaging information about tourist attractions and experiences in ${cityName}. Limit your response to 2-3 sentences (max 80 words).`
        },
        {
          role: "user",
          content: `Provide interesting facts, practical tips, or historical context about "${itemText}" in ${cityName}. Include specific details like location info, best time to visit, or cultural significance.`
        }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    return response.choices[0].message.content || `Interesting facts about ${itemText} in ${cityName}`;
  } catch (error: any) {
    log(`Error generating description for ${itemText}: ${error?.message || 'Unknown error'}`, 'openai');
    return `Discover the beauty and history of ${itemText} in the wonderful city of ${cityName}.`;
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