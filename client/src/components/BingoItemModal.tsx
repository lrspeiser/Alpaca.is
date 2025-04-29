import { Button } from "@/components/ui/button";
import { RefreshCw, X, Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { useBingoStore } from "@/hooks/useBingoStore";
import { useEffect, useState, useRef, useCallback } from "react";
import type { BingoItem } from "@/types";
import { ImageDebugger, type ImageLoadInfo } from "./ImageDebugger";
import { getProxiedImageUrl } from "../lib/imageUtils";
import PhotoCaptureModal from "./PhotoCaptureModal";
import { useClientId } from '@/hooks/useClientId';
import { saveUserPhotoToIndexedDB, getUserPhotoFromIndexedDB, deleteUserPhotoFromIndexedDB } from "../lib/utils";
import { useLocalPhotos } from "@/hooks/useLocalPhotos";

interface BingoItemModalProps {
  item: BingoItem | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleComplete?: () => void; // Optional callback to refresh grid after toggle
  allItems?: BingoItem[]; // All bingo items for navigation between items
}

export default function BingoItemModal({ item, isOpen, onClose, onToggleComplete, allItems = [] }: BingoItemModalProps) {
  const { toggleItemCompletion, currentCity, resetCity } = useBingoStore();
  const { clientId } = useClientId();
  const { deleteAllPhotosForCity, deletePhoto } = useLocalPhotos();
  
  // All state declarations must come before any other code
  const [localItem, setLocalItem] = useState<BingoItem | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false);
  const [lastReset, setLastReset] = useState<string | null>(null);
  
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
  
  // Update local state when item changes, with better synchronization
  useEffect(() => {
    if (item) {
      console.log(`[MODAL-DEBUG] Item prop changed for ${item.id}: "${item.text}"`);
      console.log(`[MODAL-DEBUG] Server state: completed=${item.completed}, userPhoto=${!!item.userPhoto}`);
      
      setLocalItem(prevLocalItem => {
        // If we already have a local item with the same ID
        if (prevLocalItem && prevLocalItem.id === item.id) {
          const hasLocalUserPhoto = !!prevLocalItem.userPhoto;
          const hasServerUserPhoto = !!item.userPhoto;
          
          console.log(`[MODAL-DEBUG] Previous local state: completed=${prevLocalItem.completed}, userPhoto=${hasLocalUserPhoto}`);
          console.log(`[MODAL-DEBUG] New server state: completed=${item.completed}, userPhoto=${hasServerUserPhoto}`);
          
          // Always use server completion state, but be careful with photos
          if (!item.completed) {
            // If server says not completed, remove user photo
            console.log(`[MODAL-DEBUG] Item ${item.id} is marked as NOT COMPLETED, clearing any user photo`);
            return {
              ...item,
              userPhoto: undefined // Clear user photo when not completed
            };
          } else if (prevLocalItem.completed && prevLocalItem.userPhoto) {
            // If already completed and has a local user photo, keep it
            console.log(`[MODAL-DEBUG] Item ${item.id} was already completed with user photo, preserving it`);
            return {
              ...item,
              userPhoto: prevLocalItem.userPhoto
            };
          } else {
            // Otherwise use server state
            console.log(`[MODAL-DEBUG] Using server state for ${item.id}, userPhoto=${!!item.userPhoto}`);
            return item;
          }
        }
        
        // For a new item, use the server state directly
        console.log(`[MODAL-DEBUG] New item ${item.id}, setting initial state: completed=${item.completed}`);
        return item;
      });
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
  
  // Define an interface for our custom event
  interface CityResetEvent extends Event {
    detail: { cityId: string; timestamp: number };
  }
  
  // Listen for city reset events
  useEffect(() => {
    // Handler for the custom reset event
    const handleCityReset = async (event: Event) => {
      // Type cast the event to our custom event type
      const customEvent = event as CityResetEvent;
      const { cityId, timestamp } = customEvent.detail;
      
      console.log(`[RESET-DEBUG] =====================================================`);
      console.log(`[RESET-DEBUG] Received city reset event for ${cityId} at ${new Date(timestamp).toISOString()}`);
      console.log(`[RESET-DEBUG] Current item: ${localItem?.id} (${localItem?.text})`);
      console.log(`[RESET-DEBUG] Item cityId: ${localItem?.cityId}, Current city context: ${currentCity}`);
      console.log(`[RESET-DEBUG] Item completed: ${localItem?.completed}, Has user photo: ${!!localItem?.userPhoto}`);
      
      // Only clear local state if it affects the current item
      if (localItem && (cityId === localItem.cityId || cityId === currentCity)) {
        console.log(`[RESET-DEBUG] RESETTING item ${localItem.id} due to city reset`);
        
        // Update reset tracking
        const resetKey = `${cityId}-${timestamp}`;
        setLastReset(resetKey);
        
        // Clear user photo both from local state and IndexedDB
        try {
          if (localItem.id) {
            // Check if a photo exists before trying to delete
            const existingPhoto = await getUserPhotoFromIndexedDB(cityId, localItem.id);
            if (existingPhoto) {
              console.log(`[RESET-DEBUG] Found photo for ${localItem.id} in IndexedDB, deleting it`);
              // Use the deletePhoto function from useLocalPhotos hook
              await deletePhoto(cityId, localItem.id);
              console.log(`[RESET-DEBUG] Successfully deleted photo for item ${localItem.id} from IndexedDB`);
            } else {
              console.log(`[RESET-DEBUG] No photo found for ${localItem.id} in IndexedDB, nothing to delete`);
            }
            
            // Verify no photo exists after deletion
            const verifyPhoto = await getUserPhotoFromIndexedDB(cityId, localItem.id);
            console.log(`[RESET-DEBUG] After deletion, photo exists: ${!!verifyPhoto}`);
          }
        } catch (error) {
          console.error(`[RESET-DEBUG] Error working with IndexedDB:`, error);
        }
        
        // Update local state to reflect the changes
        setLocalItem(prev => {
          if (!prev) return null;
          console.log(`[RESET-DEBUG] Resetting local state for ${prev.id}: completed=${prev.completed} → false, userPhoto=${!!prev.userPhoto} → undefined`);
          return {
            ...prev,
            userPhoto: undefined, // Remove user photo
            completed: false      // Reset completion state
          };
        });
      } else {
        console.log(`[RESET-DEBUG] Reset event doesn't affect current item. Item cityId: ${localItem?.cityId}, Reset cityId: ${cityId}`);
      }
      console.log(`[RESET-DEBUG] =====================================================`);
    };
    
    // Register event listener for the custom reset event
    window.addEventListener('travelBingo:cityReset', handleCityReset);
    
    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener('travelBingo:cityReset', handleCityReset);
    };
  }, [localItem, currentCity, deletePhoto]);
  
  // Monitor current city changes
  useEffect(() => {
    // Create a reset key that combines city and a timestamp
    // This will help us detect when a city has been changed
    const resetKey = `${currentCity}-change`;
    
    // Check if this is a new city
    if (lastReset !== resetKey) {
      console.log(`[MODAL] City context changed from ${lastReset} to ${resetKey}, clearing any stale user photos`);
      setLastReset(resetKey);
      
      // Clear any existing user photo in the local state
      setLocalItem(prev => {
        if (!prev) return null;
        return {
          ...prev,
          userPhoto: undefined // Clear the user photo
        };
      });
    }
  }, [currentCity, lastReset]);

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

  // Simplified handleToggleCompletion with immediate UI feedback
  const handleToggleCompletion = async (completed: boolean) => {
    console.log(`[MODAL] Toggle completion called with completed=${completed}`, {
      itemId: localItem?.id,
      currentStatus: localItem?.completed,
      newStatus: completed
    });
    
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
    
    try {
      // STEP 1: Immediately update local UI for better user feedback
      setLocalItem(prev => {
        if (!prev) return null;
        return {
          ...prev,
          completed: completed // Force the new completion state
        };
      });
      
      // STEP 2: Update server state
      console.log(`[MODAL] Sending completed=${completed} to server for item ${localItem?.id}`);
      await toggleItemCompletion(localItem.id, completed, true);
      
      console.log('[MODAL] Server update successful');
      
      // STEP 3: If marking as complete, show photo capture modal
      if (completed) {
        console.log('[MODAL] Opening photo capture');
        setIsPhotoCaptureOpen(true);
      }
      
      // Only refresh the grid when marking as not complete
      // Don't refresh when marking as complete to avoid overriding our local UI state
      if (onToggleComplete && !completed) {
        console.log('[MODAL] Refreshing grid after marking as not complete');
        onToggleComplete();
      }
      
      // STEP 5: If marking as not complete, close the modal
      if (!completed) {
        console.log('[MODAL] Item marked as not complete, closing modal');
        setTimeout(() => {
          onClose();
        }, 300); // Small delay to show state change
      }
    } catch (error) {
      console.error('[MODAL] Server update failed:', error);
      
      // Revert local UI state on error
      setLocalItem(prev => {
        if (!prev) return null;
        return {
          ...prev,
          completed: !completed // Go back to previous state
        };
      });
    } finally {
      setIsToggling(false);
    }
  };
  
  // Simplified photo capture handler - only saves to IndexedDB
  const handlePhotoCapture = async (photoDataUrl: string) => {
    console.log('[MODAL] Photo captured, proceeding with save to local storage only');
    
    // STEP 1: First ensure we have the right item reference
    if (!localItem || !localItem.id) {
      console.error('[MODAL] Cannot proceed with photo capture - missing item reference');
      return;
    }
    
    try {
      // STEP 2: Make immediate update to server to ensure completed=true
      console.log(`[MODAL] Updating server with completed=true for item ${localItem.id}`);
      await toggleItemCompletion(localItem.id, true, true); // Force completed=true
      
      // Ensure we have correct cityId from the current item
      const cityId = localItem.cityId || currentCity; // Fallback to current city from store
      const itemId = localItem.id;
      
      // STEP 3: Save photo to IndexedDB only (not server)
      console.log('[MODAL] Saving photo to IndexedDB');
      await saveUserPhoto(photoDataUrl);
      
      // STEP 4: Dispatch an event to notify other components of the photo update
      // This helps ensure consistent state across components
      const photoEvent = new CustomEvent('travelBingo:photoUpdated', {
        detail: { cityId, itemId, timestamp: Date.now() }
      });
      window.dispatchEvent(photoEvent);
      console.log(`[MODAL] Dispatched photo update event for item ${itemId} in city ${cityId}`);
      
      // STEP 5: Do a full refresh to ensure we have the latest server state
      console.log('[MODAL] Refreshing state from server');
      if (onToggleComplete) {
        await onToggleComplete();
      }
      
      // STEP 6: Update local UI with photo/completion state
      console.log('[MODAL] Updating UI state with completed=true and photo');
      setLocalItem(prev => {
        if (!prev) return null;
        const updated = {
          ...prev,
          cityId, // Ensure cityId is set correctly
          completed: true, // Always force to true after photo capture 
          userPhoto: photoDataUrl
        };
        console.log('[MODAL] Updated local item with photo');
        return updated;
      });
      
      // STEP 7: Close both modals immediately after all operations complete
      console.log('[MODAL] Closing both modals');
      setIsToggling(false);
      setIsPhotoCaptureOpen(false);
      onClose(); // Immediately close the entire modal to return to the grid
      
    } catch (error) {
      // Handle errors with clear logging
      console.error('[MODAL] Error processing photo capture:', error);
      setIsToggling(false);
      
      // Close photo modal even if there was an error
      setIsPhotoCaptureOpen(false);
    }
  };
  
  // Simplified photo capture close handler - only close photo modal when skipped
  const handlePhotoCaptureClose = async () => {
    console.log('[MODAL] Photo capture skipped, closing only photo modal');
    
    // First ensure the item is still marked as completed in server
    if (localItem && localItem.id) {
      try {
        // Server update first
        console.log(`[MODAL] Sending server update to ensure item ${localItem.id} remains completed`);
        await toggleItemCompletion(localItem.id, true, true);
        
        // Don't refresh the grid here - it would reset our UI state
        
        // Make sure our local state shows as completed
        setLocalItem(prev => {
          if (!prev) return null;
          return {
            ...prev,
            completed: true // Force completed state
          };
        });
      } catch (error) {
        console.error('[MODAL] Error ensuring completion state after skipping photo:', error);
      }
    }
    
    // Close only the photo capture modal and keep item modal open
    setIsToggling(false);
    setIsPhotoCaptureOpen(false);
    
    // Don't close the main modal - let user decide when to close it
    console.log('[MODAL] Keeping item modal open after skipping photo');
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
                <>
                  {/* First priority - show user photo if available and item is completed */}
                  {(() => {
                    // Display decision logic with detailed logging
                    console.log(`[IMAGE-DISPLAY] Item ${localItem.id} display decision:`);
                    console.log(`[IMAGE-DISPLAY] - Item completed: ${localItem.completed}`);
                    console.log(`[IMAGE-DISPLAY] - User photo exists: ${!!localItem.userPhoto}`);
                    console.log(`[IMAGE-DISPLAY] - AI image exists: ${!!imageUrl}`);
                    
                    if (localItem.completed && localItem.userPhoto) {
                      console.log(`[IMAGE-DISPLAY] SHOWING USER PHOTO for ${localItem.id}`);
                      return (
                        <ImageDebugger
                          src={localItem.userPhoto}
                          alt={`User photo for ${localItem.text}`}
                          className="w-full h-full object-cover"
                          onLoadInfo={(info) => console.log(`[MODAL-IMAGE-DEBUG] User photo for ${localItem.id}:`, info)}
                        />
                      );
                    } else {
                      // Only show AI image (if available) when item is not completed or has no user photo
                      console.log(`[IMAGE-DISPLAY] SHOWING AI IMAGE for ${localItem.id}: ${imageUrl?.substring(0, 30)}...`);
                      return (
                        <ImageDebugger
                          src={imageUrl}
                          alt={localItem.text}
                          className="w-full h-full object-cover"
                          onLoadInfo={(info) => console.log(`[MODAL-IMAGE-DEBUG] AI image for ${localItem.id}:`, info)}
                        />
                      );
                    }
                  })()}
                </>
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
            
            {/* Debug logs are in useEffect inside component body */}
            
            <div className="flex space-x-3">
              <Button 
                variant={localItem.completed ? "default" : "outline"} 
                className="flex-1"
                disabled={isPending || localItem.completed} // Disable if already completed
                onClick={() => handleToggleCompletion(true)}
              >
                {localItem.completed ? "Completed ✓" : "Mark as Done"}
              </Button>
              
              <Button 
                variant={!localItem.completed ? "default" : "outline"} 
                className="flex-1"
                disabled={isPending || !localItem.completed} // Disable if already not completed
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