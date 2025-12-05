// /src/lib/images.ts

/**
 * Simple deterministic dish-image resolver with local fallback + caching.
 * - Keeps your original cache/slug behavior.
 * - Defensive: accepts undefined/null inputs safely.
 */

type Cache = Record<string, string>;
const LS_KEY = 'dishImages:v1';

function load(): Cache {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
}

function save(c: Cache) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(c));
  } catch {
    /* ignore storage write errors (e.g., Safari private mode) */
  }
}

/**
 * Resolve a displayable image URL for a dish.
 *
 * Priority:
 * 1) explicitUrl if provided and non-empty
 * 2) cached URL for this name
 * 3) local slug under /img/dishes/<slug>.jpg
 * 4) category fallback if provided
 * 5) placeholder
 */
export function getDishImage(
  dishName?: string | null,
  explicitUrl?: string | null,
  category?: string | null
): string {
  const safeName = (dishName ?? '').trim();
  const cacheKey = (safeName || 'unknown').toLowerCase();
  const cache = load();

  // 1) explicit url
  const rawExplicit = (explicitUrl ?? '').trim();
  if (rawExplicit) {
    cache[cacheKey] = rawExplicit;
    save(cache);
    return rawExplicit;
  }

  // 2) cached
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  // 3) local slug (if name present)
  if (safeName) {
    const slug = safeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const localUrl = `/img/dishes/${slug}.jpg`;
    cache[cacheKey] = localUrl;
    save(cache);
    return localUrl;
  }

  // 4) category fallback
  if (category) {
    const { CATEGORY_IMAGES } = require('../data/categoryImages') as any;
    const url = CATEGORY_IMAGES?.[category] || CATEGORY_IMAGES?.default;
    if (url) return url;
  }

  // 5) placeholder
  return placeholderDishUrl();
}

/** Local placeholder; ensure this file exists at public/img/ */
export function placeholderDishUrl(): string {
  return '/img/placeholder-dish.jpg';
}

export type PictureSources = {
  fallback: string;
  webp?: string;
  avif?: string;
};

/** Build <picture> sources for local dish assets (falls back to single IMG). */
export function getPictureSources(src?: string | null): PictureSources {
  const raw = (src && src.trim()) || placeholderDishUrl();
  const match = /^\/img\/(dishes|categories)\/([a-z0-9-]+)\.(jpg|jpeg|png|webp|avif)$/i.exec(raw);
  if (!match) return { fallback: raw };

  const [, folder, name] = match;
  const base = `/img/${folder}/${name}`;
  // Always ensure a .jpg fallback exists (we generate one alongside webp/avif)
  const fallback = `${base}.jpg`;
  return {
    fallback,
    webp: `${base}.webp`,
    avif: `${base}.avif`,
  };
}

/** Optional utility for debugging */
export function _clearDishImageCache() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
}
