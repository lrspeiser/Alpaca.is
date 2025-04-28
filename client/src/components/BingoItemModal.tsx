import { Button } from "@/components/ui/button";
import { RefreshCw, X, Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { useBingoStore } from "@/hooks/useBingoStore";
import { useEffect, useState, useRef } from "react";
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
  const { toggleItemCompletion, currentCity } = useBingoStore();
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
    if (!localItem || items.length === 0) {
      console.log(`[MODAL] Cannot navigate: localItem=${!!localItem}, items.length=${items.length}`);
      return;
    }
    
    // Find current item index, use both id and cityId for a more robust match
    const currentIndex = items.findIndex(i => i.id === localItem.id);
    
    if (currentIndex === -1) {
      console.log(`[MODAL] Cannot navigate: item ${localItem.id} not found in items array of length ${items.length}`);
      console.log(`[MODAL] Item cityId: ${localItem.cityId}, Current City: ${currentCity}`);
      
      // Attempt a recovery by manually setting cityId on all items
      const enhancedItems = items.map(item => ({
        ...item,
        cityId: currentCity
      }));
      
      // Try finding the item again
      const recoveryIndex = enhancedItems.findIndex(i => i.id === localItem.id);
      if (recoveryIndex === -1) {
        console.log(`[MODAL] Navigation recovery failed`);
        return;
      }
      
      console.log(`[MODAL] Navigation recovery succeeded, found item at index ${recoveryIndex}`);
      
      let newIndex;
      if (direction === 'prev') {
        newIndex = recoveryIndex === 0 ? enhancedItems.length - 1 : recoveryIndex - 1;
      } else {
        newIndex = recoveryIndex === enhancedItems.length - 1 ? 0 : recoveryIndex + 1;
      }
      
      // Update with an enhanced item that has the correct cityId
      const enhancedItem = {
        ...enhancedItems[newIndex],
        cityId: currentCity
      };
      
      console.log(`[MODAL] Navigating ${direction} to recovered item ${enhancedItem.id}`);
      setLocalItem(enhancedItem);
      return;
    }
    
    // Normal navigation path
    let newIndex;
    if (direction === 'prev') {
      newIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
    } else {
      newIndex = currentIndex === items.length - 1 ? 0 : currentIndex + 1;
    }
    
    // Ensure the cityId is properly set on the item we're navigating to
    const nextItem = {
      ...items[newIndex],
      cityId: currentCity // Always ensure cityId is set
    };
    
    // Update the local item - this will trigger the useEffect to refresh everything
    console.log(`[MODAL] Navigating ${direction} from ${currentIndex} to ${newIndex}`);
    setLocalItem(nextItem);
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
  
  // Using optimistic UI updates pattern - no need for state synchronization with refs
  
  if (!isOpen || !localItem) return null;
  
  // Visual feedback for toggling state
  const isPending = isToggling;
  
  // Function to save the user-captured photo to IndexedDB
  const saveUserPhoto = async (photoDataUrl: string) => {
    if (!localItem) return;
    
    try {
      // Ensure we have correct cityId from the current item
      // This is critical - sometimes cityId might not be set on the item
      const cityId = localItem.cityId || currentCity; // Fallback to current city from store
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
            cityId: cityId, // Ensure cityId is set correctly
            userPhoto: photoDataUrl
          };
        });
        
        // Trigger grid refresh with the callback if provided
        if (onToggleComplete) {
          console.log(`[MODAL] Triggering grid refresh after saving photo for ${itemId} in ${cityId}`);
          onToggleComplete();
        }
      } else {
        console.error(`[MODAL] Failed to save user photo to IndexedDB`);
      }
    } catch (error) {
      console.error("Error saving user photo:", error);
    }
  };

  // Simplified handleToggleCompletion using optimistic UI updates pattern
  const handleToggleCompletion = async (completed: boolean) => {
    console.log(`[MODAL] Toggle completion called with completed=${completed}`);
    
    // Guard against repeated clicks
    if (isToggling) {
      console.log('[MODAL] Ignoring repeated toggle request while pending');
      return;
    }
    
    // Don't allow toggling center space
    if (localItem?.isCenterSpace) {
      console.log('[MODAL] Cannot toggle center space');
      return;
    }
    
    // Start toggling transition
    setIsToggling(true);
    
    // STEP 1: Optimistically update local UI state immediately
    setLocalItem(prev => {
      if (!prev) return null;
      console.log(`[MODAL] Optimistically updating UI to completed=${completed}`);
      return {
        ...prev,
        completed: completed
      };
    });
    
    // Special case: If marking as complete, show photo capture modal
    if (completed) {
      try {
        // STEP 2: Update server state
        console.log(`[MODAL] Sending completed=${completed} to server for item ${localItem?.id}`);
        await toggleItemCompletion(localItem.id, completed, false);
        
        // STEP 3: On success, open photo capture
        console.log('[MODAL] Server update successful, opening photo capture');
        setIsPhotoCaptureOpen(true);
        setIsToggling(false);
        
        // Also refresh the grid for immediate feedback
        if (onToggleComplete) {
          console.log('[MODAL] Refreshing grid after successful server update');
          onToggleComplete();
        }
        
        return; // Exit here, photo capture will handle the rest
      } catch (error) {
        // STEP 4: On error, revert the optimistic update
        console.error('[MODAL] Server update failed, reverting UI:', error);
        setLocalItem(prev => {
          if (!prev) return null;
          return {
            ...prev,
            completed: !completed // Revert to original state
          };
        });
        setIsToggling(false);
        return;
      }
    }
    
    // For marking as not done, simpler flow
    try {
      // STEP 2: Update server after optimistic UI update
      console.log(`[MODAL] Sending completed=${completed} to server for item ${localItem?.id}`);
      await toggleItemCompletion(localItem.id, completed, false);
      
      // STEP 3: On success, ensure grid gets refreshed
      if (onToggleComplete) {
        console.log('[MODAL] Server update successful, refreshing grid');
        onToggleComplete();
      }
    } catch (error) {
      // STEP 4: On error, revert the optimistic update
      console.error('[MODAL] Server update failed, reverting UI:', error);
      setLocalItem(prev => {
        if (!prev) return null;
        return {
          ...prev,
          completed: !completed // Revert to original state
        };
      });
    } finally {
      setIsToggling(false);
    }
  };
  
  // Simplified photo capture handler using optimistic UI update pattern
  const handlePhotoCapture = async (photoDataUrl: string) => {
    console.log('[MODAL] Photo captured, proceeding with save and item completion');
    
    // STEP 1: First ensure we have the right item reference
    if (!localItem || !localItem.id) {
      console.error('[MODAL] Cannot proceed with photo capture - missing item reference');
      return;
    }
    
    // STEP 2: Make immediate forceful update to server to ensure completed=true
    // Do this BEFORE updating local state to ensure server consistency
    try {
      console.log(`[MODAL] Immediately updating server with completed=true for item ${localItem.id}`);
      await toggleItemCompletion(localItem.id, true, true); // Force completed=true
    } catch (serverError) {
      console.error('[MODAL] Failed to update server state, but will continue with local updates:', serverError);
      // Continue anyway - we'll still update the UI optimistically
    }
    
    // STEP 3: Update local UI state with photo and completed=true
    setLocalItem(prev => {
      if (!prev) return null;
      return {
        ...prev,
        completed: true, // Always force to true after photo capture
        userPhoto: photoDataUrl
      };
    });
    
    // STEP 4: Save photo to IndexedDB
    try {
      console.log('[MODAL] Saving photo to IndexedDB');
      await saveUserPhoto(photoDataUrl);
    } catch (saveError) {
      console.error('[MODAL] Error saving photo to IndexedDB:', saveError);
      // Continue anyway - we can still show the photo in memory
    }
    
    // STEP 5: Force refresh grid to ensure latest state is displayed
    if (onToggleComplete) {
      console.log('[MODAL] Refreshing grid with updated item state');
      onToggleComplete();
    }
    
    // STEP 6: Close both modals immediately - don't wait
    console.log('[MODAL] Closing photo capture modal and item modal');
    setIsToggling(false);
    setIsPhotoCaptureOpen(false);
    onClose(); // Immediately close the entire modal to return to the grid
  };
  
  // Simplified photo capture close handler using optimistic UI update pattern
  const handlePhotoCaptureClose = async () => {
    console.log('[MODAL] Photo capture skipped, closing photo modal');
    
    // Update UI immediately
    setIsPhotoCaptureOpen(false);
    
    // Ensure bingo grid gets refreshed
    if (onToggleComplete) {
      console.log('[MODAL] Refreshing grid after photo capture was skipped');
      onToggleComplete();
    }
    
    // Make a single, clean server update to ensure completion state
    if (localItem && localItem.id) {
      try {
        console.log(`[MODAL] Sending server update to ensure item ${localItem.id} remains completed`);
        await toggleItemCompletion(localItem.id, true, false);
      } catch (error) {
        console.error('[MODAL] Error ensuring completion state after skipping photo:', error);
        // We don't revert UI here since we already showed item as completed
      }
    }
    
    // Clean up
    setIsToggling(false);
    
    // Close modal after a short delay for better UX
    setTimeout(() => {
      console.log('[MODAL] Automatically closing item modal after skipping photo capture');
      onClose(); // Close the entire modal to show the updated grid with thumbnail
    }, 500); // Half-second delay for visual feedback
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