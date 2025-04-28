import { Button } from "@/components/ui/button";
import { RefreshCw, X, Camera } from "lucide-react";
import { useBingoStore } from "@/hooks/useBingoStore";
import { useEffect, useState } from "react";
import type { BingoItem } from "@/types";
import { ImageDebugger, type ImageLoadInfo } from "./ImageDebugger";
import { getProxiedImageUrl } from "../lib/imageUtils";
import PhotoCaptureModal from "./PhotoCaptureModal";
import { useClientId } from '@/hooks/useClientId';

interface BingoItemModalProps {
  item: BingoItem | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleComplete?: () => void; // Optional callback to refresh grid after toggle
}

export default function BingoItemModal({ item, isOpen, onClose, onToggleComplete }: BingoItemModalProps) {
  const { toggleItemCompletion } = useBingoStore();
  const { clientId } = useClientId();
  
  // All state declarations must come before any other code
  const [localItem, setLocalItem] = useState<BingoItem | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);
  
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
  
  // Function to save the user-captured photo
  const saveUserPhoto = async (photoDataUrl: string) => {
    if (!localItem) return;
    
    try {
      const cityId = localItem.cityId;
      const itemId = localItem.id;
      
      console.log(`[MODAL] Saving user photo for item ${itemId} in city ${cityId}`);
      
      const response = await fetch('/api/save-user-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId,
          cityId,
          photoDataUrl,
          clientId
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`[MODAL] Successfully saved user photo: ${data.photoUrl}`);
        
        // Update local item with the user photo URL
        setLocalItem(prev => {
          if (!prev) return null;
          return {
            ...prev,
            userPhoto: data.photoUrl
          };
        });
        
        // Trigger grid refresh with the callback if provided
        if (onToggleComplete) {
          onToggleComplete();
        }
      } else {
        console.error(`[MODAL] Failed to save user photo: ${data.error}`);
      }
    } catch (error) {
      console.error("Error saving user photo:", error);
    }
  };

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
    
    // If marking as complete and not already completed, show photo capture modal
    if (completed && !localItem.completed) {
      setIsPhotoCaptureOpen(true);
      setIsToggling(false); // Reset toggling state while photo capture is open
      return; // Don't proceed with backend update yet
    }
    
    // Update backend
    try {
      await toggleItemCompletion(localItem.id);
      
      // Trigger grid refresh with the callback if provided
      if (onToggleComplete) {
        console.log('[MODAL] Calling onToggleComplete callback for immediate grid refresh');
        onToggleComplete();
      }
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
      // We don't close the modal here anymore, just let the callback handle state refresh
    }
  };
  
  // Handle photo capture completion
  const handlePhotoCapture = async (photoDataUrl: string) => {
    console.log('[MODAL] Photo captured, proceeding with save and item completion');
    
    // Save the photo first
    await saveUserPhoto(photoDataUrl);
    
    // Then proceed with marking the item as completed
    try {
      await toggleItemCompletion(localItem.id);
      
      // Trigger grid refresh with the callback if provided
      if (onToggleComplete) {
        console.log('[MODAL] Calling onToggleComplete callback after photo capture');
        onToggleComplete();
      }
    } catch (error) {
      console.error("Error toggling item completion after photo capture:", error);
      
      // Revert completed status
      setLocalItem(prev => {
        if (!prev) return null;
        return {
          ...prev,
          completed: false
        };
      });
    } finally {
      setIsToggling(false);
      setIsPhotoCaptureOpen(false);
      // We don't need to close the modal here if we want to preserve city selection
    }
  };
  
  // Handle cancel/skip from photo capture
  const handlePhotoCaptureClose = async () => {
    console.log('[MODAL] Photo capture skipped, proceeding with item completion');
    setIsPhotoCaptureOpen(false);
    
    // Still proceed with marking as completed
    try {
      await toggleItemCompletion(localItem.id);
      
      // Trigger grid refresh with the callback if provided
      if (onToggleComplete) {
        console.log('[MODAL] Calling onToggleComplete callback after photo skip');
        onToggleComplete();
      }
    } catch (error) {
      console.error("Error toggling item completion after photo skip:", error);
      
      // Revert completed status
      setLocalItem(prev => {
        if (!prev) return null;
        return {
          ...prev,
          completed: false
        };
      });
    } finally {
      setIsToggling(false);
      // Keep the modal open to preserve city selection
    }
  };
  
  return (
    <>
      {/* Main modal */}
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
            {/* Display user photo if available, otherwise show AI-generated image */}
            <div className="mb-4 aspect-square w-full max-w-md overflow-hidden rounded-lg">
              {localItem && (
                <ImageDebugger
                  src={localItem.userPhoto || imageUrl}
                  alt={localItem.text}
                  className="w-full h-full object-cover"
                  onLoadInfo={(info) => console.log(`[MODAL-IMAGE-DEBUG] ${localItem.id}:`, info)}
                />
              )}
            </div>
            
            {/* Show a "Take New Photo" button if the item is completed */}
            {localItem.completed && (
              <div className="flex justify-center mb-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => setIsPhotoCaptureOpen(true)}
                >
                  <Camera className="w-4 h-4" />
                  {localItem.userPhoto ? "Update Photo" : "Add Your Photo"}
                </Button>
              </div>
            )}
            
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
            
            <div className="flex space-x-3 mb-4">
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

            {/* Close button to preserve city selection */}
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={() => {
                // Call onToggleComplete to refresh the grid, but use onClose to close the modal
                if (onToggleComplete) onToggleComplete();
                onClose();
              }}
            >
              Close Window
            </Button>
          </div>
        </div>
      </div>
      
      {/* Photo capture modal */}
      <PhotoCaptureModal
        isOpen={isPhotoCaptureOpen}
        onClose={handlePhotoCaptureClose}
        onPhotoCapture={handlePhotoCapture}
        activityName={localItem?.text || ""}
      />
    </>
  );
}