import { Progress } from "@/components/ui/progress";
import { useBingoStore } from "@/hooks/useBingoStore";

export default function ProgressBar() {
  const { cities, currentCity } = useBingoStore();
  
  // Calculate progress
  const items = cities[currentCity]?.items || [];
  const totalItems = items.length;
  const completedItems = items.filter(item => item.completed).length;
  const progressPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  
  return (
    <div className="glass rounded-xl p-4 mb-6 shadow-sm">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-heading font-semibold text-sm">Your Progress</h3>
          <p className="text-primary font-medium text-xs mt-1">
            {completedItems}/{totalItems} completed
          </p>
        </div>
        <div className="w-48 h-2">
          <Progress value={progressPercentage} />
        </div>
      </div>
    </div>
  );
}
