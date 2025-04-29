export interface BingoItem {
  id: string;
  text: string;
  completed: boolean;
  isCenterSpace?: boolean;
  image?: string;
  userPhoto?: string; // URL to user-captured photo
  description?: string;
  cityId: string; // Reference to the city this item belongs to
  gridRow?: number; // 0-based row index (0-4)
  gridCol?: number; // 0-based column index (0-4)
}

export interface CityTip {
  title: string;
  text: string;
}

export interface City {
  id: string;
  title: string;
  subtitle?: string;
  items: BingoItem[];
  tips: CityTip[];
  // Metadata fields from database
  itemCount?: number;
  itemsWithDescriptions?: number;
  itemsWithImages?: number;
  itemsWithValidImageFiles?: number;
  itemsWithDescriptionsIds?: string[];
  lastMetadataUpdate?: string;
}

export interface BingoState {
  currentCity: string;
  cities: Record<string, City>;
}
