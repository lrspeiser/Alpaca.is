import { useState } from "react";
import Header from "@/components/Header";
import BingoGrid from "@/components/BingoGrid";
import BingoItemModal from "@/components/BingoItemModal";
import InfoModal from "@/components/InfoModal";
import Footer from "@/components/Footer";
import { useBingoStore } from "@/hooks/useBingoStore";
import type { BingoItem } from "@/types";

export default function Travel() {
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BingoItem | null>(null);
  const { cities, currentCity } = useBingoStore();
  const city = cities[currentCity];
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header onOpenInfoModal={() => setIsInfoModalOpen(true)} />
      
      <main className="flex-grow container mx-auto px-4 py-6">
        {/* City Header */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-heading font-bold">{city.title}</h2>
          <p className="text-sm text-gray-600 mt-1">{city.subtitle}</p>
        </div>
        
        {/* Bingo Grid */}
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
