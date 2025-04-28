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
  
  // Use a ref to track the desired completion state between render cycles
  const completionStateRef = useRef<boolean | null>(null);
  
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
  
  // Ensure localItem's completion state stays in sync with our ref
  useEffect(() => {
    // Only apply if we have a valid localItem and our ref has a value
    if (localItem && completionStateRef.current !== null) {
      // Check if the completion state in our ref differs from the localItem
      if (localItem.completed !== completionStateRef.current) {
        console.log(`[MODAL] Sync: correcting localItem.completed=${localItem.completed} to completionStateRef=${completionStateRef.current}`);
        
        // Update the local state to match our ref
        setLocalItem(prev => {
          if (!prev) return null;
          return {
            ...prev,
            completed: completionStateRef.current
          };
        });
      }
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
    console.log(`[MODAL] Toggle completion called with completed=${completed}`);
    
    // Start toggling transition
    setIsToggling(true);
    
    // Store the desired completion state in our ref for persistence
    // This helps us maintain the correct state through async operations
    completionStateRef.current = completed;
    
    // Immediately update local UI state for better responsiveness
    setLocalItem(prev => {
      if (!prev) return null;
      console.log(`[MODAL] Updating local item completion state to ${completed}`);
      return {
        ...prev,
        completed: completed // Use the exact completed state from the parameter
      };
    });
    
    // Update UI first, then continue with saving in the background
    // Add a slight delay to let the UI update first
    setTimeout(async () => {
      // If marking as complete and wasn't already completed, show photo capture modal
      if (completed && localItem.completed !== completed) {
        try {
          // Update backend with explicit completed state
          await toggleItemCompletion(localItem.id, completed);
          console.log('[MODAL] Item explicitly marked as completed in backend');
          
          // Double check that local state is still correct
          setLocalItem(prev => {
            if (!prev) return null;
            if (prev.completed !== completed) {
              console.log('[MODAL] Correcting local state after backend update');
              return {
                ...prev,
                completed: completed
              };
            }
            return prev;
          });
          
          // Also trigger the grid refresh callback
          if (onToggleComplete) {
            console.log('[MODAL] Calling onToggleComplete callback to refresh grid');
            onToggleComplete();
          }
          
          // Now open the photo capture modal
          setIsPhotoCaptureOpen(true);
          setIsToggling(false);
          return; // Exit here
        } catch (error) {
          console.error("Error toggling item completion:", error);
          // Only revert local state and ref if there was an error
          completionStateRef.current = !completed;
          setLocalItem(prev => {
            if (!prev) return null;
            return {
              ...prev,
              completed: !completed // Revert to opposite state
            };
          });
          setIsToggling(false);
          return; // Don't proceed if backend update failed
        }
      }
      
      // For marking as not done or toggling to the same state, update backend
      try {
        await toggleItemCompletion(localItem.id, completed);
        
        // Double check that local state matches our intended state
        setLocalItem(prev => {
          if (!prev) return null;
          if (prev.completed !== completed) {
            console.log('[MODAL] Correcting local state after backend update');
            return {
              ...prev,
              completed: completed
            };
          }
          return prev;
        });
        
        // Always trigger grid refresh callback for immediate visual feedback
        if (onToggleComplete) {
          console.log('[MODAL] Calling onToggleComplete callback for immediate grid refresh');
          onToggleComplete();
        }
      } catch (error) {
        console.error("Error toggling item completion:", error);
        // Revert local state and ref if there was an error
        completionStateRef.current = !completed;
        setLocalItem(prev => {
          if (!prev) return null;
          return {
            ...prev,
            completed: !completed // Revert to opposite state
          };
        });
      } finally {
        setIsToggling(false);
        // We keep the modal open, just let the grid refresh
      }
    }, 50); // Very short delay for UI to update first
  };
  
  // Handle photo capture completion
  const handlePhotoCapture = async (photoDataUrl: string) => {
    console.log('[MODAL] Photo captured, proceeding with save and item completion');
    
    // Set our completion state to TRUE in the ref to maintain it across renders
    completionStateRef.current = true;
    
    // Save the photo first
    await saveUserPhoto(photoDataUrl);
    
    // Ensure the item is marked as completed in both local state and backend
    // Make another call to the backend to ensure completion state is preserved
    try {
      // First update our local state with the photo and ensure completed state
      setLocalItem(prev => {
        if (!prev) return null;
        return {
          ...prev,
          completed: true, // Always TRUE after photo capture
          userPhoto: photoDataUrl
        };
      });
      
      // Also update the backend using our hook function with explicit forcedState
      if (localItem && localItem.id) {
        try {
          // First attempt to use our hook with forcedState=true
          await toggleItemCompletion(localItem.id, true);
          
          console.log('[MODAL] Successfully marked item as completed via hook after photo capture');
        } catch (hookError) {
          console.error('[MODAL] Error using hook to set completion state:', hookError);
          
          // Fallback: make a direct API call to ensure completion if the hook fails
          try {
            // Use current city from context or fall back to item's cityId
            // Make a manual API call to ensure completion
            const payload = { 
              itemId: localItem.id, 
              cityId: currentCity || localItem.cityId,
              forcedState: true, // Force it to be completed
              // Add client ID if we have it
              ...(clientId && { clientId })
            };
            
            await fetch('/api/toggle-item', {
              method: 'POST',
              body: JSON.stringify(payload),
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              }
            });
            
            console.log('[MODAL] Reinforced completed state through direct API call for item', localItem.id, 'in city', currentCity);
          } catch (apiError) {
            console.error('[MODAL] Error making direct API call to set completion state:', apiError);
          }
        }
      }

      // Double check again after the fetch to make sure our local state is still correct
      setLocalItem(prev => {
        if (!prev) return null;
        if (prev.completed !== true) {
          console.log('[MODAL] Correcting local state to completed=true after photo capture');
          return {
            ...prev,
            completed: true
          };
        }
        return prev;
      });
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
    
    // NEW: Add a slight delay before closing the modal to ensure state is updated
    setTimeout(() => {
      console.log('[MODAL] Automatically closing item modal after photo capture');
      onClose(); // Close the entire modal to show the updated grid with thumbnail
    }, 500); // Half-second delay for visual feedback and to ensure state updates
  };
  
  // Handle cancel/skip from photo capture
  const handlePhotoCaptureClose = async () => {
    console.log('[MODAL] Photo capture skipped, ensuring item completion state is preserved');
    setIsPhotoCaptureOpen(false);
    
    // Set our completion state to TRUE in the ref to maintain it across renders
    // This was set when we opened the photo modal, let's make sure it's still true
    completionStateRef.current = true;
    
    // Aggressively reinforce the completion state in both local state and backend
    try {
      // Only do this if we have a valid item
      if (localItem && localItem.id) {
        console.log(`[MODAL] Reinforcing completed=true state for item ${localItem.id}`);
        
        // Immediately update local UI state for better responsiveness
        setLocalItem(prev => {
          if (!prev) return null;
          return {
            ...prev,
            completed: true // Force it to true
          };
        });
        
        // Make THREE redundant calls to ensure state persistence (belt and suspenders approach):
        
        // 1. Call our hook with forcedState=true 
        try {
          await toggleItemCompletion(localItem.id, true);
          console.log('[MODAL] Successfully called hook for forced completion update');
        } catch (error) {
          console.error('[MODAL] Error in first completion reinforcement:', error);
        }
        
        // 2. Wait a moment and make a direct API call as backup
        try {
          const payload = { 
            itemId: localItem.id, 
            cityId: currentCity || localItem.cityId,
            forcedState: true,
            ...(clientId && { clientId })
          };
          
          await fetch('/api/toggle-item', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            }
          });
          console.log('[MODAL] Successfully made direct API call for forced completion');
        } catch (error) {
          console.error('[MODAL] Error in second completion reinforcement:', error);
        }
        
        // 3. Final check of local state after API calls
        setLocalItem(prev => {
          if (!prev) return null;
          if (prev.completed !== true) {
            console.log('[MODAL] Final local state correction to completed=true');
            return {
              ...prev,
              completed: true
            };
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('[MODAL] Error in completion state reinforcement process:', error);
    }
    
    // Refresh the grid with the callback if provided
    if (onToggleComplete) {
      console.log('[MODAL] Calling onToggleComplete callback after photo skip');
      onToggleComplete();
    }
    
    // Clean up
    setIsToggling(false);
    
    // NEW: Add a slight delay before closing the modal to ensure state is updated
    setTimeout(() => {
      console.log('[MODAL] Automatically closing item modal after skipping photo capture');
      onClose(); // Close the entire modal to show the updated grid with thumbnail
    }, 500); // Half-second delay for visual feedback and to ensure state updates
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