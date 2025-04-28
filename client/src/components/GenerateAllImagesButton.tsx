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

export default function GenerateAllImagesButton() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const { currentCity, cities, refreshState } = useBingoStore();
  const { toast } = useToast();
  
  // Get the items from the current city
  const city = cities?.[currentCity];
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
      
      // Process all items, not just the ones without images
      const itemsToGenerate = items.filter(item => !item.isCenterSpace);
      
      // Process items one at a time to avoid API rate limits
      for (let i = 0; i < itemsToGenerate.length; i++) {
        try {
          const item = itemsToGenerate[i];
          console.log(`[BATCH] Processing item ${i+1}/${itemsToGenerate.length}: ${item.id}`);
          
          try {
            await generateImageForItem(city.id, item.id, item.text);
            successCount++;
          } catch (error) {
            console.error(`Error generating image for ${item.id}:`, error);
            failCount++;
          }
          
          // Update progress after each item
          currentProgress++;
          setProgress(Math.round((currentProgress / itemsToGenerate.length) * 100));
          
          // Add a longer delay between requests to prevent API rate limiting (3 seconds)
          if (i < itemsToGenerate.length - 1) {
            console.log(`[BATCH] Adding 3-second delay before next request (${i+1}/${itemsToGenerate.length} complete)`);
            await new Promise(resolve => setTimeout(resolve, 3000)); 
          }
        } catch (error) {
          console.error(`Error processing item ${i}:`, error);
          // Continue to the next item even if this one had errors
          failCount++;
          currentProgress++;
          setProgress(Math.round((currentProgress / itemsToGenerate.length) * 100));
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