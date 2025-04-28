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
  
  // Handler for generating bingo items descriptions
  const handleGenerateDescriptions = async (cityId: string) => {
    try {
      setIsLoading(true);
      toast({
        title: "Generating descriptions",
        description: "Please wait while we fetch interesting information about each location...",
        duration: 3000
      });

      // Step 1: Call the API to generate descriptions
      console.log("[ADMIN] Starting bulk description generation for city:", cityId);
      const response = await apiRequest(
        "POST",
        "/api/generate-descriptions",
        { cityId }
      );

      const data = await response.json();
      console.log("[ADMIN] Generation API response:", data);
      
      // Step 2: Force refresh from the database with cache bypassing
      console.log("[ADMIN] Descriptions generated, force-refreshing data from API");
      const freshState = await fetchBingoState(true); // true = force refresh
      
      // Step 3: Verify descriptions were actually added
      if (freshState.cities[cityId]) {
        const city = freshState.cities[cityId];
        const withDescriptions = city.items.filter((item: BingoItem) => !!item.description).length;
        console.log(`[ADMIN] Verification: City ${cityId} now has ${withDescriptions}/${city.items.length} items with descriptions`);
        
        // Test several items to ensure descriptions are being loaded
        for (let itemIdx = 1; itemIdx <= 5; itemIdx++) {
          const testItem = city.items.find((item: BingoItem) => item.id === `${cityId}-${itemIdx}`);
          if (testItem) {
            console.log(`[ADMIN] Test item (${testItem.id}) verification:`, {
              text: testItem.text,
              hasDescription: !!testItem.description,
              descriptionPreview: testItem.description ? 
                `${testItem.description.substring(0, 50)}...` : 'none'
            });
          }
        }
      }
      
      // Step 4: Force a complete reload of the component view
      if (viewingCity === cityId) {
        console.log("[ADMIN] Forcing complete city view refresh");
        setViewingCity(null);
        // Use a longer timeout to ensure state is fully updated
        setTimeout(() => setViewingCity(cityId), 1000);
      }
      
      // Step 5: Provide detailed success feedback
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
      console.log(`[ADMIN] Starting image generation flow for:`, itemId);
      console.log(`[ADMIN] Starting image generation for item: ${itemId} in city: ${cityId}`);
      setProcessingItemId(itemId);
      toast({
        title: "Generating image",
        description: "Please wait while we create a custom image...",
        duration: 3000
      });

      // Get the current state before changes
      const beforeState = await fetchBingoState(false);
      const beforeCity = beforeState.cities[cityId];
      const beforeItem = beforeCity.items.find((i: BingoItem) => i.id === itemId);
      console.log(`[ADMIN] Item before image generation:`, beforeItem);

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
      
      console.log(`[ADMIN] Fetching latest state from API after image generation`);
      // Force-fetch the updated state to verify changes
      const afterState = await fetchBingoState(true); // true = force refresh from server
      const afterCity = afterState.cities[cityId];
      const afterItem = afterCity.items.find((i: BingoItem) => i.id === itemId);
      console.log(`[ADMIN] Item in fresh API state after image generation:`, afterItem);
      
      // Check if image was actually added
      if (!afterItem.image && data.imageUrl) {
        console.warn("[ADMIN] Image URL was returned but not saved to the item:", data.imageUrl);
      }
      
      console.log(`[ADMIN] Updating local state with fresh API data`);
      // Force a refresh of the city view if we're currently viewing this city
      if (viewingCity === cityId) {
        console.log("[ADMIN] Forcing city view refresh for item update");
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

  // Generate bingo items for a city
  const handleGenerateItems = async () => {
    if (!generatingFor || !cityTheme) {
      toast({
        title: "Missing information",
        description: "Please select a city and enter a theme for generation.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest(
        "POST",
        "/api/generate-items",
        { 
          cityId: generatingFor,
          theme: cityTheme
        }
      );

      const data = await response.json();
      setGeneratedItems(data.items || []);
      
      toast({
        title: "Items generated",
        description: `${data.items?.length || 0} bingo items have been generated. Review and save them to the city.`,
      });
    } catch (error) {
      console.error("Error generating items:", error);
      toast({
        title: "Error",
        description: "Failed to generate bingo items. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save generated items to a city
  const handleSaveItems = async () => {
    if (!generatingFor || generatedItems.length === 0) {
      toast({
        title: "No items to save",
        description: "Please generate items first.",
        variant: "destructive",
      });
      return;
    }

    const city = cities[generatingFor];
    if (!city) {
      toast({
        title: "City not found",
        description: "The selected city could not be found.",
        variant: "destructive",
      });
      return;
    }

    // Get existing center space item
    const centerItem = city.items.find(item => item.isCenterSpace) || null;
    
    // Create updated city with new items plus center space
    const updatedCity = {
      ...city,
      items: centerItem 
        ? [
            ...generatedItems.slice(0, 12), 
            centerItem, 
            ...generatedItems.slice(12)
          ]
        : generatedItems
    };

    // Update cities state
    const updatedCities = {
      ...cities,
      [generatingFor]: updatedCity
    };

    try {
      await saveState({
        currentCity,
        cities: updatedCities
      });
      
      toast({
        title: "Items saved",
        description: `${generatedItems.length} bingo items have been saved to ${city.title}.`,
      });
      
      // Generate descriptions for the items
      handleGenerateDescriptions(generatingFor);
      
      // Reset generated items
      setGeneratedItems([]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save items. Please try again.",
        variant: "destructive",
      });
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
                <div className="mb-3 rounded overflow-hidden h-48 border shadow-sm">
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
                    onClick={async () => {
                      console.log("[ADMIN] Starting generation flow for:", item.id);
                      const result = await handleGenerateItemDescription(item.id, city.id);
                      console.log("[ADMIN] Generated description result:", result);
                      
                      // Fetch the current state directly from API to ensure fresh data
                      console.log("[ADMIN] Fetching latest state from API");
                      const response = await fetch('/api/bingo-state');
                      const bingoState = await response.json();
                      
                      // Check if our item has a description in the fresh state
                      const updatedCity = bingoState.cities[city.id];
                      const updatedItem = updatedCity?.items.find((i: BingoItem) => i.id === item.id);
                      console.log("[ADMIN] Item in fresh API state:", updatedItem);
                      
                      console.log("[ADMIN] Updating local state with fresh API data");
                      await saveState(bingoState);
                      
                      // Force view refresh by re-rendering the component
                      setViewingCity(null);
                      setTimeout(() => setViewingCity(city.id), 100);
                    }}
                  >
                    <BrainCircuit className="h-3 w-3 mr-1" />
                    {!item.description ? "Generate Description" : "Regenerate"}
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant="outline"
                    disabled={isLoading || processingItemId === item.id}
                    onClick={async () => {
                      console.log("[ADMIN] Starting image generation flow for:", item.id);
                      const result = await handleGenerateItemImage(item.id, city.id);
                      console.log("[ADMIN] Generated image result:", result);
                      
                      // Fetch the current state directly from API to ensure fresh data
                      console.log("[ADMIN] Fetching latest state from API after image generation");
                      const response = await fetch('/api/bingo-state');
                      const bingoState = await response.json();
                      
                      // Check if our item has an image in the fresh state
                      const updatedCity = bingoState.cities[city.id];
                      const updatedItem = updatedCity?.items.find((i: BingoItem) => i.id === item.id);
                      console.log("[ADMIN] Item in fresh API state after image generation:", updatedItem);
                      
                      console.log("[ADMIN] Updating local state with fresh API data");
                      await saveState(bingoState);
                      
                      // Force view refresh by re-rendering the component
                      setViewingCity(null);
                      setTimeout(() => setViewingCity(city.id), 100);
                    }}
                  >
                    <ImagePlus className="h-3 w-3 mr-1" />
                    {!item.image ? "Generate Image" : "Regenerate"}
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant={item.completed ? "destructive" : "default"}
                    onClick={async () => {
                      try {
                        // Call API to toggle item completion
                        const response = await fetch('/api/toggle-item', {
                          method: 'POST',
                          body: JSON.stringify({ itemId: item.id, cityId: city.id }),
                          headers: {
                            'Content-Type': 'application/json'
                          }
                        });
                        
                        if (!response.ok) throw new Error("Failed to toggle completion");
                        
                        // Fetch fresh state after toggling
                        console.log("[ADMIN] Fetching latest state after toggling completion");
                        const stateResponse = await fetch('/api/bingo-state');
                        const bingoState = await stateResponse.json();
                        
                        // Update local state
                        console.log("[ADMIN] Updating local state with fresh data");
                        await saveState(bingoState);
                        
                        // Refresh view
                        setViewingCity(null);
                        setTimeout(() => setViewingCity(city.id), 100);
                        
                        toast({
                          title: item.completed ? "Item marked incomplete" : "Item marked complete",
                          duration: 2000
                        });
                      } catch (error) {
                        console.error("[ADMIN] Error toggling completion:", error);
                        toast({
                          title: "Error",
                          description: "Failed to toggle item completion status",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    {item.completed ? (
                      <>
                        <X className="h-3 w-3 mr-1" />
                        Mark Incomplete
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Mark Complete
                      </>
                    )}
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
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Link href="/">
          <Button variant="outline">Back to Bingo</Button>
        </Link>
      </div>
      
      {viewingCity ? (
        renderCityDetails()
      ) : (
        <Tabs defaultValue="manage" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="manage">Manage Cities</TabsTrigger>
            <TabsTrigger value="create">Create City</TabsTrigger>
            <TabsTrigger value="generate">Generate Content</TabsTrigger>
          </TabsList>
          
          {/* Manage Existing Cities */}
          <TabsContent value="manage">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Object.values(cities).map((city) => (
                <Card key={city.id} className="p-4">
                  <h3 className="text-xl font-bold mb-2">{city.title}</h3>
                  <p className="text-sm text-gray-500 mb-2">{city.subtitle}</p>
                  <div className="text-sm mb-4 space-y-1">
                    <p>Items: {city.items.length}</p>
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                        {city.items.filter(item => !!item.description).length} with descriptions
                      </span>
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">
                        {city.items.filter(item => !!item.image).length} with images
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      size="sm"
                      onClick={() => handleGenerateDescriptions(city.id)}
                      disabled={isLoading}
                    >
                      <BrainCircuit className="mr-2 h-4 w-4" />
                      Generate All Descriptions
                    </Button>
                    
                    <Button 
                      size="sm"
                      variant="outline"
                      onClick={() => setViewingCity(city.id)}
                    >
                      <Info className="mr-2 h-4 w-4" />
                      View Items
                    </Button>
                    
                    {/* Custom admin implementation for the Generate All Images button */}
                    <div className="mt-2 w-full">
                      <GenerateAllImagesButton />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          {/* Create New City */}
          <TabsContent value="create">
            <div className="max-w-lg mx-auto">
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Create New City</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">City ID</label>
                    <Input 
                      placeholder="e.g., paris, rome, tokyo (lowercase, no spaces)" 
                      value={newCity.id}
                      onChange={(e) => setNewCity({...newCity, id: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">City Name</label>
                    <Input 
                      placeholder="e.g., Paris" 
                      value={newCity.title}
                      onChange={(e) => setNewCity({...newCity, title: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Subtitle (Optional)</label>
                    <Input 
                      placeholder="e.g., City of Lights" 
                      value={newCity.subtitle}
                      onChange={(e) => setNewCity({...newCity, subtitle: e.target.value})}
                    />
                  </div>
                  
                  
                  <Button 
                    onClick={handleCreateCity}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create City
                  </Button>
                </div>
              </Card>
            </div>
          </TabsContent>
          
          {/* Generate Content */}
          <TabsContent value="generate">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Generation Form */}
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Generate Bingo Items</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Select City</label>
                    <Select 
                      value={generatingFor} 
                      onValueChange={setGeneratingFor}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a city" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(cities).map((city) => (
                          <SelectItem key={city.id} value={city.id}>
                            {city.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Theme/Focus</label>
                    <Textarea 
                      placeholder="e.g., Must-see tourist attractions, Hidden gems, Foodie experiences, etc." 
                      value={cityTheme}
                      onChange={(e) => setCityTheme(e.target.value)}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleGenerateItems}
                    disabled={isLoading || !generatingFor || !cityTheme}
                    className="w-full"
                  >
                    <BrainCircuit className="mr-2 h-4 w-4" />
                    Generate 24 Bingo Items
                  </Button>
                </div>
              </Card>
              
              {/* Generated Items Preview */}
              <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Generated Items</h2>
                  
                  {generatedItems.length > 0 && (
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setGeneratedItems([])}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Clear
                      </Button>
                      
                      <Button 
                        size="sm"
                        onClick={handleSaveItems}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save to City
                      </Button>
                    </div>
                  )}
                </div>
                
                {generatedItems.length > 0 ? (
                  <div className="h-[500px] overflow-y-auto space-y-2">
                    {generatedItems.map((item, index) => (
                      <div key={item.id} className="p-2 border rounded">
                        <div className="flex justify-between">
                          <span className="font-medium">#{index + 1}</span>
                        </div>
                        <div className="text-sm">{item.text}</div>
                        {item.description && (
                          <div className="mt-1 text-xs text-gray-500">{item.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[500px] flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <BrainCircuit className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Generated items will appear here</p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}