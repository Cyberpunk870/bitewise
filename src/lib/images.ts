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
 * 2) previously cached url for this name
 * 3) local slug under /img/dishes/<slug>.jpg for known names
 * 4) placeholder image
 *
 * This function is defensive: `dishName` and `explicitUrl` can be undefined/null.
 */
export function getDishImage(
  dishName?: string | null,
  explicitUrl?: string | null
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

  // 4) placeholder
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
  const fallback = (src && src.trim()) || placeholderDishUrl();
  const localMatch = /^\/img\/dishes\/[a-z0-9-]+\.jpg$/i.test(fallback);
  if (!localMatch) {
    return { fallback };
  }
  const base = fallback.replace(/\.jpg$/i, '');
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
