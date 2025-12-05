export type TabKey = 'all' | 'popular' | 'frequent' | 'value';

export type FilterState = {
  priceMax?: number;
  ratingMin?: number;
  distanceMax?: number;
} | null;
