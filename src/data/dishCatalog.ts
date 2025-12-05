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
  price?: number;        // lightweight reference price
  rating?: number;       // crowd rating
  category?: string;     // key for category images
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
    slug: 'tandoori-paneer-craver-10cm',
    name: 'Tandoori Paneer Craver (10cm)',
    aliases: ['paneer craver', 'tandoori paneer sub'],
    cuisines: ['Sandwich'],
    tags: ['veg', 'popular'],
    imageUrl: 'https://b.zmtcdn.com/data/dish_photos/2e4/059a98240dd0ddcda48c6058ae42a2e4.jpeg?output-format=webp',
    price: 119,
    rating: 4.6,
    category: 'sandwich',
  },
  {
    id: 2,
    slug: 'classic-chicken-craver-10cm',
    name: 'Classic Chicken Craver (10cm)',
    aliases: ['chicken craver sub'],
    cuisines: ['Sandwich'],
    tags: ['non-veg'],
    imageUrl: 'https://b.zmtcdn.com/data/dish_photos/bbd/a4b954abfd92909bf48e4e3c558dcbbd.jpeg?output-format=webp',
    price: 119,
    rating: 4.6,
    category: 'sandwich',
  },
  {
    id: 3,
    slug: 'big-big-6in1-pizza-veg',
    name: 'Big Big 6in1 Pizza - Veg',
    aliases: ['6 in 1 pizza', 'veg big pizza'],
    cuisines: ['Pizza'],
    tags: ['veg', 'share'],
    imageUrl: 'https://b.zmtcdn.com/data/dish_photos/0cf/962d933875197eb9fc9310fe1a6420cf.jpeg?output-format=webp',
    price: 799,
    rating: 4.2,
    category: 'pizza',
  },
  {
    id: 4,
    slug: 'tandoori-loaded-veg-taco',
    name: 'Tandoori Loaded Veg Taco',
    aliases: ['veg taco'],
    cuisines: ['Snack'],
    tags: ['veg', 'value'],
    imageUrl: 'https://b.zmtcdn.com/data/dish_photos/6a1/21276fd379d5742183489e71b7e406a1.jpeg?output-format=webp',
    price: 169,
    rating: 4.2,
    category: 'taco',
  },
  {
    id: 5,
    slug: 'mcaloo-tikki-burger-combo',
    name: 'McAloo Tikki Burger Combo',
    aliases: ['mcaloo tikki', 'aloo tikki burger'],
    cuisines: ['Burger'],
    tags: ['veg', 'value', 'combo'],
    imageUrl: 'https://b.zmtcdn.com/data/dish_photos/ed9/b03a3ad7212fca0da40e90eed372ced9.png?output-format=webp',
    price: 95,
    rating: 4.1,
    category: 'burger',
  },
  {
    id: 6,
    slug: 'mcveggie-burger-combo',
    name: 'McVeggie Burger Combo',
    aliases: ['mcveggie'],
    cuisines: ['Burger'],
    tags: ['veg', 'combo'],
    imageUrl: 'https://b.zmtcdn.com/data/dish_photos/7f4/a35d06a5b87de3c3f6be263999a227f4.png?output-format=webp',
    price: 189,
    rating: 4.1,
    category: 'burger',
  },
  {
    id: 7,
    slug: 'aloo-patty-sandwich',
    name: 'Aloo Patty Sandwich',
    aliases: ['aloo patty sub'],
    cuisines: ['Sandwich'],
    tags: ['veg'],
    imageUrl: 'https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_264,h_288,c_fill/FOOD_CATALOG/IMAGES/CMS/2025/7/24/2ed02745-30a9-4589-a417-b78c0566ff39_c6f952ab-d21f-4434-b401-4571fb5b045c.jpg',
    price: 249,
    rating: 4.4,
    category: 'sandwich',
  },
  {
    id: 8,
    slug: 'farmhouse-cheese-burst',
    name: 'Farmhouse Cheese Burst',
    aliases: ['farmhouse pizza'],
    cuisines: ['Pizza'],
    tags: ['veg', 'popular'],
    imageUrl: 'https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_264,h_288,c_fill/FOOD_CATALOG/IMAGES/CMS/2025/7/22/3bf9271f-30b4-49ad-975b-d593c89ec049_3e0d37d9-cb4d-41b2-9e7d-55af5b187dcc.jpg',
    price: 348,
    rating: 4.5,
    category: 'pizza',
  },
  {
    id: 9,
    slug: 'margherita-pizza',
    name: 'Margherita Pizza',
    aliases: ['cheese pizza'],
    cuisines: ['Pizza'],
    tags: ['veg', 'value'],
    imageUrl: 'https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_264,h_288,c_fill/FOOD_CATALOG/IMAGES/CMS/2025/7/22/3dcc86f7-d1d9-4f31-a320-bf3cea8013ff_6cabc131-286e-41bf-ae5f-f2ffbdc72040.jpg',
    price: 239,
    rating: 4.5,
    category: 'pizza',
  },
  {
    id: 10,
    slug: 'new-mcsaver-mexican-mcaloo-tikki',
    name: 'New McSaver Mexican McAloo Tikki',
    aliases: ['mexican mcaloo tikki'],
    cuisines: ['Burger'],
    tags: ['veg', 'value'],
    imageUrl: 'https://b.zmtcdn.com/data/dish_photos/ed9/b03a3ad7212fca0da40e90eed372ced9.png?output-format=webp',
    price: 119,
    rating: 4.5,
    category: 'burger',
  },
  {
    id: 11,
    slug: 'new-mcsaver-chicken-surprise',
    name: 'New McSaver Chicken Surprise',
    aliases: ['chicken surprise burger'],
    cuisines: ['Burger'],
    tags: ['non-veg', 'value'],
    imageUrl: 'https://b.zmtcdn.com/data/dish_photos/bbd/a4b954abfd92909bf48e4e3c558dcbbd.jpeg?output-format=webp',
    price: 119,
    rating: 4.5,
    category: 'burger',
  },
  {
    id: 12,
    slug: 'tandoori-chicken-tikka-sandwich',
    name: 'Tandoori Chicken Tikka Sandwich',
    aliases: ['chicken tikka sub'],
    cuisines: ['Sandwich'],
    tags: ['non-veg'],
    imageUrl: 'https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_264,h_288,c_fill/FOOD_CATALOG/IMAGES/CMS/2025/7/24/fdb3d9b1-2262-4b18-9264-9bd00b3213ba_20858442-9b85-4728-b7b2-07d72349782e.png',
    price: 279,
    rating: 4.5,
    category: 'sandwich',
  },
];

export const allDishNames = DISH_CATALOG.map(d => d.name);
