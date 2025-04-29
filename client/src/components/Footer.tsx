import { useBingoStore } from "@/hooks/useBingoStore";
import { useLocalPhotos } from "@/hooks/useLocalPhotos";

export default function Footer() {
  const { resetCity, currentCity } = useBingoStore();
  const { deleteAllPhotosForCity } = useLocalPhotos();

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset your bingo card? This will clear all your progress for the current city.')) {
      try {
        // Reset the city in the database first
        await resetCity();
        
        // Then clear all photos for this city from IndexedDB
        const deletedCount = await deleteAllPhotosForCity(currentCity);
        console.log(`[FOOTER] Deleted ${deletedCount} photos for city ${currentCity} from IndexedDB`);
      } catch (error) {
        console.error('[FOOTER] Error resetting city:', error);
      }
    }
  };

  return (
    <footer className="glass py-4 shadow-inner">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-600">Your progress is saved locally</p>
          <button
            onClick={handleReset}
            className="text-xs text-red-600 font-medium"
          >
            Reset Card
          </button>
        </div>
      </div>
    </footer>
  );
}
