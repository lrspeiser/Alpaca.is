import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBingoStore } from "@/hooks/useBingoStore";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BrainCircuit, ImagePlus, Plus, X, Save, RefreshCw } from "lucide-react";
import type { BingoItem, City } from "@/types";

export default function Admin() {
  const { cities, currentCity, saveState } = useBingoStore();
  const [activeTab, setActiveTab] = useState("manage");
  const [selectedCity, setSelectedCity] = useState(currentCity);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // New city form state
  const [newCity, setNewCity] = useState({
    id: "",
    title: "",
    subtitle: "",
    backgroundImage: "",
  });

  // For generating new items
  const [generatingFor, setGeneratingFor] = useState("");
  const [cityTheme, setCityTheme] = useState("");
  const [generatedItems, setGeneratedItems] = useState<BingoItem[]>([]);
  
  // Handler for generating bingo items descriptions
  const handleGenerateDescriptions = async (cityId: string) => {
    try {
      setIsLoading(true);
      toast({
        title: "Generating descriptions",
        description: "Please wait while we fetch interesting information about each location...",
        duration: 3000
      });

      const response = await apiRequest(
        "POST",
        "/api/generate-descriptions",
        { cityId }
      );

      const data = await response.json();
      toast({
        title: "Success!",
        description: data.message || "Descriptions generated successfully.",
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

  // Create a new city
  const handleCreateCity = async () => {
    if (!newCity.id || !newCity.title) {
      toast({
        title: "Missing information",
        description: "Please provide at least an ID and title for the city.",
        variant: "destructive",
      });
      return;
    }

    // Create a basic city structure
    const cityData: City = {
      id: newCity.id.toLowerCase(),
      title: newCity.title,
      subtitle: newCity.subtitle,
      backgroundImage: newCity.backgroundImage || "https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=1000&q=80",
      items: [],
      tips: []
    };

    // Add center space item
    cityData.items = [
      {
        id: `${cityData.id}-center`,
        text: `Arrive in ${cityData.title}`,
        completed: false,
        isCenterSpace: true
      }
    ];

    // Add the new city to the state
    const updatedCities = {
      ...cities,
      [cityData.id]: cityData
    };

    try {
      await saveState({
        currentCity,
        cities: updatedCities
      });
      
      toast({
        title: "City created",
        description: `${cityData.title} has been added successfully. Now generate bingo items for it.`,
      });
      
      // Reset form
      setNewCity({
        id: "",
        title: "",
        subtitle: "",
        backgroundImage: ""
      });
      
      // Switch to the generate tab and set the new city as selected
      setActiveTab("generate");
      setSelectedCity(cityData.id);
      setGeneratingFor(cityData.id);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create city. Please try again.",
        variant: "destructive",
      });
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

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
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
                <h3 className="text-xl font-bold">{city.title}</h3>
                <p className="text-sm text-gray-500 mb-2">{city.subtitle}</p>
                <p className="text-sm mb-4">Items: {city.items.length}</p>
                
                <div className="flex space-x-2">
                  <Button 
                    size="sm"
                    onClick={() => handleGenerateDescriptions(city.id)}
                    disabled={isLoading}
                  >
                    <BrainCircuit className="mr-2 h-4 w-4" />
                    Generate Descriptions
                  </Button>
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
                
                <div>
                  <label className="block text-sm font-medium mb-1">Background Image URL (Optional)</label>
                  <Input 
                    placeholder="https://example.com/image.jpg" 
                    value={newCity.backgroundImage}
                    onChange={(e) => setNewCity({...newCity, backgroundImage: e.target.value})}
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
    </div>
  );
}