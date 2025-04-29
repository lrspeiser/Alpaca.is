import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function RepairDCImagesButton() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  const handleRepairDCImages = async () => {
    if (isRepairing) return;

    try {
      setIsRepairing(true);
      toast({
        title: "Washington DC Image Repair",
        description: "Starting repair process for Washington DC images. This may take a few minutes...",
      });

      const response = await apiRequest(
        "POST",
        "/api/repair-dc-images",
        {}
      );

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Repair Completed",
          description: "Washington DC images have been repaired successfully.",

        });
      } else {
        toast({
          title: "Repair Failed",
          description: response.error || "An error occurred during the repair process.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error repairing DC images:", error);
      toast({
        title: "Repair Failed",
        description: "An error occurred while trying to repair Washington DC images. Check the console for details.",
        variant: "destructive",
      });
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRepairDCImages}
      disabled={isRepairing}
      className="flex items-center gap-1"
    >
      <RefreshCw className={`h-4 w-4 ${isRepairing ? 'animate-spin' : ''}`} />
      {isRepairing ? "Repairing..." : "Repair DC Images"}
    </Button>
  );
}
