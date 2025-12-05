// src/data/availability.ts

/** Platforms we support today */
export type PlatformKey = 'swiggy' | 'zomato';

/** Line items + fees used by the Compare screen */
export type PriceBreakdown = {
  platform: PlatformKey;
  etaMins: number;
  items: Array<{
    dishId: string;
    name: string;
    unitPrice: number;
    qty: number;
  }>;
  fees: {
    packaging: number;
    delivery: number;
    platformFee: number;
    tax: number;
  };
  /** Optional promo (e.g., bank/UPI) with savings in currency */
  promo?: { label: string; savings: number } | null;
  /** Surge multiplier if present (1 = none) */
  surgeMultiplier?: number;
  /** Total computed from items + fees - promo, after surge if set */
  total: number;
  /** When this snapshot was computed */
  updatedAt: number;
  /** Confidence rating based on validation/freshness */
  confidence?: 'high' | 'medium' | 'low';
  deepLink: string;
};

/** Your restaurant shape used on the Availability screen */
export type RestaurantAvailability = {
  id: string;
  name: string;
  city?: string;
  distanceKm: number;
  rating: number;
  priceRange: string;
  heroImage?: string;
  dishName?: string;
  dishes?: string[];
  updatedAt?: number;
  priceConfidence?: 'high' | 'medium' | 'low';
  swiggy: { available: boolean; price?: number; etaMins?: number };
  zomato: { available: boolean; price?: number; etaMins?: number };
  priceBreakdown: PriceBreakdown[];
};

/* ------------------------------------------------------------------ */
/* Actowiz snapshots (simplified from provided JSON)                  */
/* ------------------------------------------------------------------ */

type RawSnapshot = {
  platform: PlatformKey;
  restaurant: {
    restaurant_id: string;
    restaurant_name: string;
    delivery_sla?: string;
    city?: string;
    rating?: number | string;
  };
  items: Array<{ menu_id: string | number; name: string; price: number | string; mrp?: number | string }>;
  fees: { restaurant_packaging_charges?: number; delivery_fee?: number; platform_fee?: number; tax?: number; total_price?: number };
  updatedAt?: number;
};

const ZOMATO_SNAPSHOTS: RawSnapshot[] = [
  {
    platform: 'zomato',
    restaurant: { restaurant_id: '110389', restaurant_name: 'Subway', delivery_sla: '15–20', city: 'Ahmedabad', rating: 4.6 },
    items: [
      { menu_id: 'ctl_749022911', name: 'Tandoori Paneer Craver (10cm)', price: 119 },
      { menu_id: 'ctl_749022913', name: 'Classic Chicken Craver (10cm)', price: 119 },
      { menu_id: 'ctl_749022914', name: 'Aloo Patty Sandwich', price: 249 },
    ],
    fees: { restaurant_packaging_charges: 25, delivery_fee: 0, platform_fee: 12, tax: 21, total_price: 416 },
  },
  {
    platform: 'zomato',
    restaurant: { restaurant_id: '110120', restaurant_name: "Domino's Pizza", delivery_sla: '25–30', city: 'Ahmedabad', rating: 4.2 },
    items: [
      { menu_id: 'ctl_745710243', name: 'Big Big 6in1 Pizza - Veg', price: 799 },
      { menu_id: 'ctl_749550009', name: 'Tandoori Loaded Veg Taco', price: 169 },
    ],
    fees: { restaurant_packaging_charges: 25, delivery_fee: 0, platform_fee: 12, tax: 52, total_price: 1057 },
  },
  {
    platform: 'zomato',
    restaurant: { restaurant_id: '110478', restaurant_name: "McDonald's", delivery_sla: '30–35', city: 'Ahmedabad', rating: 4.1 },
    items: [
      { menu_id: 'ctl_682780259', name: 'McAloo Tikki Burger Combo', price: 95 },
      { menu_id: 'ctl_682780457', name: 'McVeggie Burger Combo', price: 189 },
    ],
    fees: { restaurant_packaging_charges: 38, delivery_fee: 0, platform_fee: 12, tax: 18, total_price: 353 },
  },
];

