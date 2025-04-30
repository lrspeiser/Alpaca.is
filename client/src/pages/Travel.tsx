import { useState, useCallback, useEffect } from "react";
import Header from "@/components/Header";
import BingoGrid from "@/components/BingoGrid";
import BingoItemModal from "@/components/BingoItemModal";
import Footer from "@/components/Footer";
import { useBingoStore } from "@/hooks/useBingoStore";
import type { BingoItem } from "@/types";
import { getProxiedImageUrl } from "@/lib/imageUtils";

export default function Travel() {
  const [selectedItem, setSelectedItem] = useState<BingoItem | null>(null);
  const [gridRefreshTrigger, setGridRefreshTrigger] = useState(0);
  const [preloadedImages, setPreloadedImages] = useState<Record<string, boolean>>({});
  const { cities, currentCity, isLoading, fetchBingoState } = useBingoStore();
  
  // Function to force refresh both the bingo state and the grid display
  const forceGridRefresh = useCallback(() => {
    console.log('[TRAVEL] Forcing grid refresh after item update');
    // First refresh data from server
    fetchBingoState(true);
    // Then trigger grid refresh
    setGridRefreshTrigger(prev => prev + 1);
  }, [fetchBingoState]);
  
  // Preload all images when the city changes or items update
  useEffect(() => {
    if (isLoading || !cities[currentCity]) return;
    
    const items = cities[currentCity].items;
    const newPreloadedImages: Record<string, boolean> = {};
    
    console.log(`[IMAGE-PRELOAD] Preloading ${items.length} images for ${cities[currentCity].title}`);
    
    // Create a tracking variable to count loaded images
    let loadedCount = 0;
    
    items.forEach(item => {
      if (item.image) {
        const url = getProxiedImageUrl(item.image);
        
        // Skip if we've already preloaded this image
        if (preloadedImages[url]) {
          loadedCount++;
          newPreloadedImages[url] = true;
          return;
        }
        
        // Create a new image object to preload the image
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          newPreloadedImages[url] = true;
          console.log(`[IMAGE-PRELOAD] Loaded ${loadedCount}/${items.filter(i => i.image).length} images for ${cities[currentCity].title}`);
          
          // Update state only when all images have been preloaded
          if (loadedCount === items.filter(i => i.image).length) {
            setPreloadedImages(prev => ({...prev, ...newPreloadedImages}));
            console.log(`[IMAGE-PRELOAD] All images preloaded for ${cities[currentCity].title}`);
          }
        };
        img.onerror = () => {
          console.log(`[IMAGE-PRELOAD] Failed to preload image: ${url}`);
          loadedCount++;
          
          // Even on error, update state when all images have been attempted
          if (loadedCount === items.filter(i => i.image).length) {
            setPreloadedImages(prev => ({...prev, ...newPreloadedImages}));
            console.log(`[IMAGE-PRELOAD] All images attempted to preload for ${cities[currentCity].title}`);
          }
        };
        img.src = url;
      }
    });
  }, [cities, currentCity, isLoading, preloadedImages]);
  
  // If still loading data, show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-heading font-bold mb-4">Loading...</h2>
          <div className="animate-pulse w-24 h-24 bg-primary/20 rounded-full mx-auto flex items-center justify-center">
            <div className="w-16 h-16 bg-primary/40 rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }
  
  const city = cities[currentCity];
  
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />
      
      <main className="flex-grow w-full px-0 py-2">
        {/* Bingo Grid with title and refresh trigger */}
        <BingoGrid 
          onItemClick={setSelectedItem} 
          refreshTrigger={gridRefreshTrigger} 
        />
      </main>
      
      <Footer />
      
      {/* Bingo Item Modal with refresh callback and all city items for navigation */}
      <BingoItemModal 
        item={selectedItem} 
        isOpen={!!selectedItem} 
        onClose={() => {
          setSelectedItem(null);
          // Force refresh the grid after closing the modal to show updated state
          forceGridRefresh();
        }}
        onToggleComplete={forceGridRefresh}
        allItems={(city?.items || []).map(item => ({
          ...item,
          cityId: currentCity // Ensure every item has the cityId property set
        }))}
      />
    </div>
  );
}
