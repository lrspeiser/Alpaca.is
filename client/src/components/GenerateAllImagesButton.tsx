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
      
      // Process items that don't already have images
      const itemsToGenerate = items.filter(item => !item.image);
      
      // Generate images one by one (parallel generation could overload the API)
      for (const item of itemsToGenerate) {
        try {
          await generateImageForItem(city.id, item.id, item.text);
          successCount++;
        } catch (error) {
          console.error(`Error generating image for ${item.id}:`, error);
          failCount++;
        }
        
        // Update progress
        currentProgress++;
        setProgress(Math.round((currentProgress / itemsToGenerate.length) * 100));
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
  
  // Generate a single image
  const generateImageForItem = async (cityId: string, itemId: string, itemText: string) => {
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId, itemId, text: itemText }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate image');
    }
    
    const data = await response.json() as GenerateImageResponse;
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to generate image');
    }
    
    return data.imageUrl;
  };

  // If there are no items without images, don't show the button
  if (itemsWithImages >= totalItems) {
    return null;
  }

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
        : `Generate All Images (${totalItems - itemsWithImages} remaining)`
      }
    </Button>
  );
}