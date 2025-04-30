import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ImageIcon, ArrowLeft, RefreshCw } from "lucide-react";
import { Link } from "wouter";

// Types for our admin data
interface AdminItem {
  id: string;
  text: string;
  description: string | null;
  image: string | null;
  isCenterSpace: boolean | null;
  gridRow: number | null;
  gridCol: number | null;
}

interface AdminCity {
  id: string;
  title: string;
  subtitle: string | null;
  itemCount: number;
  itemsWithDescriptions: number;
  itemsWithImages: number;
  itemsWithValidImageFiles: number;
  completedItemsCount: number;
  lastMetadataUpdate: string | null;
  items: AdminItem[];
}

interface AdminData {
  success: boolean;
  cities: AdminCity[];
}

export default function AdminSimple() {
  const [isLoading, setIsLoading] = useState(true);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [activeTab, setActiveTab] = useState("manage");
  const [viewingCity, setViewingCity] = useState<string | null>(null);
  const [generatingImages, setGeneratingImages] = useState<{[key: string]: boolean}>({});
  const [generatingDescriptions, setGeneratingDescriptions] = useState<{[key: string]: boolean}>({});
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);
  const { toast } = useToast();
  
  // New city form state - simplified to just ID and name
  const [newCity, setNewCity] = useState({
    id: "",
    cityName: "",
  });
  
  // Fetch admin data
  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin-data');
      const data = await response.json();
      setAdminData(data);
    } catch (error) {
      console.error('[ADMIN] Failed to fetch admin data:', error);
      toast({
        title: "Error",
        description: "Failed to load admin data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load admin data on component mount
  useEffect(() => {
    fetchAdminData();
  }, []);
  
  // Handle refreshing metadata
  const handleRefreshMetadata = async (cityId?: string) => {
    try {
      setIsLoading(true);
      
      // If a cityId is provided, only refresh that city, otherwise refresh all cities
      const payload = cityId ? { cityId } : {};
      
      const response = await apiRequest(
        "POST",
        "/api/update-city-metadata",
        payload
      );
      
      await fetchAdminData();
      
      toast({
        title: "Metadata Updated",
        description: cityId 
          ? `Metadata for ${cityId} has been updated successfully.`
          : "Metadata for all cities has been refreshed successfully.",
      });
    } catch (error) {
      console.error('[ADMIN] Error updating metadata:', error);
      toast({
        title: "Error",
        description: "Failed to update metadata. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle generating descriptions for a city
  const handleGenerateDescriptions = async (cityId: string) => {
    try {
      setGeneratingDescriptions({ ...generatingDescriptions, [cityId]: true });
      toast({
        title: "Generating Descriptions",
        description: "Please wait while we generate descriptions...",
        duration: 5000
      });
      
      const response = await apiRequest(
        "POST",
        "/api/generate-descriptions",
        { cityId }
      );
      
      await fetchAdminData();
      
      toast({
        title: "Descriptions Generated",
        description: "Successfully generated descriptions for this city.",
      });
    } catch (error) {
      console.error('[ADMIN] Error generating descriptions:', error);
      toast({
        title: "Error",
        description: "Failed to generate descriptions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingDescriptions({ ...generatingDescriptions, [cityId]: false });
    }
  };
  
  // Handle generating a single image with UI updates (used from detail view)
  const handleGenerateImage = async (cityId: string, itemId: string, itemText: string) => {
    try {
      setProcessingItemId(itemId);
      toast({
        title: "Generating Image",
        description: "Please wait while we create an image...",
        duration: 10000
      });
      
      const response = await apiRequest(
        "POST",
        "/api/generate-image",
        { 
          cityId, 
          itemId,
          itemText,
          forceNewImage: true 
        }
      );
      
      await fetchAdminData();
      
      toast({
        title: "Image Generated",
        description: "Successfully generated image for this item.",
      });
    } catch (error) {
      console.error('[ADMIN] Error generating image:', error);
      toast({
        title: "Error",
        description: "Failed to generate image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingItemId(null);
    }
  };
  
  // Handle generating a single image in batch mode (no UI updates for each item)
  const handleGenerateImageBatch = async (cityId: string, itemId: string, itemText: string) => {
    try {
      console.log(`[ADMIN-BATCH] Starting generation for item ${itemId}: "${itemText}"`);
      
      const response = await apiRequest(
        "POST",
        "/api/generate-image",
        { 
          cityId, 
          itemId,
          itemText,
          forceNewImage: true 
        }
      );
      
      console.log(`[ADMIN-BATCH] Successfully generated image for item ${itemId}`);
      return true;
    } catch (error) {
      console.error(`[ADMIN-BATCH] Error generating image for item ${itemId}:`, error);
      return false;
    }
  };
  
  // Handle generating all images for a city
  const handleGenerateAllImages = async (cityId: string) => {
    try {
      setGeneratingImages({ ...generatingImages, [cityId]: true });
      const city = adminData?.cities.find(c => c.id === cityId);
      
      if (!city) {
        throw new Error(`City ${cityId} not found`);
      }
      
      toast({
        title: "Starting Image Regeneration",
        description: `Regenerating ALL images for ${city.title} with style guides. This will take a while.`,
        duration: 5000
      });
      
      // Process ALL items, regardless of whether they already have images
      const allItems = city.items;
      
      if (allItems.length === 0) {
        toast({
          title: "No Items Found",
          description: "No bingo items found for this city.",
        });
        setGeneratingImages({ ...generatingImages, [cityId]: false });
        return;
      }
      
      // Generate all images SIMULTANEOUSLY - send all 25 requests at once
      console.log(`[ADMIN-BATCH] Sending ALL ${allItems.length} image requests simultaneously for ${city.title}`);
      
      const generationPromises = allItems.map(item => {
        return handleGenerateImageBatch(cityId, item.id, item.text);
      });
      
      // Wait for all generation promises to complete
      const results = await Promise.all(generationPromises);
      
      // Count successes and failures
      const successCount = results.filter(result => result).length;
      const failureCount = allItems.length - successCount;
      
      console.log(`[ADMIN-BATCH] All ${allItems.length} image requests completed! Success: ${successCount}, Failed: ${failureCount}`);
      
      // Update the UI with the latest data
      await fetchAdminData();
      
      toast({
        title: "Image Regeneration Complete",
        description: `Regenerated ${successCount} images for ${city.title} with style guides. ${failureCount > 0 ? `Failed: ${failureCount}` : ''}`,
      });
    } catch (error) {
      console.error('[ADMIN] Error generating all images:', error);
      toast({
        title: "Error",
        description: "Failed to generate all images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingImages({ ...generatingImages, [cityId]: false });
    }
  };
  
  // Handle repairing missing images
  const handleRepairMissingImages = async (cityId: string) => {
    try {
      toast({
        title: "Repairing Missing Images",
        description: "Attempting to repair missing image files...",
        duration: 5000
      });
      
      const response = await apiRequest(
        "POST",
        "/api/repair-missing-images",
        { cityId }
      );
      
      await fetchAdminData();
      
      toast({
        title: "Repair Complete",
        description: "Image repair process complete.",
      });
    } catch (error) {
      console.error('[ADMIN] Error repairing images:', error);
      toast({
        title: "Error",
        description: "Failed to repair images. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Handle creating a new city
  const handleCreateCity = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCity.id || !newCity.cityName) {
      toast({
        title: "Validation Error",
        description: "Both city ID and name are required.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      const response = await apiRequest(
        "POST",
        "/api/create-city",
        {
          id: newCity.id,
          name: newCity.cityName,
        }
      );
      
      await fetchAdminData();
      
      toast({
        title: "City Created",
        description: `Successfully created city: ${newCity.cityName}`,
      });
      
      // Reset form
      setNewCity({ id: "", cityName: "" });
      
      // Switch to manage tab
      setActiveTab("manage");
    } catch (error) {
      console.error('[ADMIN] Error creating city:', error);
      toast({
        title: "Error",
        description: "Failed to create city. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render city details view
  const renderCityDetails = () => {
    if (!adminData) return null;
    
    const city = adminData.cities.find(c => c.id === viewingCity);
    if (!city) return null;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setViewingCity(null)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cities
          </Button>
          <h2 className="text-2xl font-bold">{city.title}</h2>
          {city.subtitle && <span className="text-gray-500">({city.subtitle})</span>}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {city.items.map(item => (
            <Card key={item.id} className="p-4 flex flex-col h-full">
              <div className="mb-2 flex-grow">
                <h3 className="font-bold text-sm">{item.text}</h3>
                {item.isCenterSpace && <span className="text-xs text-blue-500">Center Space</span>}
                {item.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-3">{item.description}</p>
                )}
              </div>
              
              {item.image ? (
                <div className="aspect-square bg-gray-100 rounded-md overflow-hidden relative">
                  <img 
                    src={item.image} 
                    alt={item.text} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder-image.svg";
                    }}
                  />
                </div>
              ) : (
                <div className="aspect-square bg-gray-100 rounded-md flex items-center justify-center">
                  <span className="text-gray-400 text-xs">No image</span>
                </div>
              )}
              
              <div className="mt-2 space-y-2">
                {!item.description && (
                  <Button 
                    size="sm" 
                    className="w-full"
                    variant="outline"
                    onClick={() => handleGenerateItemDescription(city.id, item.id)}
                    disabled={processingItemId === item.id}
                  >
                    Generate Description
                  </Button>
                )}
                
                <Button 
                  size="sm" 
                  className="w-full"
                  variant="outline"
                  onClick={() => handleGenerateImage(city.id, item.id, item.text)}
                  disabled={processingItemId === item.id}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  {processingItemId === item.id ? 'Generating...' : 'Generate Image'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };
  
  // Handle generating a description for a single item
  const handleGenerateItemDescription = async (cityId: string, itemId: string) => {
    try {
      setProcessingItemId(itemId);
      toast({
        title: "Generating Description",
        description: "Please wait while we create a description...",
        duration: 5000
      });
      
      const response = await apiRequest(
        "POST",
        "/api/generate-description",
        { cityId, itemId }
      );
      
      await fetchAdminData();
      
      toast({
        title: "Description Generated",
        description: "Successfully generated description for this item.",
      });
    } catch (error) {
      console.error('[ADMIN] Error generating description:', error);
      toast({
        title: "Error",
        description: "Failed to generate description. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingItemId(null);
    }
  };
  
  // Loading state
  if (isLoading && !adminData) {
    return (
      <div className="container mx-auto py-8 flex justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-64 bg-gray-200 rounded mb-4"></div>
          <div className="h-48 w-full max-w-3xl bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl bg-white">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Travel Bingo Admin</h1>
        <div className="flex gap-2">
          <Button onClick={handleRefreshMetadata} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Metadata
          </Button>
          <Link href="/">
            <Button variant="outline">Return to Bingo</Button>
          </Link>
        </div>
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
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="py-3 px-4 text-left font-semibold">City</th>
                    <th className="py-3 px-4 text-center font-semibold">Items</th>
                    <th className="py-3 px-4 text-center font-semibold">Descriptions</th>
                    <th className="py-3 px-4 text-center font-semibold">Images</th>
                    <th className="py-3 px-4 text-left font-semibold">Last Updated</th>
                    <th className="py-3 px-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminData?.cities.map((city) => (
                    <tr key={city.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-semibold">{city.title}</p>
                          {city.subtitle && <p className="text-xs text-gray-500">{city.subtitle}</p>}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">{city.itemCount}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={city.itemsWithDescriptions < city.itemCount ? "text-amber-600" : "text-green-600"}>
                          {city.itemsWithDescriptions}/{city.itemCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={city.itemsWithImages < city.itemCount ? "text-amber-600" : "text-green-600"}>
                          {city.itemsWithImages}/{city.itemCount}
                        </span>
                        {city.itemsWithValidImageFiles !== undefined && 
                          city.itemsWithValidImageFiles !== city.itemsWithImages && (
                            <p className="text-xs text-red-600 font-medium">
                              {city.itemsWithValidImageFiles}/{city.itemsWithImages} files found
                            </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600">
                        {city.lastMetadataUpdate ? 
                          new Date(city.lastMetadataUpdate).toLocaleString() : 
                          'Not updated'
                        }
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => setViewingCity(city.id)}
                            variant="outline"
                            size="sm"
                          >
                            View
                          </Button>
                          <Button
                            disabled={generatingDescriptions[city.id]}
                            onClick={() => handleGenerateDescriptions(city.id)}
                            variant="outline"
                            size="sm"
                          >
                            {generatingDescriptions[city.id] ? 'Generating...' : 'Gen Descriptions'}
                          </Button>
                          <Button
                            disabled={generatingImages[city.id]}
                            onClick={() => handleGenerateAllImages(city.id)}
                            variant="outline"
                            size="sm"
                          >
                            <ImageIcon className="h-3 w-3 mr-1" />
                            {generatingImages[city.id] ? 'Regenerating...' : `Regen ALL Images`}
                          </Button>
                          {city.itemsWithValidImageFiles !== undefined && 
                            city.itemsWithValidImageFiles !== city.itemsWithImages && (
                              <Button
                                onClick={() => handleRepairMissingImages(city.id)}
                                variant="destructive"
                                size="sm"
                              >
                                Repair Images
                              </Button>
                          )}
                          
                          <Button
                            onClick={() => handleRefreshMetadata(city.id)}
                            variant="outline"
                            size="sm"
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Update Metadata
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
        
        {/* ===== CREATE CITY TAB ===== */}
        <TabsContent value="create">
          <div className="max-w-md mx-auto">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Create New City</h2>
              <form onSubmit={handleCreateCity} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="cityId" className="text-sm font-medium">
                    City ID
                  </label>
                  <Input
                    id="cityId"
                    placeholder="e.g. paris"
                    value={newCity.id}
                    onChange={(e) => setNewCity({ ...newCity, id: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Use lowercase letters with no spaces or special characters
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="cityName" className="text-sm font-medium">
                    City Name
                  </label>
                  <Input
                    id="cityName"
                    placeholder="e.g. Paris Bingo"
                    value={newCity.cityName}
                    onChange={(e) => setNewCity({ ...newCity, cityName: e.target.value })}
                    required
                  />
                </div>
                
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? "Creating..." : "Create City"}
                </Button>
              </form>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}