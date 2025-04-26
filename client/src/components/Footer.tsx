import { useBingoStore } from "@/hooks/useBingoStore";

export default function Footer() {
  const { resetCity } = useBingoStore();

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset your bingo card? This will clear all your progress for the current city.')) {
      resetCity();
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
