import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ImageIcon } from 'lucide-react';
import { useBingoStore } from '@/hooks/useBingoStore';
import { useToast } from '@/hooks/use-toast';
import type { BingoItem, City } from '@/types';

// Define the expected response type from our API
interface GenerateImageResponse {
  success: boolean;
  error?: string;
  imageUrl?: string;
}

interface GenerateAllImagesButtonProps {
  cityId?: string;  // Optional cityId parameter
}

export default function GenerateAllImagesButton({ cityId }: GenerateAllImagesButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const { currentCity, cities, refreshState } = useBingoStore();
  const { toast } = useToast();
  
  // Get the items from the specified city or current city
  const targetCityId = cityId || currentCity;
  const city = cities?.[targetCityId];
  const items = city?.items || [];
  const totalItems = items.length;
  
  // Count items that already have images
  const itemsWithImages = items.filter(item => !!item.image).length;
  
  // Generate a single image with improved error handling
  const generateImageForItem = async (cityId: string, itemId: string, itemText: string) => {
    try {
      // Find the item in the city to get its description
      const item = items.find(item => item.id === itemId);
      const description = item?.description || "";
      
      console.log(`[IMAGE-GEN] Starting generation for ${itemId}: "${itemText}" with description length: ${description.length}`);
      
      // Get client ID from localStorage to ensure backend can associate the request with the user
      // Use empty string as fallback instead of undefined/null to avoid Zod validation errors
      const clientId = localStorage.getItem('clientId') || "batch-user";
      
      // Log the HTTP request details for debugging
      console.log(`[IMAGE-GEN] Sending request with clientId: ${clientId}`);
      
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cityId, 
          itemId,
          itemText, // Include both itemId and itemText to be safe
          description, // Pass description to be used in image generation
          clientId, // Include client ID for proper tracking in database
          forceNewImage: true // Force new image generation
        }),
      });
      
      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[IMAGE-GEN] HTTP error (${response.status}): ${errorText}`);
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      // Parse the response
      let data;
      try {
        data = await response.json() as GenerateImageResponse;
      } catch (parseError) {
        console.error(`[IMAGE-GEN] Error parsing JSON response: ${parseError}`);
        throw new Error('Invalid server response');
      }
      
      // Check for API errors
      if (!data.success) {
        console.error(`[IMAGE-GEN] API error: ${data.error || 'Unknown error'}`);
        throw new Error(data.error || 'Failed to generate image');
      }
      
      console.log(`[IMAGE-GEN] Successfully generated image for ${itemId}: ${data.imageUrl ? data.imageUrl.substring(0, 30) + '...' : 'No URL returned'}`);
      
      // Verify we got a valid image URL back
      if (!data.imageUrl) {
        throw new Error('No image URL returned from server');
      }
      
      return data.imageUrl;
    } catch (error) {
      console.error(`[IMAGE-GEN] Error generating image for ${itemId}:`, error);
      // Re-throw to let the caller handle it
      throw error;
    }
  };
  
  // Function to generate all images at once with new timing logic
  const handleGenerateAllImages = async () => {
    if (!city || isGenerating) return;
    
    setIsGenerating(true);
    setProgress(0);
    
    try {
      // Show toast to indicate we're starting
      toast({
        title: "Generating Images",
        description: `Starting image generation for ${totalItems} items in ${city.title}.`,
      });
      
      // Keep track of successful and failed generations
      let successCount = 0;
      let failCount = 0;
      let currentProgress = 0;
      
      // Use all items for generation
      const itemsToGenerate = items;
      
      // Process items sequentially with a 3-second delay between starts
      console.log(`[BATCH] Processing ${itemsToGenerate.length} items sequentially with 3-second delay between each`);
      
      // Process items one at a time with fixed delay between starts
      for (let i = 0; i < itemsToGenerate.length; i++) {
        const item = itemsToGenerate[i];
        console.log(`[BATCH] Starting item ${i + 1}/${itemsToGenerate.length}: ${item.text}`);
        
        // Start a timer for tracking generation time
        const startTime = Date.now();
        
        try {
          // Process this item
          await generateImageForItem(city.id, item.id, item.text);
          successCount++;
          const timeElapsed = Math.round((Date.now() - startTime) / 1000);
          console.log(`[BATCH] Successfully generated image for item ${i + 1}/${itemsToGenerate.length} in ${timeElapsed}s`);
        } catch (error) {
          console.error(`[BATCH] Error generating image for ${item.id}:`, error);
          failCount++;
        }
        
        // Update progress regardless of success/failure
        currentProgress++;
        setProgress(Math.round((currentProgress / itemsToGenerate.length) * 100));
        
        // Refresh state every 5 items
        if (currentProgress % 5 === 0 || currentProgress === itemsToGenerate.length) {
          try {
            await refreshState();
            console.log(`[BATCH] State refreshed after ${currentProgress} items`);
          } catch (error) {
            console.error(`[BATCH] Error refreshing state:`, error);
          }
        }
        
        // Wait 3 seconds before starting the next item (but skip the wait after the last item)
        if (i < itemsToGenerate.length - 1) {
          console.log(`[BATCH] Waiting 3 seconds before starting next item...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // Final state refresh
      console.log(`[BATCH] All items completed! Refreshing state...`);
      await refreshState();
      
      // Show completion toast
      toast({
        title: "Image Generation Complete",
        description: `Successfully generated ${successCount} images. ${failCount > 0 ? `Failed to generate ${failCount} images.` : ''}`,
        variant: failCount > 0 ? "destructive" : "default",
      });
    } catch (error) {
      console.error("Error in generate all images flow:", error);
      toast({
        title: "Error",
        description: "Failed to generate all images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };
  
  return (
    <Button
      className="w-full mb-4 items-center gap-2"
      onClick={handleGenerateAllImages}
      disabled={isGenerating}
      variant="outline"
    >
      <ImageIcon className="h-4 w-4" />
      {isGenerating 
        ? `Generating Images (${progress}%)` 
        : `Generate All Images (${totalItems} items)`
      }
    </Button>
  );
}