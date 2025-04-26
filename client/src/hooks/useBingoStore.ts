import { useState, useEffect } from 'react';
import { initialBingoState } from '@/data/cities';
import { loadFromLocalStorage, saveToLocalStorage } from '@/lib/utils';
import type { BingoState, City } from '@/types';

const STORAGE_KEY = 'travelBingoState';

export function useBingoStore() {
  const [state, setState] = useState<BingoState>(() => 
    loadFromLocalStorage<BingoState>(STORAGE_KEY, initialBingoState)
  );
  
  // Save state to localStorage whenever it changes
  useEffect(() => {
    saveToLocalStorage(STORAGE_KEY, state);
  }, [state]);
  
  // Update document body background image when current city changes
  useEffect(() => {
    const city = state.cities[state.currentCity];
    if (city && city.backgroundImage) {
      document.body.style.backgroundImage = `url('${city.backgroundImage}')`;
    }
  }, [state.currentCity, state.cities]);
  
  // Set the current city
  const setCurrentCity = (cityId: string) => {
    if (state.cities[cityId]) {
      setState(prev => ({
        ...prev,
        currentCity: cityId
      }));
    }
  };
  
  // Toggle completion status of a bingo item
  const toggleItemCompletion = (itemId: string) => {
    setState(prev => {
      const currentCity = prev.currentCity;
      const cityItems = [...prev.cities[currentCity].items];
      const itemIndex = cityItems.findIndex(item => item.id === itemId);
      
      if (itemIndex !== -1) {
        cityItems[itemIndex] = {
          ...cityItems[itemIndex],
          completed: !cityItems[itemIndex].completed
        };
        
        const updatedCity: City = {
          ...prev.cities[currentCity],
          items: cityItems
        };
        
        return {
          ...prev,
          cities: {
            ...prev.cities,
            [currentCity]: updatedCity
          }
        };
      }
      
      return prev;
    });
  };
  
  // Reset all items for current city (except free space)
  const resetCity = () => {
    setState(prev => {
      const currentCity = prev.currentCity;
      const updatedItems = prev.cities[currentCity].items.map(item => {
        if (item.isFreeSpace) return item;
        return { ...item, completed: false };
      });
      
      const updatedCity: City = {
        ...prev.cities[currentCity],
        items: updatedItems
      };
      
      return {
        ...prev,
        cities: {
          ...prev.cities,
          [currentCity]: updatedCity
        }
      };
    });
  };
  
  return {
    cities: state.cities,
    currentCity: state.currentCity,
    setCurrentCity,
    toggleItemCompletion,
    resetCity
  };
}
