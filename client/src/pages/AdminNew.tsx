import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useBingoStore } from "@/hooks/useBingoStore";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BrainCircuit, ImagePlus, ArrowLeft } from "lucide-react";
import type { BingoItem } from "@/types";
import { Link } from "wouter";
import GenerateAllImagesButton from "@/components/GenerateAllImagesButton";
import RepairDCImagesButton from "@/components/RepairDCImagesButton";
import FixMissingImagesButton from "@/components/FixMissingImagesButton";

export default function Admin() {
  const { cities, currentCity, saveState, fetchBingoState } = useBingoStore();
  const [activeTab, setActiveTab] = useState("manage");
  const [selectedCity, setSelectedCity] = useState(currentCity);
  const [viewingCity, setViewingCity] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);
  const { toast } = useToast();

  // New city form state - simplified to just ID and name
  const [newCity, setNewCity] = useState({
    id: "",
    cityName: "",
  });

  // For displaying progress
  const [creationInProgress, setCreationInProgress] = useState(false);
  
  // Generate description for a single item
  const handleGenerateItemDescription = async (itemId: string, cityId: string) => {
    try {
      console.log(`[ADMIN] Starting description generation for item: ${itemId} in city: ${cityId}`);
      setProcessingItemId(itemId);
      toast({
        title: "Generating description",
        description: "Please wait while we create an interesting description...",
        duration: 3000
      });

      // Get the current state before changes
      const beforeState = await fetchBingoState(false);
      const beforeCity = beforeState.cities[cityId];
      const beforeItem = beforeCity.items.find((i: BingoItem) => i.id === itemId);
      console.log(`[ADMIN] Item before generation:`, beforeItem);

      // Call the API to generate a description
      const response = await apiRequest(
        "POST",
        "/api/generate-description",
        { itemId, cityId }
      );

      const data = await response.json();
      console.log(`[ADMIN] Description generation response:`, data);
      
      // Force-fetch the updated state to verify changes
      const afterState = await fetchBingoState(true); // true = force refresh from server
      const afterCity = afterState.cities[cityId];
      const afterItem = afterCity.items.find((i: BingoItem) => i.id === itemId);
      console.log(`[ADMIN] Item after generation:`, afterItem);
      console.log(`[ADMIN] Description updated: ${beforeItem.description !== afterItem.description ? 'YES' : 'NO'}`);
      
      // Force a refresh of the city view if we're currently viewing this city
      if (viewingCity === cityId) {
        console.log("[ADMIN] Forcing city view refresh for item update");
        setViewingCity(null);
        setTimeout(() => setViewingCity(cityId), 500);
      }
      
      toast({
        title: "Success!",
        description: "Description generated successfully.",
        duration: 3000
      });
      
      return data.description;
    } catch (error) {
      console.error("[ADMIN] Error generating description:", error);
      toast({
        title: "Error",
        description: "Failed to generate description. Please try again.",
        variant: "destructive",
        duration: 5000
      });
      return null;
    } finally {
      setProcessingItemId(null);
    }
  };

  // Generate image for a single item
  const handleGenerateItemImage = async (itemId: string, cityId: string) => {
    try {
      console.log(`[ADMIN] Starting image generation for item: ${itemId} in city: ${cityId}`);
      setProcessingItemId(itemId);
      toast({
        title: "Generating image",
        description: "Please wait while we create a custom image...",
        duration: 3000
      });

      // Call the API to generate an image
      let response;
      try {
        response = await apiRequest(
          "POST",
          "/api/generate-image",
          { itemId, cityId }
        );
      } catch (fetchError: any) {
        console.error("[ADMIN] Network error during image generation:", fetchError);
        throw new Error(`Network error: ${fetchError.message}`);
      }

      let data;
      try {
        data = await response.json();
        console.log(`[ADMIN] Generated image result:`, data.imageUrl || null);
      } catch (jsonError) {
        console.error("[ADMIN] Error parsing JSON response:", jsonError);
        throw new Error("Invalid response from server");
      }

      if (!response.ok) {
        console.error("[ADMIN] Error from server:", data);
        throw new Error(data.error || data.details?.message || "Unknown server error");
      }
      
      // Force-fetch the updated state to verify changes
      const afterState = await fetchBingoState(true); // true = force refresh from server
      const afterCity = afterState.cities[cityId];
      const afterItem = afterCity.items.find((i: BingoItem) => i.id === itemId);
      
      // Force a refresh of the city view if we're currently viewing this city
      if (viewingCity === cityId) {
        setViewingCity(null);
        setTimeout(() => setViewingCity(cityId), 300);
      }
      
      toast({
        title: "Success!",
        description: "Image generated successfully.",
        duration: 3000
      });
      
      return data.imageUrl;
    } catch (error: any) {
      console.error("[ADMIN] Error generating image:", error);
      toast({
        title: "Image Generation Failed",
        description: error.message || "Failed to generate image. Please try again.",
        variant: "destructive",
        duration: 5000
      });
      return null;
    } finally {
      setProcessingItemId(null);
    }
  };

  // Create a new city with full automation
  const handleCreateCity = async () => {
    if (!newCity.id || !newCity.cityName) {
      toast({
        title: "Missing information",
        description: "Please provide both an ID and name for the city.",
        variant: "destructive",
      });
      return;
    }

    setCreationInProgress(true);
    try {
      toast({
        title: "Creating city",
        description: `Creating ${newCity.cityName} bingo card with automated content generation. This will take a few minutes.`,
        duration: 5000
      });

      // Call the new unified creation endpoint
      console.log(`[ADMIN] Starting city creation for ${newCity.cityName} (${newCity.id})`);
      const response = await apiRequest(
        "POST",
        "/api/create-city",
        { 
          cityId: newCity.id.toLowerCase(),
          cityName: newCity.cityName
        }
      );

      const data = await response.json();
      console.log(`[ADMIN] City creation response:`, data);
      
      if (data.success) {
        // Force refresh state from server
        await fetchBingoState(true);
        
        toast({
          title: "City created successfully!",
          description: `${newCity.cityName} bingo card has been created with items and descriptions. Images will be generated in the background and will appear gradually.`,
          duration: 8000
        });
        
        // Reset form
        setNewCity({
          id: "",
          cityName: ""
        });
        
        // Switch to the manage tab to show the new city
        setActiveTab("manage");
        setSelectedCity(newCity.id.toLowerCase());
        setViewingCity(newCity.id.toLowerCase());
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to create city. Please try again.",
          variant: "destructive",
          duration: 5000
        });
      }
    } catch (error: any) {
      console.error("[ADMIN] Error creating city:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create city. Please try again.",
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setCreationInProgress(false);
    }
  };

  // Handler for generating bingo items descriptions
  const handleGenerateDescriptions = async (cityId: string) => {
    try {
      setIsLoading(true);
      toast({
        title: "Generating descriptions",
        description: "Please wait while we fetch interesting information about each location...",
        duration: 3000
      });

      // Call the API to generate descriptions
      console.log("[ADMIN] Starting bulk description generation for city:", cityId);
      const response = await apiRequest(
        "POST",
        "/api/generate-descriptions",
        { cityId }
      );

      const data = await response.json();
      console.log("[ADMIN] Description generation response:", data);
      
      // Force refresh from the database with cache bypassing
      console.log("[ADMIN] Descriptions generated, force-refreshing data from API");
      const freshState = await fetchBingoState(true); // true = force refresh
      
      // Force a complete reload of the component view
      if (viewingCity === cityId) {
        console.log("[ADMIN] Forcing complete city view refresh");
        setViewingCity(null);
        // Use a longer timeout to ensure state is fully updated
        setTimeout(() => setViewingCity(cityId), 1000);
      }
      
      // Provide detailed success feedback
      const descriptionsCount = freshState.cities[cityId]?.items.filter((item: BingoItem) => !!item.description).length || 0;
      toast({
        title: "Success!",
        description: `Generated ${descriptionsCount} descriptions for ${freshState.cities[cityId]?.title}.`,
        duration: 5000
      });
    } catch (error) {
      console.error("Error generating descriptions:", error);
      toast({
        title: "Error",
        description: "Failed to generate descriptions. Please try again later.",
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Render the details of a city, including all items
  const renderCityDetails = () => {
    if (!viewingCity || !cities[viewingCity]) return null;
    
    const city = cities[viewingCity];
    
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setViewingCity(null)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cities
            </Button>
            <h2 className="text-2xl font-bold">{city.title}</h2>
            {city.subtitle && <span className="text-gray-500">({city.subtitle})</span>}
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="flex gap-2">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                {city.items.filter(item => !!item.description).length} with descriptions
              </span>
              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">
                {city.items.filter(item => !!item.image).length} with images
              </span>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs">
                {city.items.filter(item => item.completed).length} completed
              </span>
            </div>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${(city.items.filter(item => item.completed).length / city.items.length) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {city.items.map((item) => (
            <Card 
              key={item.id} 
              className={`p-4 relative overflow-hidden ${item.completed ? 'border-green-500 border-2' : ''}`}
            >
              {/* Status badges */}
              <div className="absolute top-0 right-0 flex">
                {item.isCenterSpace && (
                  <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-bl">
                    Center
                  </div>
                )}
                {item.completed && (
                  <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-bl">
                    Completed
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold">{item.text}</h3>
                <div className="flex gap-1">
                  {item.description && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px]">
                      Description
                    </span>
                  )}
                  {item.image && (
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded-full text-[10px]">
                      Image
                    </span>
                  )}
                </div>
              </div>
              
              {/* Show description if available */}
              {item.description ? (
                <div className="text-sm text-gray-700 mb-3 p-2 bg-gray-50 rounded border">
                  {item.description}
                </div>
              ) : (
                <div className="text-sm text-gray-400 mb-3">No description yet</div>
              )}
              
              {/* Show image if available */}
              {item.image ? (
                <div className="mb-3 rounded overflow-hidden aspect-square border shadow-sm">
                  <img 
                    src={item.image} 
                    alt={item.text} 
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ) : (
                <div className="mb-3 h-12 flex items-center justify-center bg-gray-50 rounded border text-gray-400 text-sm">
                  No image yet
                </div>
              )}
              
              {/* Item actions */}
              {!item.isCenterSpace && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    disabled={isLoading || processingItemId === item.id}
                    onClick={() => handleGenerateItemDescription(item.id, city.id)}
                  >
                    <BrainCircuit className="h-3 w-3 mr-1" />
                    {!item.description ? "Generate Description" : "Regenerate"}
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant="outline"
                    disabled={isLoading || processingItemId === item.id}
                    onClick={() => handleGenerateItemImage(item.id, city.id)}
                  >
                    <ImagePlus className="h-3 w-3 mr-1" />
                    {!item.image ? "Generate Image" : "Regenerate"}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Bingo Admin</h1>
        <Link href="/">
          <Button variant="outline">Return to Bingo</Button>
        </Link>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-8 w-full justify-start">
          <TabsTrigger value="manage">Manage Cities</TabsTrigger>
          <TabsTrigger value="create">Create City</TabsTrigger>
        </TabsList>
        
        {/* ===== MANAGE CITIES TAB ===== */}
        <TabsContent value="manage">
          {viewingCity ? (
            renderCityDetails()
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-6">Manage Cities</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.values(cities).map((city) => (
                  <Card key={city.id} className="p-6 hover:shadow-md transition-shadow duration-200">
                    <h3 className="text-xl font-bold">{city.title}</h3>
                    {city.subtitle && (
                      <p className="text-gray-500">{city.subtitle}</p>
                    )}
                    <div className="mt-4 grid grid-cols-3 gap-2 text-sm mb-6">
                      <div className="flex flex-col items-center p-2 bg-blue-50 rounded">
                        <span className="font-bold text-lg">{city.items.length}</span>
                        <span className="text-xs text-blue-700">Items</span>
                      </div>
                      <div className="flex flex-col items-center p-2 bg-green-50 rounded">
                        <span className="font-bold text-lg">
                          {city.items.filter(item => !!item.description).length}
                        </span>
                        <span className="text-xs text-green-700">Descriptions</span>
                      </div>
                      <div className="flex flex-col items-center p-2 bg-purple-50 rounded">
                        <span className="font-bold text-lg">
                          {city.items.filter(item => !!item.image).length}
                        </span>
                        <span className="text-xs text-purple-700">Images</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-stretch gap-2">
                      <Button 
                        onClick={() => setViewingCity(city.id)}
                        variant="outline"
                      >
                        View Details
                      </Button>
                      <Button
                        disabled={isLoading}
                        onClick={() => handleGenerateDescriptions(city.id)}
                        variant="outline"
                      >
                        Generate All Descriptions
                      </Button>
                      <GenerateAllImagesButton cityId={city.id} />
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
        
        {/* ===== CREATE CITY TAB (SIMPLIFIED) ===== */}
        <TabsContent value="create">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Create New City</h2>
            <Card className="p-6">
              <div className="grid gap-4">
                <div>
                  <label htmlFor="city-id" className="block text-sm font-medium mb-1">
                    City ID (unique identifier, lowercase, no spaces)
                  </label>
                  <Input 
                    id="city-id"
                    value={newCity.id}
                    onChange={e => setNewCity({ ...newCity, id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    placeholder="e.g. paris, london, tokyo"
                  />
                </div>
                
                <div>
                  <label htmlFor="city-name" className="block text-sm font-medium mb-1">
                    City Name
                  </label>
                  <Input 
                    id="city-name"
                    value={newCity.cityName}
                    onChange={e => setNewCity({ ...newCity, cityName: e.target.value })}
                    placeholder="e.g. Paris, London, Tokyo"
                  />
                </div>
                
                <div className="bg-blue-50 p-4 rounded-md mt-2">
                  <h3 className="font-medium text-blue-800 mb-2">Automatic Content Generation</h3>
                  <p className="text-sm text-blue-700">
                    This will automatically create a complete bingo card with:
                  </p>
                  <ul className="text-sm text-blue-700 list-disc ml-5 mt-1">
                    <li>25 bingo activities tailored for college students</li>
                    <li>Detailed descriptions for each activity</li>
                    <li>Custom style guide for the city's unique character</li>
                    <li>AI-generated images based on the city's style guide</li>
                  </ul>
                </div>
                
                <Button 
                  onClick={handleCreateCity}
                  disabled={!newCity.id || !newCity.cityName || creationInProgress}
                  className="mt-4"
                >
                  {creationInProgress ? 'Creating...' : 'Create City with Content'}
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}