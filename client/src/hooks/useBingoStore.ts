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
        
        // Add client ID to the request if available
        const payload = clientId 
          ? { ...newState, clientId } 
          : newState;
            
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
  
  // Toggle completion status of a bingo item
  const toggleItemCompletion = useCallback(async (itemId: string) => {
    const currentCity = state.currentCity;
    
    // Update local state immediately for responsive UI
    let newStatePromise = new Promise<BingoState>((resolve) => {
      setState(prev => {
        const cityItems = [...prev.cities[currentCity].items];
        const itemIndex = cityItems.findIndex(item => item.id === itemId);
        
        if (itemIndex !== -1 && !cityItems[itemIndex].isCenterSpace) {
          cityItems[itemIndex] = {
            ...cityItems[itemIndex],
            completed: !cityItems[itemIndex].completed
          };
          
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
          
          // Save to localStorage as backup
          saveToLocalStorage(STORAGE_KEY, newState);
          
          // Resolve the promise with the new state
          resolve(newState);
          return newState;
        }
        
        resolve(prev);
        return prev;
      });
    });
    
    // Then call API to persist changes
    try {
      // Call API to toggle item completion
      const payload = clientId 
        ? { itemId, cityId: currentCity, clientId } 
        : { itemId, cityId: currentCity };
        
      const response = await fetch('/api/toggle-item', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle item completion via API');
      }
      
      // Fetch updated state after change is persisted to ensure everything is in sync
      // This makes sure all components using this state get the update
      setTimeout(() => {
        fetchBingoState(true);
      }, 300);
      
      return await newStatePromise;
    } catch (error) {
      console.error('Failed to toggle item completion via API:', error);
      // We've already updated the local state, so just return that
      return await newStatePromise;
    }
  }, [state.currentCity, saveState, fetchBingoState, clientId]);
  
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
