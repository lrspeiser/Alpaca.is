import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useBingoStore } from "@/hooks/useBingoStore";
import { useEffect, useState } from "react";
import type { BingoItem } from "@/types";

interface BingoItemModalProps {
  item: BingoItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function BingoItemModal({ item, isOpen, onClose }: BingoItemModalProps) {
  const { toggleItemCompletion } = useBingoStore();
  
  // All state declarations must come before any other code
  const [localItem, setLocalItem] = useState<BingoItem | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  
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
    "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=600&h=400&q=80"
  ];
  
  // Get image URL for an item
  const getImageUrl = (item: BingoItem) => {
    if (item.image) {
      return item.image;
    }
    
    // Fallback to placeholder image
    const idNumber = parseInt(item.id.replace(/[^0-9]/g, "")) || 0;
    const imageIndex = idNumber % travelImages.length;
    return travelImages[imageIndex];
  };
  
  // Update local state when item changes
  useEffect(() => {
    if (item) {
      setLocalItem(item);
    }
  }, [item]);
  
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
  
  // Update image URL when item changes
  useEffect(() => {
    if (localItem) {
      const url = getImageUrl(localItem);
      setImageUrl(url);
    }
  }, [localItem]);
  
  if (!isOpen || !localItem) return null;
  
  // Visual feedback for toggling state
  const isPending = isToggling;
  
  const handleToggleCompletion = async (completed: boolean) => {
    // Update local state immediately
    setIsToggling(true);
    setLocalItem(prev => {
      if (!prev) return null;
      return {
        ...prev,
        completed: !prev.completed
      };
    });
    
    // Update backend
    try {
      await toggleItemCompletion(localItem.id);
    } catch (error) {
      console.error("Error toggling item completion:", error);
      // Revert local state if there was an error
      setLocalItem(prev => {
        if (!prev) return null;
        return {
          ...prev,
          completed: !prev.completed
        };
      });
    } finally {
      setIsToggling(false);
      // Close the modal after toggling is complete
      onClose();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
          <h3 className="font-heading font-bold text-lg">{localItem.text}</h3>
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
          {/* Display AI-generated image if available, or fallback to placeholder */}
          <div className="mb-4 h-56 overflow-hidden rounded-lg">
            <img 
              src={imageUrl} 
              alt={localItem.text} 
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* AI-generated description with improved styling */}
          <div className="mb-6">
            {localItem.description ? (
              <div>
                <h4 className="text-base font-bold mb-2 text-primary">About this activity:</h4>
                <div className="text-sm bg-gray-50 p-4 rounded-lg border border-gray-200 leading-relaxed shadow-sm">
                  {localItem.description}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 italic">
                Have you completed "{localItem.text}" yet? Mark it as done when you have!
              </p>
            )}
          </div>
          
          <div className="flex space-x-3">
            <Button 
              variant={localItem.completed ? "default" : "outline"} 
              className="flex-1"
              disabled={isPending}
              onClick={() => handleToggleCompletion(true)}
            >
              {localItem.completed ? "Completed ✓" : "Mark as Done"}
            </Button>
            
            <Button 
              variant={!localItem.completed ? "default" : "outline"} 
              className="flex-1"
              disabled={isPending}
              onClick={() => handleToggleCompletion(false)}
            >
              {!localItem.completed ? "Not Done ✗" : "Mark as Not Done"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}