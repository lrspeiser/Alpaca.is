import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useBingoStore } from "@/hooks/useBingoStore";
import { Image, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface FixMissingImagesButtonProps {
  cityId?: string;  // Optional cityId parameter
}

export default function FixMissingImagesButton({ cityId }: FixMissingImagesButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentItem, setCurrentItem] = useState("");
  const { toast } = useToast();
  const { fetchBingoState, cities } = useBingoStore();

  // Function to find items missing images
  const findMissingImages = (cityId: string) => {
    if (!cities[cityId]) return [];
    
    return cities[cityId].items
      .filter(item => {
        // Skip center item
        if (item.isCenterSpace) return false;
        
        // Find items with no image or placeholder images
        return !item.image || item.image.includes("placeholder");
      })
      .map(item => ({
        id: item.id,
        text: item.text
      }));
  };

  const handleFixMissingImages = async () => {
    // If no cityId specified, don't proceed
    if (!cityId) {
      toast({
        title: "Error",
        description: "No city selected for image generation",
        variant: "destructive"
      });
      return;
    }
    
    // Find items that need images
    const itemsNeedingImages = findMissingImages(cityId);
    
    if (itemsNeedingImages.length === 0) {
      toast({
        title: "No missing images",
        description: `All items in ${cities[cityId]?.title || cityId} already have images.`,
        duration: 3000
      });
      return;
    }
    
    // Setup progress tracking
    setIsGenerating(true);
    setTotal(itemsNeedingImages.length);
    setProgress(0);
    
    // Notify user we're starting
    toast({
      title: "Fixing missing images",
      description: `Found ${itemsNeedingImages.length} items without proper images. This process will run in the background.`,
      duration: 5000
    });
    
    // Process each item sequentially 
    let successCount = 0;
    let errorCount = 0;
    
    try {
      for (let i = 0; i < itemsNeedingImages.length; i++) {
        const item = itemsNeedingImages[i];
        setCurrentItem(item.text);
        
        try {
          console.log(`[FIX] Generating image for ${item.id}: ${item.text}`);
          
          // Call API to generate image
          const response = await apiRequest(
            "POST",
            "/api/generate-image",
            { itemId: item.id, cityId, forceNewImage: true }
          );
          
          const data = await response.json();
          if (data.success) {
            successCount++;
            console.log(`[FIX] Successfully generated image for ${item.id}`);
          } else {
            errorCount++;
            console.error(`[FIX] Failed to generate image for ${item.id}:`, data.error);
          }
        } catch (error) {
          errorCount++;
          console.error(`[FIX] Error generating image for ${item.id}:`, error);
        }
        
        // Update progress
        setProgress(i + 1);
        
        // Refresh state every 3 items to show progress
        if ((i + 1) % 3 === 0 || i === itemsNeedingImages.length - 1) {
          await fetchBingoState(true);
        }
        
        // Add a slight delay to prevent overwhelming the API
        if (i < itemsNeedingImages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Final status notification
      toast({
        title: "Image repair complete",
        description: `Successfully fixed ${successCount} images${errorCount > 0 ? `, but ${errorCount} failed` : ''}.`,
        duration: 5000
      });
    } catch (error) {
      console.error("[FIX] Error in fix missing images process:", error);
      toast({
        title: "Process interrupted",
        description: "An error occurred while fixing missing images. Some images may have been generated.",
        variant: "destructive",
        duration: 5000
      });
    } finally {
      // Reset state
      setIsGenerating(false);
      setCurrentItem("");
      
      // Final refresh to show all changes
      await fetchBingoState(true);
    }
  };

  // Calculate missing images count
  const missingImagesCount = cityId ? findMissingImages(cityId).length : 0;

  return (
    <div className="space-y-2">
      {isGenerating ? (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>Fixing images ({progress}/{total})</span>
            <span>{Math.round((progress / total) * 100)}%</span>
          </div>
          <Progress value={(progress / total) * 100} className="h-2" />
          {currentItem && (
            <p className="text-xs truncate">{currentItem}</p>
          )}
        </div>
      ) : (
        <Button
          variant={missingImagesCount > 0 ? "destructive" : "outline"}
          size="sm"
          className="w-full"
          onClick={handleFixMissingImages}
          disabled={missingImagesCount === 0}
        >
          {missingImagesCount > 0 ? (
            <>
              <AlertTriangle className="mr-2 h-4 w-4" />
              Fix {missingImagesCount} Missing Images
            </>
          ) : (
            <>
              <Image className="mr-2 h-4 w-4" />
              No Missing Images
            </>
          )}
        </Button>
      )}
    </div>
  );
}
