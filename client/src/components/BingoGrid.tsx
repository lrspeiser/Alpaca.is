import { useBingoStore } from "@/hooks/useBingoStore";
import { cn } from "@/lib/utils";
import type { BingoItem } from "@/types";
import { useState, useEffect } from "react";
import { ImageDebugger, type ImageLoadInfo } from "./ImageDebugger";

interface BingoGridProps {
  onItemClick: (item: BingoItem) => void;
}

export default function BingoGrid({ onItemClick }: BingoGridProps) {
  const { cities, currentCity, toggleItemCompletion, fetchBingoState } = useBingoStore();
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
  
  // Function to get image URL for an item using cached URLs - only from database, no placeholders
  const getImageUrl = (item: BingoItem & { imageUrl?: string }): string | null => {
    // First check our cached image URLs from state
    if (itemImages[item.id] && itemImages[item.id].length > 0) {
      return itemImages[item.id];
    }
    
    // Try item.image first
    if (item.image && typeof item.image === 'string' && item.image.startsWith('http')) {
      console.log(`[GRID] Using item.image URL for ${item.id}: ${item.image.substring(0, 30)}...`);
      // Cache the URL for future use
      setItemImages(prev => ({
        ...prev,
        [item.id]: item.image as string
      }));
      return item.image;
    }
    
    // Try imageUrl next
    if ((item as any).imageUrl && typeof (item as any).imageUrl === 'string' && (item as any).imageUrl.startsWith('http')) {
      console.log(`[GRID] Using item.imageUrl for ${item.id}: ${(item as any).imageUrl.substring(0, 30)}...`);
      // Cache the URL for future use
      setItemImages(prev => ({
        ...prev,
        [item.id]: (item as any).imageUrl
      }));
      return (item as any).imageUrl;
    }
    
    // No fallback images, return null
    console.log(`[GRID] No image found for ${item.id}`);
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
    gridTemplateColumns: 'repeat(5, minmax(60px, 1fr))',
    gap: '0',
    border: '1px solid #ddd',
    borderRadius: '0.5rem',
    overflow: 'hidden',
  };
  
  return (
    <div className="bingo-container mx-auto max-w-md mb-6 shadow-md rounded-md">
      {/* Traditional Bingo Card Title */}
      <div className="bg-primary text-white font-bold py-3 text-center text-xl uppercase tracking-wider border border-b-0 rounded-t-md shadow-sm">
        {cities[currentCity]?.title.replace("Bingo", "").trim()} <span className="tracking-widest">BINGO</span>
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
                <div className="w-full h-full relative">
                  {/* Use ImageDebugger to diagnose image loading issues */}
                  <ImageDebugger
                    src={item.image || (item as any).imageUrl}
                    alt={item.text}
                    className="absolute inset-0"
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
