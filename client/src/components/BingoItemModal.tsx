import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useBingoStore } from "@/hooks/useBingoStore";
import { useEffect } from "react";
import type { BingoItem } from "@/types";

interface BingoItemModalProps {
  item: BingoItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function BingoItemModal({ item, isOpen, onClose }: BingoItemModalProps) {
  const { toggleItemCompletion } = useBingoStore();
  
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);
  
  if (!isOpen || !item) return null;
  
  const handleToggleCompletion = (completed: boolean) => {
    toggleItemCompletion(item.id);
    onClose();
  };
  
  // Default image if none provided
  const imageUrl = item.image || 
    `https://source.unsplash.com/featured/?${encodeURIComponent(item.text.split(' ').slice(0, 3).join(' '))}`;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl max-w-md w-11/12 max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
          <h3 className="font-heading font-bold text-lg">{item.text}</h3>
          <Button 
            variant="ghost" 
            size="iconSm" 
            className="rounded-full" 
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-5">
          <div className="mb-4 h-48 overflow-hidden rounded-lg">
            <img 
              src={imageUrl} 
              alt={item.text} 
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="mb-6">
            <p className="text-sm">
              {item.description || `Have you completed "${item.text}" yet? Mark it as done when you have!`}
            </p>
          </div>
          
          <div className="flex space-x-3">
            <Button 
              variant={item.completed ? "default" : "outline"} 
              className="flex-1"
              onClick={() => handleToggleCompletion(true)}
            >
              {item.completed ? "Completed ✓" : "Mark as Done"}
            </Button>
            
            <Button 
              variant={!item.completed ? "default" : "outline"} 
              className="flex-1"
              onClick={() => handleToggleCompletion(false)}
            >
              {!item.completed ? "Not Done ✗" : "Mark as Not Done"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}