// src/data/categoryImages.ts

export const CATEGORY_IMAGES: Record<string, string> = {
  pizza: '/img/categories/pizza.avif',
  burger: '/img/categories/burger.avif',
  sandwich: '/img/categories/sandwich.avif',
  taco: '/img/categories/taco.avif',
  biryani: '/img/categories/biryani.avif',
  default: '/img/placeholder-dish.jpg',
};

/** Very lightweight classifier from dish name -> category key */
export function inferCategory(name?: string): string {
  const n = (name || '').toLowerCase();
  if (/pizza|margherita|cheese burst/.test(n)) return 'pizza';
  if (/burger|tikki|mc/.test(n)) return 'burger';
  if (/sub|sandwich|craver/.test(n)) return 'sandwich';
  if (/taco/.test(n)) return 'taco';
  if (/biryani/.test(n)) return 'biryani';
  return 'default';
}
