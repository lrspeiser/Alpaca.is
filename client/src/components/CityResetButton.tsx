import { Button } from "@/components/ui/button";
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

  const handleReset = async () => {
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
    <Button 
      variant="destructive" 
      size="sm" 
      onClick={handleReset} 
      disabled={isResetting}
      className="flex items-center gap-1 mt-4"
    >
      <Trash2 size={16} />
      {isResetting ? "Resetting..." : `Reset ${cityName} Progress`}
    </Button>
  );
}