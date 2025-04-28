import { Button } from "@/components/ui/button";
import { RefreshCw, X, Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { useBingoStore } from "@/hooks/useBingoStore";
import { useEffect, useState } from "react";
import type { BingoItem } from "@/types";
import { ImageDebugger, type ImageLoadInfo } from "./ImageDebugger";
import { getProxiedImageUrl } from "../lib/imageUtils";
import PhotoCaptureModal from "./PhotoCaptureModal";
import { useClientId } from '@/hooks/useClientId';
import { saveUserPhotoToIndexedDB, getUserPhotoFromIndexedDB } from "../lib/utils";

interface BingoItemModalProps {
  item: BingoItem | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleComplete?: () => void; // Optional callback to refresh grid after toggle
  allItems?: BingoItem[]; // All bingo items for navigation between items
}

export default function BingoItemModal({ item, isOpen, onClose, onToggleComplete, allItems = [] }: BingoItemModalProps) {
  const { toggleItemCompletion } = useBingoStore();
  const { clientId } = useClientId();
  
  // All state declarations must come before any other code
  const [localItem, setLocalItem] = useState<BingoItem | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);
  
  // We'll use the provided allItems or fetch them using the cityId from the provided item
  const items = allItems.length > 0 ? allItems : [];
  
  // Navigation functions for previous and next items
  const navigateToItem = (direction: 'prev' | 'next') => {
    if (!localItem || items.length === 0) return;
    
    // Find current item index
    const currentIndex = items.findIndex(i => i.id === localItem.id);
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'prev') {
      newIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
    } else {
      newIndex = currentIndex === items.length - 1 ? 0 : currentIndex + 1;
    }
    
    // Update the local item - this will trigger the useEffect to refresh everything
    console.log(`[MODAL] Navigating ${direction} from ${currentIndex} to ${newIndex}`);
    setLocalItem(items[newIndex]);
  };
  
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

      // Try to get user photo from IndexedDB
      const fetchUserPhoto = async () => {
        try {
          const cityId = localItem.cityId;
          const itemId = localItem.id;
          
          if (!cityId || !itemId) return;
          
          const photoDataUrl = await getUserPhotoFromIndexedDB(cityId, itemId);
          
          if (photoDataUrl) {
            console.log(`[MODAL] Found user photo in IndexedDB for ${itemId} in city ${cityId}`);
            setLocalItem(prev => {
              if (!prev) return null;
              return {
                ...prev,
                userPhoto: photoDataUrl
              };
            });
          }
        } catch (error) {
          console.error('Error fetching user photo from IndexedDB:', error);
        }
      };
      
      fetchUserPhoto();
    }
  }, [localItem]);
  
  if (!isOpen || !localItem) return null;
  
  // Visual feedback for toggling state
  const isPending = isToggling;
  
  // Function to save the user-captured photo to IndexedDB
  const saveUserPhoto = async (photoDataUrl: string) => {
    if (!localItem) return;
    
    try {
      const cityId = localItem.cityId;
      const itemId = localItem.id;
      
      console.log(`[MODAL] Saving user photo for item ${itemId} in city ${cityId} to IndexedDB`);
      
      // Save to IndexedDB
      const success = await saveUserPhotoToIndexedDB(cityId, itemId, photoDataUrl);
      
      if (success) {
        console.log(`[MODAL] Successfully saved user photo to IndexedDB`);
        
        // Update local item with the user photo URL
        setLocalItem(prev => {
          if (!prev) return null;
          return {
            ...prev,
            userPhoto: photoDataUrl
          };
        });
        
        // Trigger grid refresh with the callback if provided
        if (onToggleComplete) {
          onToggleComplete();
        }
      } else {
        console.error(`[MODAL] Failed to save user photo to IndexedDB`);
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
      // Also update the backend immediately to avoid state inconsistency
      try {
        await toggleItemCompletion(localItem.id);
        console.log('[MODAL] Item marked as completed in backend');
      } catch (error) {
        console.error("Error toggling item completion:", error);
        // Revert local state if there was an error
        setLocalItem(prev => {
          if (!prev) return null;
          return {
            ...prev,
            completed: false // Revert to not completed
          };
        });
        setIsToggling(false);
        return; // Don't proceed to photo capture if backend update failed
      }
      
      // Now open the photo capture modal
      setIsPhotoCaptureOpen(true);
      setIsToggling(false); // Reset toggling state while photo capture is open
      return; // Don't proceed with the rest of the function
    }
    
    // For marking as not done or other scenarios, update backend
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
          completed: !prev.completed // Toggle back
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
    
    // Ensure the item is marked as completed in both local state and backend
    // Make another call to the backend to ensure completion state is preserved
    try {
      // First update our local state
      setLocalItem(prev => {
        if (!prev) return null;
        return {
          ...prev,
          completed: true,
          userPhoto: photoDataUrl
        };
      });
      
      // Double-check that the backend knows this item is completed
      // This helps ensure the state doesn't get lost after photo capture
      if (localItem && localItem.id) {
        // Force the completed state to be true in the backend
        const isCurrentlyCompleted = true;
        await toggleItemCompletion(localItem.id, isCurrentlyCompleted);
      }
    } catch (error) {
      console.error("Error ensuring completion state after photo capture:", error);
    }
    
    // Trigger grid refresh with the callback if provided
    if (onToggleComplete) {
      console.log('[MODAL] Calling onToggleComplete callback after photo capture');
      onToggleComplete();
    }
    
    // Always clean up
    setIsToggling(false);
    setIsPhotoCaptureOpen(false);
    // Close the photo modal but keep the item modal open
  };
  
  // Handle cancel/skip from photo capture
  const handlePhotoCaptureClose = async () => {
    console.log('[MODAL] Photo capture skipped, proceeding with item completion');
    setIsPhotoCaptureOpen(false);
    
    // We already set the completed state when opening the photo modal,
    // so we just need to ensure it stays that way and refresh the grid
    if (onToggleComplete) {
      console.log('[MODAL] Calling onToggleComplete callback after photo skip');
      onToggleComplete();
    }
    
    // Clean up
    setIsToggling(false);
    // Keep the modal open to preserve city selection
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
          
          <div className="p-4 overflow-y-auto max-h-[calc(100vh-120px)]">
            {/* Display user photo if available, otherwise show AI-generated image with navigation arrows */}
            <div className="mb-3 aspect-square w-full max-w-md overflow-hidden rounded-lg relative">
              {localItem && (
                <ImageDebugger
                  src={localItem.userPhoto || imageUrl}
                  alt={localItem.text}
                  className="w-full h-full object-cover"
                  onLoadInfo={(info) => console.log(`[MODAL-IMAGE-DEBUG] ${localItem.id}:`, info)}
                />
              )}
              
              {/* Navigation arrows (only show if we have items to navigate through) */}
              {items.length > 1 && (
                <>
                  {/* Left arrow */}
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 rounded-full bg-white/70 hover:bg-white/90 shadow-md"
                    onClick={() => navigateToItem('prev')}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  
                  {/* Right arrow */}
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 rounded-full bg-white/70 hover:bg-white/90 shadow-md"
                    onClick={() => navigateToItem('next')}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}
            </div>
            
            {/* Show a "Take New Photo" button if the item is completed */}
            {localItem.completed && (
              <div className="flex justify-center mb-3">
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
            <div className="mb-4">
              {localItem.description ? (
                <div>
                  <h4 className="text-base font-bold mb-2 text-primary">About this activity:</h4>
                  <div className="text-base bg-gray-50 p-3 rounded-lg border border-gray-200 leading-tight shadow-sm">
                    {localItem.description}
                  </div>
                </div>
              ) : (
                <p className="text-base text-gray-600 italic">
                  Have you completed "{localItem.text}" yet? Mark it as done when you have!
                </p>
              )}
            </div>
            
            <div className="flex space-x-3">
              <Button 
                variant={localItem.completed ? "default" : "outline"} 
                className="flex-1"
                disabled={isPending || localItem.completed}
                onClick={() => handleToggleCompletion(true)}
              >
                {localItem.completed ? "Completed ✓" : "Mark as Done"}
              </Button>
              
              <Button 
                variant={!localItem.completed ? "default" : "outline"} 
                className="flex-1"
                disabled={isPending || !localItem.completed}
                onClick={() => handleToggleCompletion(false)}
              >
                {!localItem.completed ? "Not Done ✗" : "Mark as Not Done"}
              </Button>
            </div>
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