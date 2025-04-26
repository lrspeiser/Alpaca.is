import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useBingoStore } from "@/hooks/useBingoStore";
import { useEffect } from "react";
import type { BingoItem } from "@/types";

interface BingoItemModalProps {
  item: BingoItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function BingoItemModal({ item, isOpen, onClose }: BingoItemModalProps) {
  const { toggleItemCompletion } = useBingoStore();
  
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
  
  if (!isOpen || !item) return null;
  
  const handleToggleCompletion = (completed: boolean) => {
    toggleItemCompletion(item.id);
    onClose();
  };
  
  // Collection of reliable travel-themed images (same as in BingoGrid)
  const travelImages = [
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1530521954074-e64f6810b32d?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1504150558240-0b4fd8946624?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1499678329028-101435549a4e?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1504542982118-59308b40fe0c?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1513581166391-887a96ddeafd?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1502791451862-7bd8c1df43a7?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1502920514313-52581002a659?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1517760444937-f6397edcbbcd?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1504150558240-0b4fd8946624?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1491331568367-8f21c7269f6d?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1503221043305-f7498f8b7888?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1454942901704-3c44c11b2ad1?auto=format&fit=crop&w=600&h=400&q=80",
    "https://images.unsplash.com/photo-1498307833015-e7b400441eb8?auto=format&fit=crop&w=600&h=400&q=80"
  ];

  // Get image URL using same logic as in BingoGrid
  const getImageUrl = (item: BingoItem) => {
    if (item.image) return item.image;
    
    // Generate a consistent image for the same item by using the id as a hash
    const idNumber = parseInt(item.id.replace(/[^0-9]/g, "")) || 0;
    const imageIndex = idNumber % travelImages.length;
    return travelImages[imageIndex];
  };
  
  const imageUrl = getImageUrl(item);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl max-w-md w-11/12 max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
          <h3 className="font-heading font-bold text-lg">{item.text}</h3>
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
          <div className="mb-4 h-48 overflow-hidden rounded-lg">
            <img 
              src={imageUrl} 
              alt={item.text} 
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="mb-6">
            <p className="text-sm">
              {item.description || `Have you completed "${item.text}" yet? Mark it as done when you have!`}
            </p>
          </div>
          
          <div className="flex space-x-3">
            <Button 
              variant={item.completed ? "default" : "outline"} 
              className="flex-1"
              onClick={() => handleToggleCompletion(true)}
            >
              {item.completed ? "Completed ✓" : "Mark as Done"}
            </Button>
            
            <Button 
              variant={!item.completed ? "default" : "outline"} 
              className="flex-1"
              onClick={() => handleToggleCompletion(false)}
            >
              {!item.completed ? "Not Done ✗" : "Mark as Not Done"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}