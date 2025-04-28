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
  
  // Function to generate all images at once
  const handleGenerateAllImages = async () => {
    if (!city || isGenerating) return;
    
    setIsGenerating(true);
    setProgress(0);
    
    try {
      // Show toast to indicate we're starting
      toast({
        title: "Generating Images",
        description: `Starting image generation for ${totalItems - itemsWithImages} items in ${city.title}.`,
      });
      
      // Keep track of successful and failed generations
      let successCount = 0;
      let failCount = 0;
      let currentProgress = 0;
      
      // Process ALL items, including the center space ("Arrive in <cityName>")
      const itemsToGenerate = items; // No longer filtering out center space
      
      // Generate images in parallel with Promise.all
      const batchSize = 3; // Process 3 items concurrently as requested
      const batches = [];
      
      // Split items into batches for controlled parallelism
      for (let i = 0; i < itemsToGenerate.length; i += batchSize) {
        batches.push(itemsToGenerate.slice(i, i + batchSize));
      }
      
      console.log(`[BATCH] Processing ${itemsToGenerate.length} items in ${batches.length} batches of up to ${batchSize} items each`);
      
      // Process each batch in parallel with a delay between batches
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`[BATCH] Starting batch ${batchIndex + 1}/${batches.length} with ${batch.length} items`);
        
        try {
          // Create an array of promises, one for each item in the batch
          const batchPromises = batch.map(item => 
            generateImageForItem(city.id, item.id, item.text)
              .then(() => {
                successCount++;
                currentProgress++;
                setProgress(Math.round((currentProgress / itemsToGenerate.length) * 100));
                console.log(`[BATCH] Completed item ${item.id} (success)`);
                return { success: true, id: item.id };
              })
              .catch(error => {
                console.error(`[BATCH] Error generating image for ${item.id}:`, error);
                failCount++;
                currentProgress++;
                setProgress(Math.round((currentProgress / itemsToGenerate.length) * 100));
                return { success: false, id: item.id, error };
              })
          );
          
          // Wait for all promises in this batch to resolve before moving to the next batch
          const batchResults = await Promise.all(batchPromises);
          
          console.log(`[BATCH] Completed batch ${batchIndex + 1}/${batches.length}, success rate: ${batchResults.filter(r => r.success).length}/${batch.length}`);
          
          // Add a delay between batches to prevent API rate limiting
          if (batchIndex < batches.length - 1) {
            console.log(`[BATCH] Adding 5-second delay before next batch`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        } catch (error) {
          console.error(`[BATCH] Error processing batch ${batchIndex + 1}:`, error);
          // Continue to the next batch even if this one had errors
        }
      }
      
      // Refresh state to get the latest data with new images
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
  
  // Generate a single image with improved error handling
  const generateImageForItem = async (cityId: string, itemId: string, itemText: string) => {
    try {
      // Find the item in the city to get its description
      const item = items.find(item => item.id === itemId);
      const description = item?.description || "";
      
      console.log(`[IMAGE-GEN] Starting generation for ${itemId}: "${itemText}" with description length: ${description.length}`);
      
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cityId, 
          itemId,
          itemText, // Include both itemId and itemText to be safe
          description // Pass description to be used in image generation
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
      
      console.log(`[IMAGE-GEN] Successfully generated image for ${itemId}`);
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