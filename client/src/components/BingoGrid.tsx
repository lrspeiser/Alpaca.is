import { useBingoStore } from "@/hooks/useBingoStore";
import { cn } from "@/lib/utils";
import type { BingoItem } from "@/types";

interface BingoGridProps {
  onItemClick: (item: BingoItem) => void;
}

export default function BingoGrid({ onItemClick }: BingoGridProps) {
  const { cities, currentCity } = useBingoStore();
  const items = cities[currentCity]?.items || [];
  
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
  
  // Function to get image URL for an item
  const getImageUrl = (item: BingoItem) => {
    if (item.image) return item.image;
    
    // Generate a consistent image for the same item by using the id as a hash
    const idNumber = parseInt(item.id.replace(/[^0-9]/g, "")) || 0;
    const imageIndex = idNumber % travelImages.length;
    return travelImages[imageIndex];
  };
  
  return (
    <div className="bingo-grid mx-auto max-w-md mb-6 grid grid-cols-5 gap-0">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => onItemClick(item)}
          className={cn(
            "bingo-tile border shadow-sm flex flex-col justify-between items-center text-center cursor-pointer overflow-hidden",
            item.completed ? "completed" : "bg-white",
            item.isCenterSpace && !item.completed && "center-space bg-blue-50 font-semibold",
            item.isCenterSpace && item.completed && "center-space completed"
          )}
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
      ))}
    </div>
  );
}
