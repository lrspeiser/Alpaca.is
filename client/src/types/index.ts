export interface BingoItem {
  id: string;
  text: string;
  completed: boolean;
  isCenterSpace?: boolean;
  image?: string;
  description?: string;
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
  backgroundImage: string;
  items: BingoItem[];
  tips: CityTip[];
}

export interface BingoState {
  currentCity: string;
  cities: Record<string, City>;
}
