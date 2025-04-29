import { useBingoStore } from "@/hooks/useBingoStore";
import { useLocalPhotos } from "@/hooks/useLocalPhotos";

export default function Footer() {
  const { resetCity, currentCity } = useBingoStore();
  const { deleteAllPhotosForCity } = useLocalPhotos();

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset your bingo card? This will clear all your progress for the current city.')) {
      try {
        console.log(`[FOOTER] Starting reset process for city ${currentCity}`);
        
        // Reset the city in the database first
        await resetCity();
        console.log(`[FOOTER] Reset city ${currentCity} on server`);
        
        // Then clear all photos for this city from IndexedDB
        const deletedCount = await deleteAllPhotosForCity(currentCity);
        console.log(`[FOOTER] Deleted ${deletedCount} photos for city ${currentCity} from IndexedDB`);
        
        // Dispatch a reset event for components to update their state
        const resetEvent = new CustomEvent('travelBingo:cityReset', {
          detail: { cityId: currentCity, timestamp: Date.now() }
        });
        window.dispatchEvent(resetEvent);
        console.log(`[FOOTER] Dispatched cityReset event for ${currentCity}`);
        
        // Alert the user of success
        console.log(`[FOOTER] Reset complete for ${currentCity}`);
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
