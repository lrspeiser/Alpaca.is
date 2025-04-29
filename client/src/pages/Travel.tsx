import { useState, useCallback } from "react";
import Header from "@/components/Header";
import BingoGrid from "@/components/BingoGrid";
import BingoItemModal from "@/components/BingoItemModal";
import Footer from "@/components/Footer";
import CityResetButton from "@/components/CityResetButton";
import { useBingoStore } from "@/hooks/useBingoStore";
import type { BingoItem } from "@/types";

export default function Travel() {
  const [selectedItem, setSelectedItem] = useState<BingoItem | null>(null);
  const [gridRefreshTrigger, setGridRefreshTrigger] = useState(0);
  const { cities, currentCity, isLoading, fetchBingoState } = useBingoStore();
  
  // Function to force refresh both the bingo state and the grid display
  const forceGridRefresh = useCallback(() => {
    console.log('[TRAVEL] Forcing grid refresh after item update');
    // First refresh data from server
    fetchBingoState(true);
    // Then trigger grid refresh
    setGridRefreshTrigger(prev => prev + 1);
  }, [fetchBingoState]);
  
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
        
        {/* City Reset Button */}
        {city && (
          <div className="container mx-auto px-4 mb-4 flex justify-center">
            <CityResetButton 
              cityId={currentCity} 
              cityName={city.title}
            />
          </div>
        )}
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
