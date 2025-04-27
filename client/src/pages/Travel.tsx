import { useState } from "react";
import Header from "@/components/Header";
import BingoGrid from "@/components/BingoGrid";
import BingoItemModal from "@/components/BingoItemModal";
import InfoModal from "@/components/InfoModal";
import Footer from "@/components/Footer";
import GenerateDescriptionsButton from "@/components/GenerateDescriptionsButton";
import GenerateAllImagesButton from "@/components/GenerateAllImagesButton";
import { useBingoStore } from "@/hooks/useBingoStore";
import type { BingoItem } from "@/types";

export default function Travel() {
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BingoItem | null>(null);
  const { cities, currentCity, isLoading } = useBingoStore();
  
  // If still loading data, show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-heading font-bold mb-4">Loading Travel Bingo...</h2>
          <div className="animate-pulse w-24 h-24 bg-primary/20 rounded-full mx-auto flex items-center justify-center">
            <div className="w-16 h-16 bg-primary/40 rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }
  
  const city = cities[currentCity];
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header onOpenInfoModal={() => setIsInfoModalOpen(true)} />
      
      <main className="flex-grow container mx-auto px-4 py-6">
        {/* City subtitle */}
        <div className="mb-6 text-center">
          <p className="text-sm text-gray-600">{city.subtitle}</p>
        </div>
        
        {/* Generate All Images button - only shown when there are images to generate */}
        <div className="mb-2">
          <GenerateAllImagesButton />
        </div>
        
        {/* Bingo Grid with title */}
        <BingoGrid onItemClick={setSelectedItem} />
      </main>
      
      <Footer />
      
      {/* Info Modal */}
      <InfoModal 
        isOpen={isInfoModalOpen} 
        onClose={() => setIsInfoModalOpen(false)}
      />
      
      {/* Bingo Item Modal */}
      <BingoItemModal 
        item={selectedItem} 
        isOpen={!!selectedItem} 
        onClose={() => setSelectedItem(null)} 
      />
    </div>
  );
}
