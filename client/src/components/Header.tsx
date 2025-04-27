import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

interface HeaderProps {
  onOpenInfoModal: () => void;
}

export default function Header({ onOpenInfoModal }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 glass shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-xl font-heading font-bold text-primary">Travel Bingo</h1>
        </div>
        
        <div className="flex items-center">
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