const SWIGGY_SNAPSHOTS: RawSnapshot[] = [
  {
    platform: 'swiggy',
    restaurant: { restaurant_id: '40828', restaurant_name: 'Subway', delivery_sla: '15-20', city: 'Ahmedabad', rating: 4.4 },
    items: [{ menu_id: 107467844, name: 'Aloo Patty Sandwich', price: 249 }],
    fees: { delivery_fee: 0, tax: 79, platform_fee: 14, restaurant_packaging_charges: 0, total_price: 342 },
  },
  {
    platform: 'swiggy',
    restaurant: { restaurant_id: '1110549', restaurant_name: "Domino's Pizza", delivery_sla: '20-25', city: 'Surat', rating: 4.5 },
    items: [
      { menu_id: 173322930, name: 'Farmhouse Cheese Burst', price: 348 },
      { menu_id: 173322985, name: 'Margherita Pizza', price: 239 },
    ],
    fees: { delivery_fee: 0, tax: 91, platform_fee: 14, restaurant_packaging_charges: 0, total_price: 1112 },
  },
  {
    platform: 'swiggy',
    restaurant: { restaurant_id: '66597', restaurant_name: "McDonald's", delivery_sla: '30-35', city: 'Surat', rating: 4.5 },
    items: [
      { menu_id: 148499674, name: 'New McSaver Mexican McAloo Tikki', price: 119 },
      { menu_id: 143869660, name: 'New McSaver Chicken Surprise', price: 119 },
    ],
    fees: { delivery_fee: 0, tax: 72, platform_fee: 14, restaurant_packaging_charges: 0, total_price: 443 },
  },
];

function parseEta(sla?: string): number {
  if (!sla) return 25;
  const match = sla.match(/\d+/);
  return match ? Number(match[0]) : 25;
}

function normalizeSnapshots(snaps: RawSnapshot[]): RestaurantAvailability[] {
  return snaps.map((snap, idx) => {
    const r = snap.restaurant;
    const platform = snap.platform;
    const eta = parseEta(r.delivery_sla);
    const now = snap.updatedAt ?? Date.now();
    const items = snap.items.slice(0, 3).map((it) => ({
      dishId: `${platform}-${it.menu_id}`,
      name: it.name,
      unitPrice: Math.max(0, Number(it.price ?? it.mrp ?? 0)),
      qty: 1,
    }));
    const fees = {
      packaging: Math.max(0, Number(snap.fees.restaurant_packaging_charges || 0)),
      delivery: Math.max(0, Number(snap.fees.delivery_fee || 0)),
      platformFee: Math.max(0, Number(snap.fees.platform_fee || 0)),
      tax: Math.max(0, Number(snap.fees.tax || 0)),
    };
    const surgeMultiplier = 1;
    const subtotal = items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
    const totalFees = fees.packaging + fees.delivery + fees.platformFee + fees.tax;
    // Simple promo picker: 10% off up to ₹50 if subtotal >= 200
    const promo =
      subtotal >= 200
        ? { label: 'Auto-applied promo (10% up to ₹50)', savings: Math.min(50, subtotal * 0.1) }
        : null;
    const promoSavings = promo?.savings ?? 0;
    const computedTotal = Math.max(0, (subtotal + totalFees - promoSavings) * surgeMultiplier);
    const totalPrice = Number(snap.fees.total_price || computedTotal);
    const confidence: 'high' | 'medium' | 'low' = subtotal > 0 ? 'high' : 'low';
    const deepLink = platform === 'swiggy' ? 'https://www.swiggy.com/' : 'https://www.zomato.com/';

    const availability: RestaurantAvailability = {
      id: `${platform}-${r.restaurant_id}`,
      name: r.restaurant_name,
      city: r.city,
      distanceKm: 1.2 + idx * 0.8,
      rating: Number(r.rating || 0),
      priceRange: '₹₹',
      heroImage: undefined,
      dishName: items[0]?.name,
      dishes: items.map((it) => it.name),
      updatedAt: now,
      priceConfidence: confidence,
      swiggy: platform === 'swiggy' ? { available: true, price: totalPrice, etaMins: eta } : { available: false },
      zomato: platform === 'zomato' ? { available: true, price: totalPrice, etaMins: eta } : { available: false },
      priceBreakdown: [
        {
          platform,
          etaMins: eta,
          items,
          fees,
          promo,
          surgeMultiplier,
          total: totalPrice,
          updatedAt: now,
          confidence,
          deepLink,
        },
      ],
    };
    return availability;
  });
}

