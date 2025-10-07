// src/data/availability.ts

/** Platforms we support today */
export type PlatformKey = 'swiggy' | 'zomato';

/** Line items + fees used by the Compare screen */
export type PriceBreakdown = {
  platform: PlatformKey;
  etaMins: number;
  items: Array<{
    dishId: string;     // from your DISH_CATALOG (stringify if numeric)
    name: string;       // display name
    unitPrice: number;  // ₹ per unit (pre-fee, pre-tax)
    qty: number;        // quantity in the cart
  }>;
  fees: {
    packaging: number;
    delivery: number;
    platformFee: number;
    tax: number;        // total GST etc.
  };
  /** Optional promo (dummy now; swap with Actowiz feed later) */
  promo?: { label: string; savings: number } | null; // positive = discount in ₹
  /** Deep link to open partner app/website for this cart */
  deepLink: string;
};

/** Your restaurant shape used on the Availability screen */
export type RestaurantAvailability = {
  id: string;
  name: string;
  distanceKm: number;
  rating: number;
  /** helpers already used by your UI */
  priceRange: string;           // e.g. '₹₹'
  heroImage?: string;           // card hero (we rotate dish images in UI)
  dishName?: string;            // primary dish shown on card (optional)

  /** quick summary per platform shown on Availability list */
  swiggy: { available: boolean; price?: number; etaMins?: number };
  zomato: { available: boolean; price?: number; etaMins?: number };

  /** detailed breakdowns used by the Compare screen */
  priceBreakdown: PriceBreakdown[];
};

/* ------------------------------------------------------------------ */
/* Dummy data to unblock UI; swap with Actowiz later (keep same shape) */
/* ------------------------------------------------------------------ */

export const AVAILABILITY_DUMMY: RestaurantAvailability[] = [
  {
    id: 'r1',
    name: 'Curry Leaf',
    distanceKm: 2.2,
    rating: 4.5,
    priceRange: '₹₹',
    heroImage: '/img/dishes/chicken-biryani.jpg',
    dishName: 'Chicken Biryani',
    swiggy: { available: true, price: 190, etaMins: 22 },
    zomato: { available: false },
    priceBreakdown: [
      {
        platform: 'swiggy',
        etaMins: 22,
        items: [
          { dishId: 'd-biryani', name: 'Chicken Biryani', unitPrice: 190, qty: 1 },
        ],
        fees: { packaging: 10, delivery: 28, platformFee: 6, tax: 22 },
        promo: { label: 'Flat ₹20 OFF', savings: 20 },
        deepLink: 'https://www.swiggy.com/',
      },
    ],
  },

  {
    id: 'r2',
    name: 'Bombay Spice Kitchen',
    distanceKm: 1.8,
    rating: 4.3,
    priceRange: '₹₹',
    heroImage: '/img/dishes/paneer-butter-masala.jpg',
    dishName: 'Paneer Butter Masala',
    swiggy: { available: true, price: 270, etaMins: 28 },
    zomato: { available: true, price: 235, etaMins: 31 },
    priceBreakdown: [
      {
        platform: 'swiggy',
        etaMins: 28,
        items: [
          { dishId: 'd-pbm', name: 'Paneer Butter Masala', unitPrice: 270, qty: 1 },
          // Example second selection in cart:
          { dishId: 'd-momos', name: 'Veg Momos', unitPrice: 120, qty: 1 },
        ],
        fees: { packaging: 12, delivery: 30, platformFee: 6, tax: 25 },
        promo: { label: 'Upto 40% OFF applied', savings: 60 },
        deepLink: 'https://www.swiggy.com/',
      },
      {
        platform: 'zomato',
        etaMins: 31,
        items: [
          { dishId: 'd-pbm', name: 'Paneer Butter Masala', unitPrice: 235, qty: 1 },
          { dishId: 'd-momos', name: 'Veg Momos', unitPrice: 115, qty: 1 },
        ],
        fees: { packaging: 10, delivery: 28, platformFee: 6, tax: 23 },
        promo: { label: 'Upto 50% OFF applied', savings: 70 },
        deepLink: 'https://www.zomato.com/',
      },
    ],
  },

  {
    id: 'r3',
    name: 'Urban Thali',
    distanceKm: 2.1,
    rating: 4.0,
    priceRange: '₹₹',
    heroImage: '/img/dishes/veg-thali.jpg',
    dishName: 'Veg Thali',
    swiggy: { available: true, price: 280, etaMins: 20 },
    zomato: { available: true, price: 265, etaMins: 19 },
    priceBreakdown: [
      {
        platform: 'swiggy',
        etaMins: 20,
        items: [{ dishId: 'd-thali', name: 'Veg Thali', unitPrice: 280, qty: 1 }],
        fees: { packaging: 12, delivery: 26, platformFee: 6, tax: 24 },
        promo: { label: 'Buy 1 Get 1 (select)', savings: 0 },
        deepLink: 'https://www.swiggy.com/',
      },
      {
        platform: 'zomato',
        etaMins: 19,
        items: [{ dishId: 'd-thali', name: 'Veg Thali', unitPrice: 265, qty: 1 }],
        fees: { packaging: 10, delivery: 24, platformFee: 6, tax: 22 },
        promo: { label: 'Flat ₹30 OFF', savings: 30 },
        deepLink: 'https://www.zomato.com/',
      },
    ],
  },

  {
    id: 'r4',
    name: 'Tandoori Corner',
    distanceKm: 3.4,
    rating: 4.1,
    priceRange: '₹₹₹',
    heroImage: '/img/dishes/chicken-biryani.jpg',
    dishName: 'Chicken Biryani',
    swiggy: { available: true, price: 309, etaMins: 24 },
    zomato: { available: false },
    priceBreakdown: [
      {
        platform: 'swiggy',
        etaMins: 24,
        items: [{ dishId: 'd-biryani', name: 'Chicken Biryani', unitPrice: 309, qty: 1 }],
        fees: { packaging: 14, delivery: 32, platformFee: 6, tax: 28 },
        deepLink: 'https://www.swiggy.com/',
      },
    ],
  },

  {
    id: 'r5',
    name: 'Pasta Palace',
    distanceKm: 1.6,
    rating: 3.9,
    priceRange: '₹₹',
    heroImage: '/img/dishes/veg-momos.jpg',
    dishName: 'Veg Momos',
    swiggy: { available: false },
    zomato: { available: true, price: 125, etaMins: 18 },
    priceBreakdown: [
      {
        platform: 'zomato',
        etaMins: 18,
        items: [{ dishId: 'd-momos', name: 'Veg Momos', unitPrice: 125, qty: 1 }],
        fees: { packaging: 8, delivery: 20, platformFee: 6, tax: 18 },
        promo: { label: 'Free Delivery (Gold)', savings: 20 },
        deepLink: 'https://www.zomato.com/',
      },
    ],
  },
];
