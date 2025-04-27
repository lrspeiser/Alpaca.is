import { useBingoStore } from "@/hooks/useBingoStore";
import { cn } from "@/lib/utils";
import type { BingoItem } from "@/types";
import { useState, useEffect } from "react";

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
  
  // Collection of reliable travel-themed images
  const travelImages = [
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1530521954074-e64f6810b32d?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1504150558240-0b4fd8946624?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1499678329028-101435549a4e?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1504542982118-59308b40fe0c?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1513581166391-887a96ddeafd?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1502791451862-7bd8c1df43a7?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1502920514313-52581002a659?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1517760444937-f6397edcbbcd?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1504150558240-0b4fd8946624?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1491331568367-8f21c7269f6d?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1503221043305-f7498f8b7888?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1454942901704-3c44c11b2ad1?auto=format&fit=crop&w=300&h=300&q=80",
    "https://images.unsplash.com/photo-1498307833015-e7b400441eb8?auto=format&fit=crop&w=300&h=300&q=80"
  ];
  
  // Function to get image URL for an item using cached URLs
  const getImageUrl = (item: BingoItem & { imageUrl?: string }) => {
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
    
    // Use a reliable fallback
    const fallbackUrl = travelImages[0];
    console.log(`[GRID] Using hardcoded fallback for ${item.id}`);
    return fallbackUrl;
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
                  <img 
                    src={getImageUrl(item)} 
                    alt={item.text}
                    className="w-full h-full object-cover absolute inset-0"
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
