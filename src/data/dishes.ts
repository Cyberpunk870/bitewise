// src/data/dishes.ts
export type DishVM = {
  id: string;
  name: string;
  tags?: string[];
};

export const DISHES: DishVM[] = [
  { id: 'paneer-butter-masala', name: 'Paneer Butter Masala', tags: ['paneer', 'north indian'] },
  { id: 'chicken-biryani', name: 'Chicken Biryani', tags: ['biryani'] },
  { id: 'veg-momos', name: 'Veg Momos', tags: ['momos', 'snacks'] },
  { id: 'masala-dosa', name: 'Masala Dosa', tags: ['south indian', 'dosa'] },
  { id: 'margherita-pizza', name: 'Margherita Pizza', tags: ['pizza'] },
  { id: 'chow-mein', name: 'Chow Mein', tags: ['noodles', 'chinese'] },
];