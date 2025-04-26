import { useBingoStore } from "@/hooks/useBingoStore";
import { cn } from "@/lib/utils";
import type { BingoItem } from "@/types";

interface BingoGridProps {
  onItemClick: (item: BingoItem) => void;
}

export default function BingoGrid({ onItemClick }: BingoGridProps) {
  const { cities, currentCity } = useBingoStore();
  const items = cities[currentCity]?.items || [];
  
  // Function to get image URL for an item
  const getImageUrl = (item: BingoItem) => {
    if (item.image) return item.image;
    return `https://source.unsplash.com/featured/?${encodeURIComponent(item.text.split(' ').slice(0, 3).join(' '))}`;
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
            item.isCenterSpace && "center-space bg-blue-100 font-semibold"
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
