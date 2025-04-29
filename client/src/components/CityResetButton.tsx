import { useBingoStore } from "@/hooks/useBingoStore";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useLocalPhotos } from "@/hooks/useLocalPhotos";

interface CityResetButtonProps {
  cityId: string;
  cityName: string;
}

export default function CityResetButton({ cityId, cityName }: CityResetButtonProps) {
  const { resetCity } = useBingoStore();
  const { deleteAllPhotosForCity } = useLocalPhotos();
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (window.confirm(`Are you sure you want to reset your progress for ${cityName}? This will clear all your marked items and photos for this city.`)) {
      setIsResetting(true);
      try {
        // Clear the items in the database
        await resetCity(cityId);
        
        // Clear local photos for this city
        await deleteAllPhotosForCity(cityId);
        
        alert(`Successfully reset all progress for ${cityName}.`);
      } catch (error) {
        console.error('Failed to reset city:', error);
        alert(`Failed to reset progress for ${cityName}. Please try again.`);
      } finally {
        setIsResetting(false);
      }
    }
  };

  return (
    <a 
      href="#"
      onClick={handleReset} 
      className={`text-red-500 hover:text-red-700 text-sm flex items-center gap-1 mt-2 ${isResetting ? 'opacity-50 pointer-events-none' : ''}`}
      aria-disabled={isResetting}
    >
      <Trash2 size={14} />
      <span className="underline">
        {isResetting ? "Resetting..." : `Reset ${cityName} progress`}
      </span>
    </a>
  );
}