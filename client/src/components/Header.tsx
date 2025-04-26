import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { useBingoStore } from "@/hooks/useBingoStore";

interface HeaderProps {
  onOpenInfoModal: () => void;
}

export default function Header({ onOpenInfoModal }: HeaderProps) {
  const { cities, currentCity, setCurrentCity } = useBingoStore();
  
  // Sort cities by ID for alphabetical order
  const sortedCityIds = Object.keys(cities).sort();

  return (
    <header className="sticky top-0 z-50 glass shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-xl font-heading font-bold text-primary">Travel Bingo</h1>
        </div>
        
        <div className="flex items-center space-x-3">
          <Select value={currentCity} onValueChange={setCurrentCity}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Select a city" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {sortedCityIds.map((cityId) => (
                  <SelectItem key={cityId} value={cityId}>
                    {cities[cityId].title.replace(" Bingo", "")}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          
          <Button 
            variant="default" 
            size="iconSm" 
            className="rounded-full" 
            onClick={onOpenInfoModal}
          >
            <Info className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
