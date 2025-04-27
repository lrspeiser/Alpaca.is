import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useBingoStore } from "@/hooks/useBingoStore";
import { useEffect, useState } from "react";
import type { BingoItem } from "@/types";
import { ImageDebugger, type ImageLoadInfo } from "./ImageDebugger";
import { getProxiedImageUrl } from "../lib/imageUtils";

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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  // Improved function to get image URL from either property and handle local image paths
  const getImageUrl = (item: BingoItem & { imageUrl?: string }): string | null => {
    console.log(`[MODAL DEBUG] Item ${item.id} full data:`, item);
    
    // Try to get the image directly from either property
    const directImageUrl = item.image || (item as any).imageUrl;
    
    if (directImageUrl && typeof directImageUrl === 'string') {
      // Handle local image paths starting with /images
      if (directImageUrl.startsWith('/images/')) {
        console.log(`[MODAL] Found local image for ${item.id}: ${directImageUrl}`);
        return directImageUrl;
      }
      
      // Handle URLs starting with http
      if (directImageUrl.startsWith('http')) {
        console.log(`[MODAL] Found remote image URL for ${item.id}: ${directImageUrl.substring(0, 30)}...`);
        // Use the proxy for OpenAI URLs to avoid CORS and expiration issues
        const proxiedUrl = getProxiedImageUrl(directImageUrl);
        return proxiedUrl || directImageUrl;
      }
    }
    
    // No fallback - return null if no image is found
    console.log(`[MODAL] No valid image URL found for ${item.id}:`, directImageUrl);
    return null;
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
          {/* Use ImageDebugger to diagnose image loading issues */}
          <div className="mb-4 h-56 overflow-hidden rounded-lg">
            {localItem && (
              <ImageDebugger
                src={imageUrl}
                alt={localItem.text}
                className="w-full h-full object-cover"
                onLoadInfo={(info) => console.log(`[MODAL-IMAGE-DEBUG] ${localItem.id}:`, info)}
              />
            )}
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