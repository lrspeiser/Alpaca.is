import { useBingoStore } from "@/hooks/useBingoStore";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BingoItem } from "@/types";

export default function BingoGrid() {
  const { cities, currentCity, toggleItemCompletion } = useBingoStore();
  const items = cities[currentCity]?.items || [];

  const handleTileClick = (item: BingoItem) => {
    if (!item.isFreeSpace) {
      toggleItemCompletion(item.id);
    }
  };
  
  return (
    <div className="bingo-grid mx-auto max-w-md mb-6">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => handleTileClick(item)}
          className={cn(
            "bingo-tile border rounded-lg p-2 shadow-sm flex flex-col justify-between items-center text-center cursor-pointer",
            item.completed && "completed",
            item.isFreeSpace ? "free-space" : "bg-white"
          )}
        >
          <p className="text-xs leading-tight font-medium">{item.text}</p>
          {item.completed && (
            <div className="mt-1 text-secondary">
              <CheckIcon className="h-6 w-6" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
