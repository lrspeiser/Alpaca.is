export interface BingoItem {
  id: string;
  text: string;
  completed: boolean;
  isFreeSpace?: boolean;
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
