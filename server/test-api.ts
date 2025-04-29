import OpenAI from "openai";
import { log } from "./vite";

// This file is used to test the OpenAI API with the updated model names

async function testOpenAI() {
  console.log("[TEST] Starting OpenAI API test");
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[TEST ERROR] OPENAI_API_KEY environment variable is not set. Test will fail.");
    return;
  }
  
  const openai = new OpenAI({
    apiKey: apiKey,
  });
  
  try {
    // Test text generation with gpt-4.1
    console.log("[TEST] Testing text generation with gpt-4.1 model...");
    const textResponse = await openai.chat.completions.create({
      model: "gpt-4.1", // This is the most recent model since April 2025. DO NOT change to an older model like gpt-4o
      messages: [
        {
          role: "system",
          content: "You are a test assistant. Respond with a simple 'Text generation test successful with gpt-4.1 model.'"
        },
        {
          role: "user",
          content: "Test the API connection"
        }
      ],
      max_tokens: 50,
    });
    
    console.log("[TEST SUCCESS] Text generation response:", textResponse.choices[0].message.content);
    
    // Test image generation with gpt-image-1 
    console.log("[TEST] Testing image generation with gpt-image-1 model...");
    const imageResponse = await openai.images.generate({
      model: "gpt-image-1", // Using gpt-image-1 for image generation - DO NOT change to dall-e-3
      prompt: "A simple test image of a sunrise over mountains. Square format.",
      n: 1,
      size: "1024x1024",
    });
    
    console.log("[TEST SUCCESS] Image response received:", JSON.stringify(imageResponse));
    
    // Safely access data if it exists
    const imageUrl = imageResponse?.data?.[0]?.url || "No URL available";
    console.log("[TEST SUCCESS] Image URL:", imageUrl);
    console.log("[TEST] OpenAI API test completed successfully");
    
  } catch (error: any) {
    console.error("[TEST ERROR] OpenAI API test failed:", error.message);
    console.error("[TEST ERROR] Error details:", error);
  }
}

// Run the test
testOpenAI();