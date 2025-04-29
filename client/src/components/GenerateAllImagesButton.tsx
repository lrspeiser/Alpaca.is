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
  
  // Function to generate all images at once, with improved batching and database reliability
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
      
      // Process ALL items, including the center space ("Arrive in <cityName>")
      const itemsToGenerate = items;
      
      // Generate images in smaller batches with greater delays to ensure database updates complete
      const batchSize = 3; // Reduce batch size from 5 to 3 for better reliability
      const batches = [];
      
      // Split items into batches for controlled processing
      for (let i = 0; i < itemsToGenerate.length; i += batchSize) {
        batches.push(itemsToGenerate.slice(i, i + batchSize));
      }
      
      console.log(`[BATCH] Processing ${itemsToGenerate.length} items in ${batches.length} batches of up to ${batchSize} items each`);
      
      // Process batches one after another instead of creating all promises at once
      // This ensures proper database synchronization between batches
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`[BATCH] Starting batch ${batchIndex + 1}/${batches.length} with ${batch.length} items`);
        
        try {
          // Process each item in the batch one by one
          // This ensures proper database updates between items for greater reliability
          for (const item of batch) {
            try {
              // Generate the image
              await generateImageForItem(city.id, item.id, item.text);
              
              // Update progress
              successCount++;
              currentProgress++;
              setProgress(Math.round((currentProgress / itemsToGenerate.length) * 100));
              console.log(`[BATCH] Completed item ${item.id} (success)`);
            } catch (itemError) {
              console.error(`[BATCH] Error generating image for ${item.id}:`, itemError);
              failCount++;
              currentProgress++;
              setProgress(Math.round((currentProgress / itemsToGenerate.length) * 100));
            }
            
            // Small delay between items in the same batch (500ms)
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          console.log(`[BATCH] Completed batch ${batchIndex + 1}/${batches.length}`);
          
          // After each batch completes, refresh the state to ensure changes are reflected
          console.log(`[BATCH] Refreshing state after batch ${batchIndex + 1}`);
          try {
            await refreshState(); // This already forces a refresh in its implementation
            console.log(`[BATCH] Successfully refreshed state after batch ${batchIndex + 1}`);
          } catch (refreshError) {
            console.error(`[BATCH] Error refreshing state after batch ${batchIndex + 1}:`, refreshError);
          }
          
          // Add a delay between batches (5 seconds) to prevent overwhelming the server
          if (batchIndex < batches.length - 1) {
            console.log(`[BATCH] Waiting 5 seconds before starting next batch...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        } catch (batchError) {
          console.error(`[BATCH] Error processing batch ${batchIndex + 1}:`, batchError);
          // Continue to the next batch even if this one had errors
        }
      }
      
      // Final state refresh to ensure all changes are reflected
      console.log(`[BATCH] All batches completed! Refreshing state...`);
      try {
        await refreshState(); // This already forces a refresh in its implementation
        console.log(`[BATCH] Successfully completed final state refresh`);
      } catch (finalRefreshError) {
        console.error(`[BATCH] Error during final state refresh:`, finalRefreshError);
      }
      
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

  // Always show the button, even if all items have images
  // We'll now allow regenerating all images, not just missing ones

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