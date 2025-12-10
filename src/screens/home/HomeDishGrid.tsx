// src/screens/home/HomeDishGrid.tsx
import React from 'react';
import type { FilterState, TabKey } from './types';

type Props = {
  activeTab: TabKey;
  query: string;
  filters: FilterState;
  locationKey: string;
  itemsMap: Record<string, any>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (input: { id: string; name: string }) => void;
  onDec: (id: string) => void;
};

// TEMP: ultra-simple test grid
export default function HomeDishGrid(_props: Props) {
  return (
    <section
      id="home-dish-grid"
      className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 px-4 pb-6 items-stretch"
    >
      <div className="h-32 rounded-3xl bg-emerald-500 flex items-center justify-center text-sm font-semibold">
        Test card 1
      </div>
      <div className="h-32 rounded-3xl bg-sky-500 flex items-center justify-center text-sm font-semibold">
        Test card 2
      </div>
      <div className="h-32 rounded-3xl bg-pink-500 flex items-center justify-center text-sm font-semibold">
        Test card 3
      </div>
      <div className="h-32 rounded-3xl bg-orange-500 flex items-center justify-center text-sm font-semibold">
        Test card 4
      </div>
      <div className="h-32 rounded-3xl bg-indigo-500 flex items-center justify-center text-sm font-semibold">
        Test card 5
      </div>
      <div className="h-32 rounded-3xl bg-amber-500 flex items-center justify-center text-sm font-semibold">
        Test card 6
      </div>
    </section>
  );
}
