import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ImageIcon } from 'lucide-react';
import { useBingoStore } from '@/hooks/useBingoStore';
import { useToast } from '@/hooks/use-toast';
import type { BingoItem, City } from '@/types';

// Define the expected response type from our API with support for in-progress detection
interface GenerateImageResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
  message?: string;
  inProgress?: boolean; // For detecting duplicate image generation requests
}

interface GenerateAllImagesButtonProps {
  cityId?: string;  // Optional cityId parameter
}

// This is just a comment to maintain the spacing - the duplicate interface was removed

export default function GenerateAllImagesButton({ cityId }: GenerateAllImagesButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const { currentCity, cities, refreshState, isLoading } = useBingoStore();
  const { toast } = useToast();
  
  // Get the items from the specified city or current city
  const targetCityId = cityId || currentCity;
  const city = cities?.[targetCityId];
  const items = city?.items || [];
  
  // Only calculate these values when data is fully loaded
  const totalItems = !isLoading && city ? (city.itemCount || items.length) : 0;
  
  // Use precalculated values from the database when available
  const itemsWithImages = !isLoading && city ? (city.itemsWithImages || items.filter(item => !!item.image).length) : 0;
  
  // Generate a single image with improved error handling
  const generateImageForItem = async (cityId: string, itemId: string, itemText: string) => {
    try {
      // Find the item in the city to get its description
      const item = items.find(item => item.id === itemId);
      const description = item?.description || "";
      
      // Check if the city has a style guide
      const styleGuide = city?.styleGuide;
      const hasStyleGuide = !!(styleGuide && Object.keys(styleGuide).length > 0);
      
      console.log(`[IMAGE-GEN] Starting generation for ${itemId}: "${itemText}" with description length: ${description.length}, styleGuide: ${hasStyleGuide ? 'YES' : 'NO'}`);
      
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
          forceNewImage: true, // Force new image generation
          styleGuide: hasStyleGuide ? styleGuide : undefined // Explicitly include style guide if available
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
        
        // Special handling for in-progress duplication errors
        if (data.inProgress) {
          console.log(`[IMAGE-GEN] Item ${itemId} is already being processed: ${data.message}`);
          throw new Error(`Duplicate: ${data.message}`);
        }
        
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
  
  // Function to handle generating images simultaneously for all items
  const handleGenerateAllImages = async () => {
    if (!city || isGenerating) return;
    
    setIsGenerating(true);
    setProgress(0);
    
    let successCount = 0;
    let failCount = 0;
    let currentProgress = 0;
    
    // Keep track of which items have been processed to avoid duplicates
    const processedItemIds = new Set();
    
    try {
      toast({
        title: "Regenerating All Images",
        description: `Starting SIMULTANEOUS image generation with style guide for ALL ${totalItems} items in ${city.title}.`,
      });
      
      // Process ALL items, regardless of whether they already have images
      // This allows for regenerating all images with the new style guide
      const itemsToGenerate = items.filter(item => !processedItemIds.has(item.id));
      
      console.log(`[BATCH] Will regenerate ALL images for ${itemsToGenerate.length} items in ${city.title}`);
      
      // Early return if no items
      if (itemsToGenerate.length === 0) {
        console.log(`[BATCH] No items found, skipping generation`);
        toast({
          title: "No Items Found",
          description: `No bingo items found for ${city.title}.`,
        });
        setIsGenerating(false);
        return;
      }
      
      console.log(`[BATCH] Processing ${itemsToGenerate.length} items SIMULTANEOUSLY - sending all requests at once`);
      console.log(`[BATCH] Items for generation: ${itemsToGenerate.map(i => i.id).join(', ')}`);
      
      // Array to collect all generation promises
      const generationPromises = [];
      
      // Create all promises at once without waiting between them
      for (let i = 0; i < itemsToGenerate.length; i++) {
        const item = itemsToGenerate[i];
        const itemIndex = i;
        
        // Skip if we've already processed this item
        if (processedItemIds.has(item.id)) {
          console.log(`[BATCH] Skipping already processed item ${item.id}`);
          continue;
        }
        
        // Mark this item as being processed
        processedItemIds.add(item.id);
        
        console.log(`[BATCH] Queueing item ${itemIndex + 1}/${itemsToGenerate.length}: ${item.text} (ID: ${item.id})`);
        const startTime = Date.now();
        
        // Create a promise for this item and add it to the array immediately
        const itemPromise = (async () => {
          try {
            await generateImageForItem(city.id, item.id, item.text);
            successCount++;
            const timeElapsed = Math.round((Date.now() - startTime) / 1000);
            console.log(`[BATCH] Successfully generated image for item ${itemIndex + 1}/${itemsToGenerate.length} in ${timeElapsed}s (ID: ${item.id})`);
          } catch (error) {
            console.error(`[BATCH] Error generating image for ${item.id}:`, error);
            failCount++;
          } finally {
            currentProgress++;
            setProgress(Math.round((currentProgress / itemsToGenerate.length) * 100));
            
            // Refresh state every 5 items or when all are complete
            if (currentProgress % 5 === 0 || currentProgress === itemsToGenerate.length) {
              try {
                await refreshState();
                console.log(`[BATCH] State refreshed after ${currentProgress} items`);
              } catch (refreshError) {
                console.error(`[BATCH] Error refreshing state:`, refreshError);
              }
            }
          }
        })();
        
        generationPromises.push(itemPromise);
      }
      
      // All requests are now in flight!
      console.log(`[BATCH] All ${generationPromises.length} image generation requests have been sent!`);
      
      // Now wait for all of them to complete
      await Promise.all(generationPromises);
      
      // Final refresh when everything is done
      console.log(`[BATCH] All ${generationPromises.length} items completed! Refreshing state...`);
      await refreshState();
      
      // Update city metadata to reflect new image count
      try {
        console.log(`[BATCH] Updating city metadata after image regeneration...`);
        const metadataResponse = await fetch('/api/update-city-metadata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cityId: targetCityId }),
        });
        
        if (metadataResponse.ok) {
          console.log(`[BATCH] Successfully updated metadata for ${targetCityId}`);
        } else {
          console.error(`[BATCH] Failed to update metadata for ${targetCityId}`);
        }
      } catch (metadataError) {
        console.error(`[BATCH] Error updating metadata:`, metadataError);
      }
      
      toast({
        title: "Image Regeneration Complete",
        description: `Successfully regenerated ${successCount} images with style guides. ${failCount > 0 ? `Failed to generate ${failCount} images.` : ''} Metadata updated.`,
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
        : `Regenerate ALL Images (${totalItems} items)`
      }
    </Button>
  );
}