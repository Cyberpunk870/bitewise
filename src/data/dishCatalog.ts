// src/data/dishCatalog.ts

// Minimal type the app can grow with
export type DishRecord = {
  id: number;
  slug: string;          // kebab-case canonical id
  name: string;          // display name
  aliases?: string[];    // common variations users may type
  cuisines?: string[];   // optional metadata
  tags?: string[];       // optional metadata
  imageUrl?: string;     // public/img/dishes/*.jpg
};

// --- helpers ---------------------------------------------------------------

export function slugifyDish(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')   // spaces & punctuation -> hyphens
    .replace(/^-+|-+$/g, '');      // trim hyphens
}

/**
 * Resolve an image URL for any user-facing dish name.
 * - Tries direct slug match
 * - Falls back to alias match
 */
export function imageForDishName(name: string): string | undefined {
  const s = slugifyDish(name);
  const direct = DISH_CATALOG.find(d => d.slug === s);
  if (direct?.imageUrl) return direct.imageUrl;

  const viaAlias = DISH_CATALOG.find(d =>
    (d.aliases || []).some(a => slugifyDish(a) === s)
  );
  return viaAlias?.imageUrl;
}

// --- catalog ---------------------------------------------------------------
// Make sure these filenames exist under: public/img/dishes/

export const DISH_CATALOG: DishRecord[] = [
  {
    id: 1,
    slug: 'masala-dosa',
    name: 'Masala Dosa',
    aliases: ['dosa', 'plain dosa', 'msl dosa'],
    cuisines: ['South Indian'],
    tags: ['veg', 'popular', 'value'],
    imageUrl: '/img/dishes/masala-dosa.jpg',
  },
  {
    id: 2,
    slug: 'paneer-butter-masala',
    name: 'Paneer Butter Masala',
    aliases: ['pbm', 'paneer makhani', 'butter paneer'],
    cuisines: ['North Indian'],
    tags: ['veg', 'popular'],
    imageUrl: '/img/dishes/paneer-butter-masala.jpg',
  },
  {
    id: 3,
    slug: 'chicken-biryani',
    name: 'Chicken Biryani',
    aliases: ['biryani', 'chicken biriyani'],
    cuisines: ['Hyderabadi', 'Mughlai'],
    tags: ['non-veg', 'popular'],
    imageUrl: '/img/dishes/chicken-biryani.jpg',
  },
  {
    id: 4,
    slug: 'margherita-pizza',
    name: 'Margherita Pizza',
    aliases: ['margarita pizza', 'cheese pizza', 'plain pizza'],
    cuisines: ['Italian', 'Pizza'],
    tags: ['veg'],
    imageUrl: '/img/dishes/margherita-pizza.jpg',
  },
  {
    id: 5,
    slug: 'momos',
    name: 'Veg Momos',
    aliases: ['momo', 'veg momos', 'dumpling', 'dumplings'],
    cuisines: ['Tibetan', 'Nepalese', 'Street Food'],
    tags: ['veg', 'snack'],
    imageUrl: '/img/dishes/momos.jpg',
  },
  {
    id: 6,
    slug: 'chowmein',
    name: 'Chow Mein',
    aliases: ['chowmein', 'hakka noodles', 'noodles'],
    cuisines: ['Chinese', 'Indo-Chinese'],
    tags: ['veg', 'popular'],
    imageUrl: '/img/dishes/chowmein.jpg',
  },
];

export const allDishNames = DISH_CATALOG.map(d => d.name);
