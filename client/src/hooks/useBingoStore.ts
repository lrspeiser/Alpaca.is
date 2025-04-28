import { useState, useEffect, useCallback } from 'react';
import { initialBingoState } from '@/data/cities';
import { 
  loadFromLocalStorage, 
  saveToLocalStorage, 
  getClientId,
  getSavedCurrentCity,
  saveCurrentCity
} from '@/lib/utils';
import type { BingoState, City, BingoItem } from '@/types';
import { useClientId } from './useClientId';

const STORAGE_KEY = 'travelBingoState';

export function useBingoStore() {
  const [state, setState] = useState<BingoState>(() => 
    loadFromLocalStorage<BingoState>(STORAGE_KEY, initialBingoState)
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Get client ID for user identification
  const { clientId, isRegistered } = useClientId();
  
  // Alias for fetchBingoState with forceRefresh=true for easier access
  const refreshState = useCallback(async () => {
    return fetchBingoState(true);
  }, []);
  
  // Fetch state from API with an option to force refresh
  const fetchBingoState = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      console.log(`[STORE] Fetching bingo state from API${forceRefresh ? ' (force refresh)' : ''}${clientId ? ' with clientId' : ''}`);
      
      // Setup request options
      const requestOptions: RequestInit = {};
      if (forceRefresh) {
        requestOptions.cache = 'no-store';
        requestOptions.headers = {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        };
      }
      
      // Add client ID to the query parameters if available
      const url = clientId 
        ? `/api/bingo-state?clientId=${encodeURIComponent(clientId)}` 
        : '/api/bingo-state';
        
      const response = await fetch(url, requestOptions);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[STORE] Received bingo state from API', {
          currentCity: data.currentCity,
          cities: Object.keys(data.cities).map(cityId => {
            const city = data.cities[cityId];
            return {
              id: city.id,
              title: city.title,
              itemCount: city.items.length,
              itemsWithDescriptions: city.items.filter((item: BingoItem) => !!item.description).length,
              itemsWithImages: city.items.filter((item: BingoItem) => !!item.image).length,
              itemsWithDescriptionsIds: city.items
                .filter((item: BingoItem) => !!item.description)
                .map((item: BingoItem) => item.id)
            };
          })
        });
        
        // Log a summary of the first city's data if any cities exist
        const firstCityId = Object.keys(data.cities)[0];
        if (firstCityId && data.cities[firstCityId]?.items?.length > 0) {
          const city = data.cities[firstCityId];
          const itemsWithDescriptions = city.items.filter((item: BingoItem) => !!item.description).length;
          const itemsWithImages = city.items.filter((item: BingoItem) => !!item.image).length;
          
          console.log(`[STORE] First city (${firstCityId}) data:`, {
            title: city.title,
            itemCount: city.items.length,
            itemsWithDescriptions,
            itemsWithImages
          });
        }
        
        // Apply saved city selection from our dedicated localStorage value if it exists
        // and is a valid city in the data
        const savedCity = getSavedCurrentCity("");
        if (savedCity && data.cities[savedCity]) {
          console.log(`[STORE] Using saved city from localStorage: ${savedCity}`);
          data.currentCity = savedCity;
        } else if (data.currentCity && data.cities[data.currentCity]) {
          // Save the current city to our dedicated localStorage
          saveCurrentCity(data.currentCity);
        }
        
        setState(data);
        saveToLocalStorage(STORAGE_KEY, data);
        return data;
      } else {
        throw new Error('Failed to fetch bingo state from API');
      }
    } catch (error) {
      console.error('[STORE] Failed to fetch bingo state:', error);
      // Fallback to local storage if API fails
      const localState = loadFromLocalStorage<BingoState>(STORAGE_KEY, initialBingoState);
      setState(localState);
      return localState;
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);
  
  // Initial fetch of bingo state on component mount
  useEffect(() => {
    fetchBingoState(false);
  }, [fetchBingoState]);
  
  // Save state to API and localStorage whenever it changes
  const saveState = useCallback(async (newState: BingoState) => {
    console.log('[STORE] Saving bingo state to localStorage and API', {
      currentCity: newState.currentCity,
      cityCount: Object.keys(newState.cities).length,
      cities: Object.keys(newState.cities).map(cityId => {
        const city = newState.cities[cityId];
        return {
          id: city.id,
          title: city.title,
          itemCount: city.items.length,
          itemsWithDescriptions: city.items.filter(item => !!item.description).length,
          itemsWithImages: city.items.filter(item => !!item.image).length,
          completedItems: city.items.filter(item => item.completed).length
        };
      })
    });
    
    // Always save to local storage as backup
    saveToLocalStorage(STORAGE_KEY, newState);
    
    // Try to save to API
    try {
      console.log('[STORE] Sending state to API endpoint /api/bingo-state');
      
      // Add client ID to the request if available
      const payload = clientId 
        ? { ...newState, clientId } 
        : newState;
        
      const response = await fetch('/api/bingo-state', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to save bingo state to API');
      }
      
      console.log('[STORE] Successfully saved state to API');
    } catch (error) {
      console.error('[STORE] Failed to save bingo state to API:', error);
      // We already saved to localStorage as backup
    }
  }, [clientId]);
  
  // No longer need to update background image as the feature has been removed
  useEffect(() => {
    // Set a white background regardless of the city
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = '#ffffff';
  }, [state.currentCity]);
  
  // Set the current city
  const setCurrentCity = useCallback(async (cityId: string) => {
    if (state.cities[cityId]) {
      console.log(`[STORE] Changing current city to ${cityId}`);
      
      // Save city selection to dedicated localStorage key
      saveCurrentCity(cityId);
      
      // Create new state with the selected city
      const newState = {
        ...state,
        currentCity: cityId
      };
      
      // Update local state immediately for responsive UI
      setState(newState);
      
      // Save to localStorage first for redundancy
      saveToLocalStorage(STORAGE_KEY, newState);
      
      try {
        // Call API to persist changes with explicit clientId if available
        console.log(`[STORE] Persisting city change to server (${cityId})`);
        
        // Create a simplified payload for city change only
        // This prevents errors with sending the full cities object which might be large
        const payload = {
          state: {
            currentCity: cityId,
            cities: {} // Empty cities object, server will handle this specially
          },
          clientId: clientId || undefined
        };
            
        // Use a specific API call just for updating current city
        const response = await fetch('/api/bingo-state', {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'application/json',
            // Add cache-busting headers to ensure fresh response
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to update current city');
        }
        
        console.log(`[STORE] Successfully changed current city to ${cityId}`);
        
        // Force a state refresh to ensure everything is in sync
        setTimeout(() => {
          // Use force refresh to get the latest state from server
          fetchBingoState(true);
        }, 100);
      } catch (error) {
        console.error(`[STORE] Error changing current city to ${cityId}:`, error);
        // We already updated local state, so UI should still reflect the change
      }
    } else {
      console.error(`[STORE] Attempted to set current city to invalid city ID: ${cityId}`);
    }
  }, [state, saveState, fetchBingoState, clientId]);
  
  // Improved toggle completion with server-first approach and detailed logging
  // forcedState parameter allows forcing a specific completion state
  // forceUpdate parameter forces the update even if toggleItemCompletion is called multiple times
  const toggleItemCompletion = useCallback(async (itemId: string, forcedState: boolean, forceUpdate: boolean = false) => {
    const currentCity = state.currentCity;
    
    console.log(`[STORE] toggleItemCompletion called for item ${itemId} in city ${currentCity}`, {
      itemId,
      cityId: currentCity,
      forcedState,
      forceUpdate,
      clientId: clientId || 'none',
      timestamp: new Date().toISOString()
    });
    
    try {
      // STEP 1: Call API to update server state FIRST (server-first approach)
      console.log(`[STORE] Making server API call to /api/toggle-item`, {
        itemId,
        cityId: currentCity,
        forcedState: forcedState,
        clientId: clientId || 'none'
      });
      
      const payload = clientId 
        ? { 
            itemId, 
            cityId: currentCity, 
            clientId,
            forcedState // Always include forcedState
          } 
        : { 
            itemId, 
            cityId: currentCity,
            forcedState // Always include forcedState
          };
        
      const response = await fetch('/api/toggle-item', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`[STORE] Server API call successful:`, result);
      
      // STEP 2: After server success, fetch the latest state from server
      console.log('[STORE] Fetching updated state from server');
      await fetchBingoState(true);
      
      // STEP 3: Now update local state to match server
      console.log(`[STORE] Updating local state with forcedState=${forcedState}`);
      
      // Now update local state with consistent value matching what we sent to server
      const updatedState = await new Promise<BingoState>((resolve) => {
        setState(prev => {
          // Find the item in current state
          const cityItems = [...prev.cities[currentCity].items];
          const itemIndex = cityItems.findIndex(item => item.id === itemId);
          
          console.log(`[STORE] Found item at index ${itemIndex}, updating to forcedState=${forcedState}`);
          
          if (itemIndex !== -1 && !cityItems[itemIndex].isCenterSpace) {
            // Apply the forced state (which matches what we sent to server)
            cityItems[itemIndex] = {
              ...cityItems[itemIndex],
              completed: forcedState
            };
            
            console.log(`[STORE] Updated item ${itemId} in local state`, {
              before: prev.cities[currentCity].items[itemIndex].completed,
              after: forcedState
            });
            
            const updatedCity: City = {
              ...prev.cities[currentCity],
              items: cityItems
            };
            
            const newState = {
              ...prev,
              cities: {
                ...prev.cities,
                [currentCity]: updatedCity
              }
            };
            
            // Update localStorage for redundancy
            saveToLocalStorage(STORAGE_KEY, newState);
            
            resolve(newState);
            return newState;
          }
          
          console.log(`[STORE] No changes made to local state (item not found or is center space)`);
          resolve(prev);
          return prev;
        });
      });
      
      return updatedState;
    } catch (error) {
      console.error('[STORE] Failed to toggle item completion via API:', error);
      
      // Return the current state in case of error
      console.log('[STORE] Returning current state without changes due to API error');
      return state;
    }
  }, [state, state.currentCity, saveState, fetchBingoState, clientId]);
  
  // Reset all items for current city (except center space)
  const resetCity = useCallback(async () => {
    const currentCity = state.currentCity;
    
    try {
      // Call API to reset city
      const payload = clientId 
        ? { cityId: currentCity, clientId } 
        : { cityId: currentCity };
        
      const response = await fetch('/api/reset-city', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset city via API');
      }
      
      // Update local state
      setState(prev => {
        const updatedItems = prev.cities[currentCity].items.map(item => {
          if (item.isCenterSpace) return item;
          return { ...item, completed: false };
        });
        
        const updatedCity: City = {
          ...prev.cities[currentCity],
          items: updatedItems
        };
        
        const newState = {
          ...prev,
          cities: {
            ...prev.cities,
            [currentCity]: updatedCity
          }
        };
        
        // Save to localStorage as backup
        saveToLocalStorage(STORAGE_KEY, newState);
        
        return newState;
      });
    } catch (error) {
      console.error('Failed to reset city:', error);
      
      // Fallback to direct state update if API fails
      setState(prev => {
        const updatedItems = prev.cities[currentCity].items.map(item => {
          if (item.isCenterSpace) return item;
          return { ...item, completed: false };
        });
        
        const updatedCity: City = {
          ...prev.cities[currentCity],
          items: updatedItems
        };
        
        const newState = {
          ...prev,
          cities: {
            ...prev.cities,
            [currentCity]: updatedCity
          }
        };
        
        // Save to localStorage as backup
        saveToLocalStorage(STORAGE_KEY, newState);
        
        return newState;
      });
    }
  }, [state.currentCity, saveState, clientId]);
  
  return {
    cities: state.cities,
    currentCity: state.currentCity,
    isLoading,
    setCurrentCity,
    toggleItemCompletion,
    resetCity,
    saveState, // Expose this for the Admin page
    fetchBingoState, // Expose this for forced refresh
    refreshState // Simple alias for fetchBingoState(true)
  };
}
