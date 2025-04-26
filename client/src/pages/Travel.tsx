import { useState } from "react";
import Header from "@/components/Header";
import BingoGrid from "@/components/BingoGrid";
import ProgressBar from "@/components/ProgressBar";
import InfoModal from "@/components/InfoModal";
import Footer from "@/components/Footer";
import { useBingoStore } from "@/hooks/useBingoStore";

export default function Travel() {
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
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
        
        {/* Progress Bar */}
        <ProgressBar />
        
        {/* Bingo Grid */}
        <BingoGrid />
      </main>
      
      <Footer />
      
      {/* Info Modal */}
      <InfoModal 
        isOpen={isInfoModalOpen} 
        onClose={() => setIsInfoModalOpen(false)}
      />
    </div>
  );
}
