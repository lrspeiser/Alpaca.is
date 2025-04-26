import { useBingoStore } from "@/hooks/useBingoStore";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BingoItem } from "@/types";

interface BingoGridProps {
  onItemClick: (item: BingoItem) => void;
}

export default function BingoGrid({ onItemClick }: BingoGridProps) {
  const { cities, currentCity } = useBingoStore();
  const items = cities[currentCity]?.items || [];
  
  return (
    <div className="bingo-grid mx-auto max-w-md mb-6">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => onItemClick(item)}
          className={cn(
            "bingo-tile border rounded-lg p-2 shadow-sm flex flex-col justify-between items-center text-center cursor-pointer",
            item.completed ? "completed bg-green-100" : "bg-white bg-opacity-90",
            item.isCenterSpace && "center-space bg-blue-100 font-semibold"
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
