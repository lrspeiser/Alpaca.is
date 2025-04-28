import { useBingoStore } from "@/hooks/useBingoStore";
import { cn } from "@/lib/utils";
import type { BingoItem } from "@/types";
import { useState, useEffect } from "react";
import { ImageDebugger, type ImageLoadInfo } from "./ImageDebugger";
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

interface BingoGridProps {
  onItemClick: (item: BingoItem) => void;
}

export default function BingoGrid({ onItemClick }: BingoGridProps) {
  const { cities, currentCity, setCurrentCity, fetchBingoState } = useBingoStore();
  const items = cities[currentCity]?.items || [];
  // Track when we need to force a re-render
  const [forceRefresh, setForceRefresh] = useState(0);
  // Track image URLs in state to ensure they're updated
  const [itemImages, setItemImages] = useState<Record<string, string>>({});
  
  // Update image cache whenever items change
  useEffect(() => {
    const newImageMap: Record<string, string> = {};
    items.forEach(item => {
      newImageMap[item.id] = item.image || '';
    });
    setItemImages(newImageMap);
  }, [items, forceRefresh]);
  
  // Function to handle clicking on a bingo tile with forced refresh
  const handleTileClick = (item: BingoItem) => {
    // First, open the modal
    onItemClick(item);
    
    // After a small delay, force refresh the component data
    setTimeout(() => {
      fetchBingoState(true);
      setForceRefresh(prev => prev + 1);
    }, 300);
  };
  
  // No more placeholder images - we only use database images
  
  // Improved function to get image URL for an item - supports local and remote URLs
  const getImageUrl = (item: BingoItem & { imageUrl?: string }): string | null => {
    // First check our cached image URLs from state for performance
    if (itemImages[item.id] && itemImages[item.id].length > 0) {
      return itemImages[item.id];
    }
    
    // Get the image URL from either item.image or item.imageUrl property
    const imageSource = item.image || (item as any).imageUrl;
    
    if (!imageSource || typeof imageSource !== 'string') {
      console.log(`[GRID] No image found for ${item.id}`);
      return null;
    }
    
    // Handle local image paths that start with /images/
    if (imageSource.startsWith('/images/')) {
      console.log(`[GRID] Using local image for ${item.id}: ${imageSource}`);
      // Cache the URL for future use
      setItemImages(prev => ({
        ...prev,
        [item.id]: imageSource
      }));
      return imageSource;
    }
    
    // Handle remote URLs that start with http
    if (imageSource.startsWith('http')) {
      console.log(`[GRID] Using remote URL for ${item.id}: ${imageSource.substring(0, 30)}...`);
      // Cache the URL for future use
      setItemImages(prev => ({
        ...prev,
        [item.id]: imageSource
      }));
      return imageSource;
    }
    
    // If we get here, the image URL format is unsupported
    console.log(`[GRID] Unsupported image format for ${item.id}: ${imageSource}`);
    return null;
  };
  
  // Create a 5x5 grid with null values
  const grid: (BingoItem | null)[][] = Array(5).fill(null).map(() => Array(5).fill(null));
  
  // First, place items with defined grid positions
  const remainingItems: BingoItem[] = [];
  let centerSpaceItem: BingoItem | null = null;
  
  items.forEach(item => {
    // Find the center item
    if (item.isCenterSpace) {
      centerSpaceItem = item;
      // Ensure center item always goes in center (2,2)
      grid[2][2] = item;
      return;
    }
    
    // Place items with defined grid positions
    if (typeof item.gridRow === 'number' && typeof item.gridCol === 'number' && 
        item.gridRow >= 0 && item.gridRow < 5 && 
        item.gridCol >= 0 && item.gridCol < 5) {
      // Don't override center position (2,2)
      if (item.gridRow === 2 && item.gridCol === 2) {
        remainingItems.push(item);
      } else {
        grid[item.gridRow][item.gridCol] = item;
      }
    } else {
      remainingItems.push(item);
    }
  });
  
  // Ensure we have a center item
  if (!grid[2][2] && centerSpaceItem) {
    grid[2][2] = centerSpaceItem;
  }
  
  // Fill remaining positions with unpositioned items
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (!grid[row][col] && remainingItems.length > 0) {
        grid[row][col] = remainingItems.shift() || null;
      }
    }
  }
  
  // CSS Grid layout for the 5x5 bingo grid - ensures items are positioned correctly
  const gridContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateRows: 'repeat(5, minmax(60px, 1fr))',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '0',
    border: '1px solid #ddd',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    width: '100%'
  };
  
  return (
    <div className="bingo-container w-full mb-6 shadow-md rounded-md">
      {/* Traditional Bingo Card Title - Now includes dropdown */}
      <div className="bg-primary text-white font-bold py-3 text-center text-xl uppercase tracking-wider border border-b-0 rounded-t-md shadow-sm flex justify-center items-center">
        <div className="flex items-center justify-center space-x-2">
          <Select value={currentCity} onValueChange={(newCity: string) => {
            console.log(`[GRID] City selected from dropdown: ${newCity}`);
            // Update to the new selected city and refresh
            setCurrentCity(newCity);
            // Wait for state to be updated, then force refresh local component
            setTimeout(() => {
              console.log(`[GRID] Refreshing after city change to ${newCity}`);
              setForceRefresh(prev => prev + 1);
            }, 200);
          }}>
            <SelectTrigger className="w-[120px] h-8 bg-primary border-white/30 text-white">
              <SelectValue placeholder="Select a city" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.keys(cities).sort().map((cityId) => (
                  <SelectItem key={cityId} value={cityId}>
                    {cities[cityId].title.replace(" Bingo", "")}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <span className="tracking-widest">BINGO</span>
        </div>
      </div>
      
      <div style={gridContainerStyle} className="bingo-grid">
      {grid.map((row, rowIndex) => 
        row.map((item, colIndex) => {
          // Custom position styling to ensure each item appears in the exact grid position
          const itemStyle = {
            gridRow: `${rowIndex + 1}`,    // CSS grid is 1-indexed
            gridColumn: `${colIndex + 1}`,  // CSS grid is 1-indexed
            height: '100%', 
            minHeight: '60px'
          } as React.CSSProperties;
          if (!item) {
            return (
              <div 
                key={`empty-${rowIndex}-${colIndex}`} 
                className="bingo-tile bg-gray-100" 
                style={itemStyle as React.CSSProperties}
              />
            );
          }
          
          return (
            <div
              key={`${item.id}-${forceRefresh}`}
              onClick={() => handleTileClick(item)}
              className={cn(
                "bingo-tile border shadow-sm flex flex-col justify-between items-center text-center cursor-pointer overflow-hidden",
                item.completed ? "completed" : "bg-white",
                item.isCenterSpace && "center-space font-semibold"
              )}
              style={itemStyle as React.CSSProperties}
            >
              
              {item.completed ? (
                <div className="w-full h-full relative aspect-square">
                  {/* Use ImageDebugger to diagnose image loading issues */}
                  <ImageDebugger
                    src={getImageUrl(item)}
                    alt={item.text}
                    className="absolute inset-0 object-cover w-full h-full"
                    onLoadInfo={(info: ImageLoadInfo) => {
                      console.log(`[GRID-COMPLETED-DEBUG] ${item.id}:`, info);
                    }}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-end p-1">
                    <p className="text-[10px] leading-tight font-medium text-white">{item.text}</p>
                  </div>
                </div>
              ) : (
                <div className="p-2 h-full w-full flex flex-col justify-center">
                  <p className="text-xs leading-tight font-medium">{item.text}</p>
                </div>
              )}
            </div>
          );
        })
      )}
      </div>
    </div>
  );
}