export const AVAILABILITY_DUMMY: RestaurantAvailability[] = [
  ...normalizeSnapshots(SWIGGY_SNAPSHOTS),
  ...normalizeSnapshots(ZOMATO_SNAPSHOTS),
];

/* --------------------------- partition helpers --------------------------- */
function cityKey(city?: string) {
  return (city || 'unknown').toLowerCase().trim();
}

export function buildAvailabilityPartitions(list: RestaurantAvailability[]) {
  const byCity = new Map<string, RestaurantAvailability[]>();
  for (const r of list) {
    const key = cityKey(r.city);
    if (!byCity.has(key)) byCity.set(key, []);
    byCity.get(key)!.push(r);
  }
  return { byCity, all: list };
}

/** Merge platform entries that belong to the same restaurant (by name). */
function normalizeKey(name: string | undefined) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function mergeRestaurants(list: RestaurantAvailability[]): RestaurantAvailability[] {
  const map = new Map<string, RestaurantAvailability>();

  for (const item of list) {
    const key = normalizeKey(item.name);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...item });
      continue;
    }

    const merged: RestaurantAvailability = {
      ...existing,
      rating: Math.max(existing.rating, item.rating),
      distanceKm: Math.min(existing.distanceKm, item.distanceKm),
      priceRange: existing.priceRange || item.priceRange,
      heroImage: existing.heroImage || item.heroImage,
      dishName: existing.dishName || item.dishName,
      dishes: Array.from(new Set([...(existing.dishes || []), ...(item.dishes || [])])),
      city: existing.city || item.city,
      updatedAt: Math.max(existing.updatedAt ?? 0, item.updatedAt ?? 0) || existing.updatedAt || item.updatedAt,
      priceConfidence: (existing.priceConfidence === 'low' || item.priceConfidence === 'low')
        ? 'low'
        : (existing.priceConfidence === 'medium' || item.priceConfidence === 'medium')
        ? 'medium'
        : existing.priceConfidence || item.priceConfidence,
      swiggy: existing.swiggy.available || item.swiggy.available
        ? {
            available: true,
            price: Math.min(existing.swiggy.price ?? Infinity, item.swiggy.price ?? Infinity),
            etaMins: Math.min(existing.swiggy.etaMins ?? Infinity, item.swiggy.etaMins ?? Infinity),
          }
        : { available: false },
      zomato: existing.zomato.available || item.zomato.available
        ? {
            available: true,
            price: Math.min(existing.zomato.price ?? Infinity, item.zomato.price ?? Infinity),
            etaMins: Math.min(existing.zomato.etaMins ?? Infinity, item.zomato.etaMins ?? Infinity),
          }
        : { available: false },
      priceBreakdown: [...(existing.priceBreakdown || []), ...(item.priceBreakdown || [])]
        // keep only first per platform to avoid duplicates
        .reduce<PriceBreakdown[]>((acc, pb) => {
          const foundIndex = acc.findIndex((x) => x.platform === pb.platform);
          if (foundIndex === -1) {
            acc.push(pb);
          } else {
            // prefer the fresher breakdown
            const existingPb = acc[foundIndex];
            if ((pb.updatedAt ?? 0) > (existingPb.updatedAt ?? 0)) {
              acc[foundIndex] = pb;
            }
          }
          return acc;
        }, []),
    };
    map.set(key, merged);
  }

  return Array.from(map.values());
}

export const AVAILABILITY_MERGED: RestaurantAvailability[] = mergeRestaurants(AVAILABILITY_DUMMY);

export const AVAILABILITY_PARTITIONS = buildAvailabilityPartitions(AVAILABILITY_MERGED);

/** Get availability for a given city; fall back to all if city missing. */
export function getAvailabilityForCity(city?: string): RestaurantAvailability[] {
  const key = city ? city.toLowerCase().trim() : 'unknown';
  const hit = AVAILABILITY_PARTITIONS.byCity.get(key);
  return (hit && hit.length ? hit : AVAILABILITY_MERGED).slice();
}

/** Incremental merge: normalize incoming snapshots and merge with an existing list. */
export function mergeIncremental(
  prev: RestaurantAvailability[],
  newSnapshots: RawSnapshot[]
): RestaurantAvailability[] {
  const normalized = normalizeSnapshots(newSnapshots);
  return mergeRestaurants([...prev, ...normalized]);
}
