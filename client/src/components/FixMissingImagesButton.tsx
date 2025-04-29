import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ImageIcon, AlertCircle } from 'lucide-react';
import { useBingoStore } from '@/hooks/useBingoStore';
import { useToast } from '@/hooks/use-toast';
import type { BingoItem, City } from '@/types';

// Define the expected response type from our API
interface GenerateImageResponse {
  success: boolean;
  error?: string;
  imageUrl?: string;
}

interface FixMissingImagesButtonProps {
  cityId?: string;  // Optional cityId parameter
}

export default function FixMissingImagesButton({ cityId }: FixMissingImagesButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const { currentCity, cities, refreshState } = useBingoStore();
  const { toast } = useToast();
  
  // Get the items from the specified city or current city
  const targetCityId = cityId || currentCity;
  const city = cities?.[targetCityId];
  const items = city?.items || [];
  
  // Find items with placeholder images
  const itemsWithPlaceholders = items.filter(item => 
    item.image?.includes('/api/placeholder-image') || !item.image
  );
  
  const totalPlaceholders = itemsWithPlaceholders.length;
  
  // Function to fix missing or placeholder images
  const handleFixMissingImages = async () => {
    if (!city || isGenerating || totalPlaceholders === 0) return;
    
    setIsGenerating(true);
    setProgress(0);
    
    try {
      // Show toast to indicate we're starting
      toast({
        title: "Fixing Missing Images",
        description: `Generating images for ${totalPlaceholders} items with missing or placeholder images in ${city.title}.`,
      });
      
      // Keep track of successful and failed generations
      let successCount = 0;
      let failCount = 0;
      let currentProgress = 0;
      
      // Only process items with placeholder or missing images
      console.log(`[FIX] Found ${totalPlaceholders} items with missing or placeholder images in ${city.title}`);
      console.log(`[FIX] Item IDs to fix:`, itemsWithPlaceholders.map(item => item.id).join(', '));
      
      // Process each item one by one to ensure maximum reliability
      for (const item of itemsWithPlaceholders) {
        console.log(`[FIX] Processing item ${item.id}: "${item.text}"`);
        
        try {
          // Generate the image with 3 retries if needed
          await generateImageForItem(city.id, item.id, item.text, 3);
          
          // Update progress
          successCount++;
          currentProgress++;
          setProgress(Math.round((currentProgress / totalPlaceholders) * 100));
          console.log(`[FIX] Successfully fixed item ${item.id}`);
          
          // Refresh state after each item for maximum reliability
          await refreshState();
        } catch (error) {
          console.error(`[FIX] Failed to fix item ${item.id}:`, error);
          failCount++;
          currentProgress++;
          setProgress(Math.round((currentProgress / totalPlaceholders) * 100));
        }
        
        // Add a small delay between items to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Final state refresh
      console.log(`[FIX] All items processed! Refreshing state...`);
      await refreshState();
      
      // Show completion toast
      toast({
        title: "Fix Operation Complete",
        description: `Successfully fixed ${successCount} images. ${failCount > 0 ? `Failed to fix ${failCount} images.` : ''}`,
        variant: failCount > 0 ? "destructive" : "default",
      });
    } catch (error) {
      console.error("Error in fix missing images flow:", error);
      toast({
        title: "Error",
        description: "Failed to fix missing images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };
  
  // Generate a single image with improved error handling and retries
  const generateImageForItem = async (cityId: string, itemId: string, itemText: string, maxRetries = 1) => {
    let retryCount = 0;
    let lastError;
    
    while (retryCount <= maxRetries) {
      try {
        if (retryCount > 0) {
          console.log(`[FIX] Retry ${retryCount}/${maxRetries} for item ${itemId}`);
        }
        
        // Find the item in the city to get its description
        const item = items.find(item => item.id === itemId);
        const description = item?.description || "";
        
        console.log(`[FIX] Generating image for ${itemId}: "${itemText}" with description length: ${description.length}`);
        
        // Get client ID from localStorage to ensure backend can associate the request with the user
        // Use empty string as fallback instead of undefined/null to avoid Zod validation errors
        const clientId = localStorage.getItem('clientId') || "fix-missing-images";
        
        // Log the HTTP request details for debugging
        console.log(`[FIX] Sending request with clientId: ${clientId}`);
        
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
          console.error(`[FIX] HTTP error (${response.status}): ${errorText}`);
          throw new Error(`HTTP error ${response.status}: ${errorText}`);
        }
        
        // Parse the response
        let data;
        try {
          data = await response.json() as GenerateImageResponse;
        } catch (parseError) {
          console.error(`[FIX] Error parsing JSON response: ${parseError}`);
          throw new Error('Invalid server response');
        }
        
        // Check for API errors
        if (!data.success) {
          console.error(`[FIX] API error: ${data.error || 'Unknown error'}`);
          throw new Error(data.error || 'Failed to generate image');
        }
        
        console.log(`[FIX] Successfully generated image for ${itemId}: ${data.imageUrl ? data.imageUrl.substring(0, 30) + '...' : 'No URL returned'}`);
        
        // Verify we got a valid image URL back
        if (!data.imageUrl) {
          throw new Error('No image URL returned from server');
        }
        
        return data.imageUrl;
      } catch (error) {
        console.error(`[FIX] Error generating image for ${itemId} (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);
        lastError = error;
        retryCount++;
        
        // If we have retries left, wait before trying again
        if (retryCount <= maxRetries) {
          const backoffMs = 1000 * Math.pow(2, retryCount - 1); // Exponential backoff
          console.log(`[FIX] Waiting ${backoffMs}ms before retry ${retryCount}...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }
    
    // If we've exhausted all retries, throw the last error
    throw lastError || new Error(`Failed to generate image for ${itemId} after ${maxRetries + 1} attempts`);
  };

  // Only show the button if there are items with placeholder images
  if (totalPlaceholders === 0) {
    return null;
  }

  return (
    <Button
      className="w-full mb-4 items-center gap-2"
      onClick={handleFixMissingImages}
      disabled={isGenerating}
      variant="destructive"
    >
      {isGenerating ? (
        <>
          <ImageIcon className="h-4 w-4 animate-pulse" />
          Fixing Images ({progress}%)
        </>
      ) : (
        <>
          <AlertCircle className="h-4 w-4" />
          Fix {totalPlaceholders} Missing Images
        </>
      )}
    </Button>
  );
}