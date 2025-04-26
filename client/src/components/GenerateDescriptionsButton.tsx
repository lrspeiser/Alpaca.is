import { Button } from "@/components/ui/button";
import { useBingoStore } from "@/hooks/useBingoStore";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { LucideBrainCircuit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function GenerateDescriptionsButton() {
  const { currentCity } = useBingoStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerateDescriptions = async () => {
    try {
      setIsGenerating(true);
      toast({
        title: "Generating descriptions",
        description: "Please wait while we fetch interesting information about each location...",
        duration: 3000
      });

      const response = await apiRequest("/api/generate-descriptions", {
        method: "POST",
        body: JSON.stringify({ cityId: currentCity }),
        headers: {
          "Content-Type": "application/json"
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Success!",
          description: data.message || "Descriptions generated successfully. Click on any bingo item to view detailed information.",
          duration: 5000
        });
      } else {
        throw new Error("Failed to generate descriptions");
      }
    } catch (error) {
      console.error("Error generating descriptions:", error);
      toast({
        title: "Error",
        description: "Failed to generate descriptions. Please try again later.",
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleGenerateDescriptions}
      disabled={isGenerating}
      variant="outline"
      className="mb-4 bg-white/90 hover:bg-white"
    >
      <LucideBrainCircuit className="mr-2 h-4 w-4" />
      {isGenerating ? "Generating..." : "Get AI Descriptions"}
    </Button>
  );
}