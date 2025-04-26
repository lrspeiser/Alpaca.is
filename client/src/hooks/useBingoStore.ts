import { useState, useEffect, useCallback } from 'react';
import { initialBingoState } from '@/data/cities';
import { loadFromLocalStorage, saveToLocalStorage } from '@/lib/utils';
import type { BingoState, City } from '@/types';

const STORAGE_KEY = 'travelBingoState';

export function useBingoStore() {
  const [state, setState] = useState<BingoState>(() => 
    loadFromLocalStorage<BingoState>(STORAGE_KEY, initialBingoState)
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Fetch initial state from API
  useEffect(() => {
    const fetchBingoState = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/bingo-state');
        if (response.ok) {
          const data = await response.json();
          setState(data);
          saveToLocalStorage(STORAGE_KEY, data);
        } else {
          throw new Error('Failed to fetch bingo state from API');
        }
      } catch (error) {
        console.error('Failed to fetch bingo state:', error);
        // Fallback to local storage if API fails
        const localState = loadFromLocalStorage<BingoState>(STORAGE_KEY, initialBingoState);
        setState(localState);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBingoState();
  }, []);
  
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
      const response = await fetch('/api/bingo-state', {
        method: 'POST',
        body: JSON.stringify(newState),
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
  }, []);
  
  // Update document body background image when current city changes
  useEffect(() => {
    const city = state.cities[state.currentCity];
    if (city && city.backgroundImage) {
      document.body.style.backgroundImage = `url('${city.backgroundImage}')`;
    }
  }, [state.currentCity, state.cities]);
  
  // Set the current city
  const setCurrentCity = useCallback(async (cityId: string) => {
    if (state.cities[cityId]) {
      const newState = {
        ...state,
        currentCity: cityId
      };
      
      setState(newState);
      await saveState(newState);
    }
  }, [state, saveState]);
  
  // Toggle completion status of a bingo item
  const toggleItemCompletion = useCallback(async (itemId: string) => {
    const currentCity = state.currentCity;
    
    try {
      // Call API to toggle item completion
      const response = await fetch('/api/toggle-item', {
        method: 'POST',
        body: JSON.stringify({ itemId, cityId: currentCity }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle item completion via API');
      }
      
      // Update local state
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
          
          return newState;
        }
        
        return prev;
      });
    } catch (error) {
      console.error('Failed to toggle item completion:', error);
      
      // Fallback to direct state update if API fails
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
          
          return newState;
        }
        
        return prev;
      });
    }
  }, [state.currentCity, saveState]);
  
  // Reset all items for current city (except center space)
  const resetCity = useCallback(async () => {
    const currentCity = state.currentCity;
    
    try {
      // Call API to reset city
      const response = await fetch('/api/reset-city', {
        method: 'POST',
        body: JSON.stringify({ cityId: currentCity }),
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
  }, [state.currentCity, saveState]);
  
  return {
    cities: state.cities,
    currentCity: state.currentCity,
    isLoading,
    setCurrentCity,
    toggleItemCompletion,
    resetCity,
    saveState // Expose this for the Admin page
  };
}
