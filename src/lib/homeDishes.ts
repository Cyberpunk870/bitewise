// src/lib/homeDishes.ts
import type { DishRecord } from '../data/dishCatalog';
import { apiGet } from './api';
import { logError } from './logger';
import { getAuth } from 'firebase/auth';

export type HomeDish = DishRecord & {
  orderCount?: number;
  bestseller?: boolean;
  etaMins?: number;
  platform?: string;
  priceDrop?: boolean;
};

type CacheEntry = { ts: number; dishes: HomeDish[] };
const CACHE_PREFIX = 'bw.dishes.cache.';

function readCache(scope: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + scope);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeCache(scope: string, dishes: HomeDish[]) {
  try {
    const entry: CacheEntry = { ts: Date.now(), dishes };
    localStorage.setItem(CACHE_PREFIX + scope, JSON.stringify(entry));
  } catch {}
}

/**
 * Fetch home dishes from backend (normalized across providers).
 * Falls back to last-good cached results for the scope (city/pincode).
 */
export type HomeLocation = {
  city?: string;
  address?: string;
  pincode?: string;
};

export async function fetchHomeDishes(
  loc: HomeLocation = {},
  keyword?: string
): Promise<HomeDish[]> {
  const user = getAuth().currentUser;
  if (!user) {
    throw new Error('not-authenticated');
  }
  const scopeKey = [loc.pincode, loc.city, loc.address].filter(Boolean).join('|') || 'default';
  const prev = readCache(scopeKey)?.dishes || [];
  const q = keyword?.trim() || 'popular';

  try {
    const params = new URLSearchParams();
    params.set('keyword', q);
    if (loc.city) params.set('city', loc.city);
    if (loc.address) params.set('address', loc.address);
    if (loc.pincode) params.set('pincode', loc.pincode);
    // default list (no explicit keyword) -> cap to 20 popular near the user
    if (!keyword || q === 'popular') params.set('limit', '20');
    const res = await apiGet(`/dishes/home?${params.toString()}`);
    const list = (res?.dishes || res || []) as HomeDish[];
    if (Array.isArray(list) && list.length) {
      // annotate price drops vs cached snapshot
      const prevMap = new Map<string, number>();
      prev.forEach((d) => {
        if (typeof d.price === 'number') prevMap.set(String(d.id), d.price);
      });
      const annotated = list.map((d) => {
        const prevPrice = prevMap.get(String(d.id));
        const priceDrop =
          typeof prevPrice === 'number' &&
          typeof d.price === 'number' &&
          d.price < prevPrice;
        return { ...d, priceDrop };
      });
      writeCache(scopeKey, annotated);
      return annotated;
    }
  } catch (err) {
    logError('fetchHomeDishes failed, using cached snapshot', { err: String(err) });
  }

  // fallback to cached snapshot (may be empty)
  return prev;
}
