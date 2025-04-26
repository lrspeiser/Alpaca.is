import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useBingoStore } from "@/hooks/useBingoStore";
import { useEffect } from "react";

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InfoModal({ isOpen, onClose }: InfoModalProps) {
  const { cities, currentCity } = useBingoStore();
  const city = cities[currentCity];
  
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl max-w-md w-11/12 max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
          <h3 className="font-heading font-bold text-lg">About Travel Bingo</h3>
          <Button 
            variant="ghost" 
            size="iconSm" 
            className="rounded-full" 
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-5">
          <div className="mb-6">
            <h4 className="font-heading font-semibold mb-2">How to Play</h4>
            <ol className="text-sm space-y-2 list-decimal pl-5">
              <li>Explore the city and complete the activities on your bingo card</li>
              <li>Tap an activity once you've completed it to mark it off</li>
              <li>Try to complete a full row, column, or diagonal for a "BINGO"</li>
              <li>Challenge yourself to complete the entire card!</li>
            </ol>
          </div>
          
          {city?.tips && city.tips.length > 0 && (
            <div className="mb-6">
              <h4 className="font-heading font-semibold mb-2">
                {city.title.replace(" Bingo", "")} Tips
              </h4>
              <ul className="text-sm space-y-2">
                {city.tips.map((tip, index) => (
                  <li key={index}>
                    <span className="font-medium">{tip.title}</span> - {tip.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <p className="text-xs text-gray-600">
            All progress is stored locally on your device. No data is shared or sent anywhere.
          </p>
        </div>
      </div>
    </div>
  );
}
