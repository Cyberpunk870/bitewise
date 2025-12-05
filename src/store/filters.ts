// src/store/filters.ts
import { create } from 'zustand';

type FiltersState = {
  topRated: boolean;
  nearby: boolean;
  frequent: boolean;
  toggle: (k: 'topRated' | 'nearby' | 'frequent') => void;
};

export const useFilters = create<FiltersState>((set) => ({
  topRated: false,
  nearby: false,
  frequent: false,
  toggle: (k) => set((s) => ({ ...s, [k]: !s[k] })),
}));
