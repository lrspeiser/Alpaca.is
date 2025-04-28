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
  
  // Update local state when item changes, preserving local completion state
  useEffect(() => {
    if (item) {
      console.log('[MODAL] Item prop changed, updating localItem while preserving local state');
      
      setLocalItem(prevLocalItem => {
        // If we already have a local item with the same ID, preserve its completion state
        if (prevLocalItem && prevLocalItem.id === item.id) {
          console.log(`[MODAL] Preserving local completion state: ${prevLocalItem.completed}`);
          return {
            ...item,                     // Take all properties from the new item
            completed: prevLocalItem.completed, // But preserve our local completion state
            userPhoto: prevLocalItem.userPhoto || item.userPhoto // Preserve userPhoto if we have one
          };
        }
        
        // Otherwise, it's a completely different item, so use the new one directly
        console.log(`[MODAL] New item, using provided completion state: ${item.completed}`);
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

  // Improved handleToggleCompletion with server-first approach and detailed logging
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
    console.log('[MODAL] Setting isToggling to true');
    
    // Special case: If marking as complete, handle photo capture
    if (completed) {
      try {
        // STEP 1: Update server state FIRST (no optimistic UI update)
        console.log(`[MODAL] Sending completed=${completed} to server for item ${localItem?.id}`, {
          timestamp: new Date().toISOString(),
          forcedUpdate: true
        });
        await toggleItemCompletion(localItem.id, completed, true); // Force update with true
        
        console.log('[MODAL] Server update successful, item should now be marked completed in DB');
        
        // STEP 2: Do a full refetch from server to ensure we have latest state
        console.log('[MODAL] Requesting full refresh of bingo state from server');
        if (onToggleComplete) {
          console.log('[MODAL] Refreshing grid after successful server update');
          await onToggleComplete(); // Wait for this to complete to ensure latest state
        }
        
        // STEP 3: Only after server refresh, update local UI
        console.log('[MODAL] Updating local UI state to completed=true');
        setLocalItem(prev => {
          console.log('[MODAL] Previous item state:', prev);
          if (!prev) return null;
          const updatedItem = {
            ...prev,
            completed: true // Always use true here regardless of DB to ensure UI consistency
          };
          console.log('[MODAL] New item state:', updatedItem);
          return updatedItem;
        });
        
        // STEP 4: After server confirmation, open photo capture
        console.log('[MODAL] Opening photo capture');
        setIsPhotoCaptureOpen(true);
        
        setIsToggling(false);
        console.log('[MODAL] Setting isToggling to false');
        return; // Exit here, photo capture will handle the rest
      } catch (error) {
        // Handle error without any UI updates since we haven't changed UI yet
        console.error('[MODAL] Server update failed:', error);
        setIsToggling(false);
        console.log('[MODAL] Setting isToggling to false after error');
        return;
      }
    }
    
    // For marking as not done, similar approach
    try {
      // STEP 1: Server update first, no optimistic UI update
      console.log(`[MODAL] Sending completed=${completed} to server for item ${localItem?.id}`, {
        timestamp: new Date().toISOString(),
        forcedUpdate: true
      });
      await toggleItemCompletion(localItem.id, completed, true); // Force update with false
      
      console.log('[MODAL] Server update successful, item should now be marked not completed in DB');
      
      // STEP 2: Do a full refetch from server to ensure we have latest state
      console.log('[MODAL] Requesting full refresh of bingo state from server');
      if (onToggleComplete) {
        console.log('[MODAL] Refreshing grid after successful server update');
        await onToggleComplete(); // Wait for this to complete to ensure latest state
      }
      
      // STEP 3: Only update UI after server confirmation
      console.log('[MODAL] Updating local UI state to completed=false');
      setLocalItem(prev => {
        console.log('[MODAL] Previous item state:', prev);
        if (!prev) return null;
        const updatedItem = {
          ...prev,
          completed: false // Always use false here regardless of DB to ensure UI consistency
        };
        console.log('[MODAL] New item state:', updatedItem);
        return updatedItem;
      });
    } catch (error) {
      // No need to revert UI since we didn't update it optimistically
      console.error('[MODAL] Server update failed:', error);
    } finally {
      setIsToggling(false);
      console.log('[MODAL] Setting isToggling to false after completion');
    }
  };
  
  // Improved photo capture handler with server-first approach
  const handlePhotoCapture = async (photoDataUrl: string) => {
    console.log('[MODAL] Photo captured, proceeding with save and item completion');
    
    // STEP 1: First ensure we have the right item reference
    if (!localItem || !localItem.id) {
      console.error('[MODAL] Cannot proceed with photo capture - missing item reference');
      return;
    }
    
    try {
      // STEP 2: Make immediate forceful update to server to ensure completed=true
      console.log(`[MODAL] Updating server with completed=true for item ${localItem.id}`);
      await toggleItemCompletion(localItem.id, true, true); // Force completed=true
      
      // STEP 3: Save photo to server storage
      console.log(`[MODAL] Saving photo to server`);
      
      // Ensure we have correct cityId from the current item
      const cityId = localItem.cityId || currentCity; // Fallback to current city from store
      const itemId = localItem.id;
      
      // STEP 4: Force synchronous server update to ensure UI consistency
      try {
        // Make a synchronous request to save the photo
        const photoResponse = await fetch('/api/save-user-photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            itemId,
            cityId,
            photoDataUrl,
            clientId
          })
        });
        
        if (!photoResponse.ok) {
          throw new Error(`Failed to save photo: ${photoResponse.status}`);
        }
        
        console.log('[MODAL] Successfully saved photo to server');
      } catch (photoError) {
        console.error('[MODAL] Error saving photo to server:', photoError);
        // Continue anyway, we'll still update local state
      }
      
      // STEP 5: Save photo to IndexedDB for local caching
      console.log('[MODAL] Saving photo to IndexedDB');
      await saveUserPhoto(photoDataUrl);
      
      // STEP 6: Do a full refresh to ensure we have the latest server state
      console.log('[MODAL] Refreshing state from server');
      if (onToggleComplete) {
        await onToggleComplete();
      }
      
      // STEP 7: Update local UI with photo/completion state only after server operations
      console.log('[MODAL] Updating UI state with completed=true');
      setLocalItem(prev => {
        if (!prev) return null;
        const updated = {
          ...prev,
          cityId, // Ensure cityId is set correctly
          completed: true, // Always force to true after photo capture 
          userPhoto: photoDataUrl
        };
        console.log('[MODAL] Updated local item:', updated);
        return updated;
      });
      
      // STEP 8: Close both modals immediately after all operations complete
      console.log('[MODAL] Closing photo capture modal and item modal');
      setIsToggling(false);
      setIsPhotoCaptureOpen(false);
      onClose(); // Immediately close the entire modal to return to the grid
      
    } catch (error) {
      // Handle errors with clear logging
      console.error('[MODAL] Error processing photo capture:', error);
      setIsToggling(false);
      
      // Keep photo modal open so user can retry
      // Don't close main modal either
    }
  };
  
  // Simplified photo capture close handler - always close everything when skipped
  const handlePhotoCaptureClose = async () => {
    console.log('[MODAL] Photo capture skipped, closing all modals');
    
    // First ensure the item is still marked as completed in server
    if (localItem && localItem.id) {
      try {
        // Server update first
        console.log(`[MODAL] Sending server update to ensure item ${localItem.id} remains completed`);
        await toggleItemCompletion(localItem.id, true, true);
        
        // Refresh grid to get latest state
        if (onToggleComplete) {
          console.log('[MODAL] Refreshing grid after photo capture was skipped');
          onToggleComplete();
        }
      } catch (error) {
        console.error('[MODAL] Error ensuring completion state after skipping photo:', error);
      }
    }
    
    // Clean up and close everything
    setIsToggling(false);
    setIsPhotoCaptureOpen(false);
    
    // Close item modal immediately to return to the grid
    console.log('[MODAL] Closing item modal');
    onClose();
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
            
            {/* Debug logs are in useEffect inside component body */}
            
            <div className="flex space-x-3">
              {localItem.completed ? (
                <>
                  {/* If completed, show the completed state and option to mark as not done */}
                  <Button 
                    variant="default"
                    className="flex-1"
                    disabled={true}
                  >
                    Completed ✓
                  </Button>
                  
                  <Button 
                    variant="outline"
                    className="flex-1"
                    disabled={isPending}
                    onClick={() => handleToggleCompletion(false)}
                  >
                    Mark as Not Done
                  </Button>
                </>
              ) : (
                <>
                  {/* If not completed, show take photo button and skip option */}
                  <Button 
                    variant="default"
                    className="flex-1"
                    disabled={isPending}
                    onClick={() => {
                      // Update server state but go directly to photo capture
                      console.log('[MODAL] Take Photo button clicked, updating server and opening photo capture');
                      setIsToggling(true);
                      
                      // Update server state first
                      toggleItemCompletion(localItem.id, true, true)
                        .then(() => {
                          console.log('[MODAL] Server updated, now showing photo capture');
                          
                          // After server is updated successfully, open photo capture
                          setLocalItem(prev => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              completed: true
                            };
                          });
                          
                          // Open photo capture directly
                          setIsPhotoCaptureOpen(true);
                          setIsToggling(false);
                        })
                        .catch(error => {
                          console.error('[MODAL] Error updating server:', error);
                          setIsToggling(false);
                        });
                    }}
                  >
                    <Camera className="h-4 w-4 mr-2" /> Take Photo
                  </Button>
                  
                  <Button 
                    variant="outline"
                    className="flex-1"
                    disabled={isPending}
                    onClick={() => {
                      // Mark as done without photo
                      console.log('[MODAL] Skip Photo clicked, marking as done without photo');
                      setIsToggling(true);
                      
                      // Update server state first
                      toggleItemCompletion(localItem.id, true, true)
                        .then(() => {
                          console.log('[MODAL] Server updated, closing modal');
                          
                          // After server is updated successfully, close the modal
                          if (onToggleComplete) {
                            onToggleComplete();
                          }
                          
                          // Close the modal
                          setIsToggling(false);
                          onClose();
                        })
                        .catch(error => {
                          console.error('[MODAL] Error updating server:', error);
                          setIsToggling(false);
                        });
                    }}
                  >
                    Skip Photo
                  </Button>
                </>
              )}
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