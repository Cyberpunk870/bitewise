// src/screens/availability/Availability.tsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AVAILABILITY_DUMMY,
  AVAILABILITY_MERGED,
  getAvailabilityForCity,
  type RestaurantAvailability,
} from '../../data/availability';
import { getDishImage, placeholderDishUrl } from '../../lib/images';
import useCart from '../../store/cart';
import { DISH_CATALOG } from '../../data/dishCatalog';
import {
  setPermPolicy,
  allowForThisSession,
  usePermDecision,
} from '../../lib/permPrefs';
import { addNotice } from '../../lib/notifications';
import { getLastAvailabilitySync, timeAgo } from '../../lib/dataSync';
import { getActiveCoords } from '../../lib/profileStore';
import * as loc from '../../lib/location';
import { useWatchlist, toggleWatch, isWatched } from '../../store/watchlist';
import { markTtfRender, markDataEmpty, markDataError } from '../../lib/metricsClient';
import { track } from '../../lib/track';
import GlassPanel from '../../components/GlassPanel';
import { getActiveProfile } from '../../lib/profileStore';

/* ---------- helpers & small atoms ---------- */

function formatCount(n?: number): string {
  if (!n || n <= 0) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k+`;
  return `${n}`;
}

function bestPrice(r: RestaurantAvailability): number | undefined {
  const byPb = r.priceBreakdown?.map((pb) => pb.total).filter((n) => typeof n === 'number');
  if (byPb && byPb.length) return Math.min(...byPb);
  const a = typeof r.swiggy.price === 'number' ? r.swiggy.price : undefined;
  const b = typeof r.zomato.price === 'number' ? r.zomato.price : undefined;
  if (typeof a === 'number' && typeof b === 'number') return Math.min(a, b);
  return a ?? b;
}

function bestEta(r: RestaurantAvailability): number | undefined {
  const a = typeof r.swiggy.etaMins === 'number' ? r.swiggy.etaMins : undefined;
  const b = typeof r.zomato.etaMins === 'number' ? r.zomato.etaMins : undefined;
  if (typeof a === 'number' && typeof b === 'number') return Math.min(a, b);
  return a ?? b;
}

function bestOfferText(r: RestaurantAvailability): string | undefined {
  const s = (r.swiggy as any)?.offerText as string | undefined;
  const z = (r.zomato as any)?.offerText as string | undefined;
  return s?.trim() || z?.trim() || undefined;
}

function freshnessInfo(r: RestaurantAvailability) {
  const updated = r.updatedAt ?? 0;
  const ageMs = Date.now() - updated;
  const ageMin = ageMs / 60000;
  if (!updated || updated <= 0) return { label: 'Unknown', tone: 'bg-slate-500/70 text-white', stale: true };
  if (ageMin <= 10) return { label: 'Live', tone: 'bg-emerald-500/80 text-white', stale: false };
  if (ageMin <= 30) return { label: 'Fresh', tone: 'bg-amber-400/80 text-slate-900', stale: false };
  return { label: 'Stale', tone: 'bg-rose-500/80 text-white', stale: true };
}

function RotatingDishImage({
  names,
  fallback,
  intervalMs = 3000,
}: {
  names: string[];
  fallback: string | undefined;
  intervalMs?: number;
}) {
  const [idx, setIdx] = useState(0);

  const urls = useMemo(() => {
    const arr = names
      .map((n) => getDishImage(n, null))
      .filter(Boolean) as string[];
    if (arr.length === 0 && fallback) arr.push(fallback);
    if (arr.length === 0) arr.push(placeholderDishUrl());
    return arr;
  }, [names, fallback]);

  useEffect(() => {
    if (urls.length <= 1) return;
    const h = setInterval(
      () => setIdx((i) => (i + 1) % urls.length),
      intervalMs
    );
    return () => clearInterval(h);
  }, [urls, intervalMs]);

  const safeAlt = names[idx] || 'dish';

  return (
    <img
      src={urls[idx]}
      alt={safeAlt}
      loading="lazy"
      className="w-full h-40 object-cover"
      onError={(e) => {
        const el = e.currentTarget as HTMLImageElement;
        const ph = placeholderDishUrl();
        if (!el.src.endsWith(ph)) el.src = ph;
      }}
    />
  );
}

function Tile({
  r,
  matchedDishNames,
  onCompare,
}: {
  r: RestaurantAvailability;
  matchedDishNames: string[];
  onCompare: (r: RestaurantAvailability) => void;
}) {
  const lowerMatches = matchedDishNames.map((n) => n.toLowerCase());
  const pbsForDish =
    (r.priceBreakdown || []).filter((pb) => {
      if (!lowerMatches.length) return true;
      return pb.items?.some((it) =>
        lowerMatches.some((n) => it.name.toLowerCase().includes(n))
      );
    }) || [];
  const platformsForDish = pbsForDish.map((pb) => pb.platform);
  const both = platformsForDish.length >= 2;
  const availablePlatforms = (['swiggy', 'zomato'] as const).filter((p) =>
    platformsForDish.includes(p)
  );
  const price = bestPrice(r);
  const eta = bestEta(r);
  const offer = bestOfferText(r);
  const reviewCount = (r as any).reviews ?? 0;
  const freshness = freshnessInfo(r);

  // firstMatchedName fallback to restaurant's known dishName (string)
  const firstMatchedName =
    matchedDishNames[0] || (r as any).dishName || 'dish';

  const openPlatform = (platform: 'swiggy' | 'zomato') => {
    track('outbound_platform_click', { platform, restaurant: r.name });
    const breakdown =
      pbsForDish.find((b) => b.platform === platform)?.deepLink ||
      r.priceBreakdown?.find((b) => b.platform === platform)?.deepLink ||
      (platform === 'swiggy'
        ? 'https://www.swiggy.com/'
        : 'https://www.zomato.com/');
    window.open(breakdown, '_blank', 'noopener');
  };

  const SwiggyIcon = () => (
    <svg
      aria-hidden
      viewBox="0 0 64 64"
      className="w-5 h-5 rounded-md"
      role="img"
    >
      <defs>
        <linearGradient id="swg" x1="0%" x2="100%">
          <stop offset="0%" stopColor="#ff7a30" />
          <stop offset="100%" stopColor="#ff4f12" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#swg)" />
      <path
        d="M34 8c7 0 12 5.1 12 12 0 6-4.2 11-9.8 11.9L36 40c0 1-.8 1.9-1.9 1.9H30c-1.1 0-1.9-.9-1.9-1.9L28.6 32H24c-1.1 0-2-.9-2-2V20c0-6.9 5.1-12 12-12z"
        fill="#fff"
      />
    </svg>
  );

  const ZomatoIcon = () => (
    <svg
      aria-hidden
      viewBox="0 0 64 64"
      className="w-5 h-5 rounded-md"
      role="img"
    >
      <rect x="2" y="2" width="60" height="60" rx="10" fill="#d4323a" />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="18"
        fontWeight="700"
        fill="#fff"
      >
        zomato
      </text>
    </svg>
  );

  const isLoved = useWatchlist((s) =>
    s.isWatched(String((r as any).id), 'restaurant')
  );
  const toggle = useWatchlist((s) => s.toggle);

  return (
    <div className="relative rounded-2xl border border-white/15 bg-white/10 text-white overflow-hidden backdrop-blur">
      <RotatingDishImage
        names={[String(firstMatchedName)]}
        fallback={(r as any).heroImage ?? ''}
        intervalMs={3000}
      />

      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold line-clamp-2">{r.name}</h3>
          <div className="text-sm text-lime-200 flex items-center gap-1">
            ⭐ {r.rating.toFixed(1)}{' '}
            <span className="opacity-60 text-xs">
              ({formatCount(reviewCount)})
            </span>
          </div>
        </div>

        <div className="text-xs text-white/70 mb-1">
          {eta ? `${eta} mins` : '—'} • {r.distanceKm} km
        </div>

        <div className="text-sm font-medium">
          {typeof price === 'number' ? `₹${price}` : '—'}
        </div>

        {offer && (
          <div className="text-xs text-rose-200 font-medium mt-1">{offer}</div>
        )}
      </div>

      <div className="absolute right-3 top-3 flex gap-2">
        <button
          className={`text-xs px-2 py-1 rounded-full border ${
            isLoved ? 'bg-yellow-300 text-slate-900 border-yellow-200' : 'bg-slate-900/80 border-white/20 text-white'
          }`}
          style={{ outline: 'none' }}
          onClick={() =>
            toggle({
              id: String((r as any).id),
              name: r.name,
              kind: 'restaurant',
            })
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggle({
                id: String((r as any).id),
                name: r.name,
                kind: 'restaurant',
              });
            }
          }}
          aria-label={isLoved ? 'Unwatch' : 'Watch'}
          title={isLoved ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          {isLoved ? '★ Watching' : '☆ Watch'}
        </button>
        {both ? (
          <button
            className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-fuchsia-300 to-cyan-300 text-slate-900 font-semibold shadow-lg shadow-fuchsia-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
            onClick={() => onCompare(r)}
            aria-label={`Compare ${r.name}`}
          >
            Compare
          </button>
        ) : (
          availablePlatforms.map((platform) => (
            <button
              key={platform}
              className="text-xs px-3 py-1 rounded-full bg-white/90 text-slate-900 font-semibold shadow flex items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
              onClick={() => openPlatform(platform)}
              aria-label={platform}
            >
              {platform === 'swiggy' ? <SwiggyIcon /> : <ZomatoIcon />}
              {platform === 'swiggy' ? 'Swiggy' : 'Zomato'}
            </button>
          ))
        )}
      </div>

      {typeof price === 'number' && (
        <div className="absolute left-3 top-3 space-y-1">
          <div className="text-xs px-2 py-1 rounded-full bg-black/60 text-white">
            ₹{price}
          </div>
          <div className={`text-[10px] px-2 py-0.5 rounded-full ${freshness.tone}`}>
            {freshness.label}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- distance helper ---------- */

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000; // m
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa =
    s1 * s1 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

/* ---------- main screen ---------- */

export default function Availability() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const t0Ref = useRef<number>(performance.now());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(false);
      markTtfRender('availability', performance.now() - t0Ref.current);
    }, 300);
    return () => window.clearTimeout(timer);
  }, []);

  // gate for location
  const perm = usePermDecision('location'); // 'allow' | 'deny' | 'ask'
  const blocked = perm !== 'allow';

  // feedback state for permission buttons
  const [busy, setBusy] = useState<'always' | 'session' | null>(null);

  // If location is blocked/off, push a notice (one-time-ish)
  useEffect(() => {
    if (perm !== 'allow') {
      addNotice({
        kind: 'system',
        title: 'Location needed',
        body: 'Enable location to show best availability near you.',
      });
    }
  }, [perm]);

  // If allowed, compare live vs saved; if >300m, prompt to update address
  useEffect(() => {
    let cancelled = false;
    async function maybeAdjust() {
      if (perm !== 'allow') return;
      const saved = getActiveCoords(); // saved home coords from profile
      if (!saved) return;

      try {
        const live = await loc.getCurrentPosition?.(6000);
        if (!live || cancelled) return;
        const dist = haversineMeters(saved, live);
        if (dist > 300) {
          const yes = window.confirm(
            'You seem to be far from your saved location.\nUpdate to your current location?'
          );
          if (!yes) return;
          try {
            sessionStorage.setItem(
              'bw.pending.liveAddress',
              JSON.stringify({ lat: live.lat, lng: live.lng })
            );
          } catch {}
          nav('/onboarding/address/pick', { replace: true });
        }
      } catch {
        // ignore position errors silently here
      }
    }
    maybeAdjust();
    return () => {
      cancelled = true;
    };
  }, [perm, nav]);

  // last sync
  const [lastSyncTs, setLastSyncTs] = useState<number | null>(
    () => getLastAvailabilitySync()
  );

  useEffect(() => {
    const onSync = (e: Event) => {
      const ts = (e as CustomEvent<number>).detail || Date.now();
      setLastSyncTs(ts);
    };
    const onError = () => {
      addNotice({
        kind: 'system',
        title: 'Live data unavailable',
        body: 'Showing cached results. Try refreshing.',
      });
    };
    window.addEventListener(
      'bw:data:availabilitySync' as any,
      onSync as any
    );
    window.addEventListener('bw:data:availabilityError' as any, onError as any);
    return () =>
      window.removeEventListener(
        'bw:data:availabilitySync' as any,
        onSync as any
      );
  }, []);

  // selected dishes from cart
  const { items } = useCart();
  const selectedDishNames = useMemo(() => {
    if (!items.length) return [];
    return items
      .map(it => {
        const dish = DISH_CATALOG.find(
          d => String((d as any).id) === String(it.id)
        );
        return (dish?.name || it.name || '').trim();
      })
      .filter(Boolean) as string[];
  }, [items]);

  // helpers for filtering
  function restaurantMenu(r: RestaurantAvailability): string[] {
    const rawList =
      (r as any).dishes ?? [ (r as any).dishName ].filter(Boolean);
    return rawList.map((n: any) => String(n).toLowerCase());
  }

  function servesAny(r: RestaurantAvailability): boolean {
    const menu = restaurantMenu(r);
    return selectedDishNames.some((n) =>
      menu.includes(n.toLowerCase())
    );
  }

function matchedDishes(r: RestaurantAvailability): string[] {
  const menu = restaurantMenu(r);
  return selectedDishNames.filter((n) =>
    menu.includes(n.toLowerCase())
  );
}

type CompareMode = 'same-restaurant' | 'other-restaurants';

  // filters
  const [priceMax, setPriceMax] = useState<number>(1500);
  const [ratingMin, setRatingMin] = useState<number>(0);
  const [distanceMax, setDistanceMax] = useState<number>(20);
  const [mode, setMode] = useState<CompareMode>('same-restaurant');

  // ignore cart narrowing after Reset
  const [ignoreCartFilter, setIgnoreCartFilter] = useState(false);

  // filtered rows
  const rows = useMemo(() => {
    // Use merged view for both modes to avoid duplicate cards per platform.
    // Same-restaurant: shows platforms on the same restaurant when both exist.
    // Other restaurants: shows other distinct restaurants that carry the dish.
    const profile = getActiveProfile();
    const cityBase = getAvailabilityForCity(profile?.city);
    const base = cityBase.length ? cityBase : AVAILABILITY_MERGED;

    let list = base.slice();

    if (selectedDishNames.length > 0 && !ignoreCartFilter) {
      const narrowed = list.filter(servesAny);
      list = narrowed.length > 0 ? narrowed : base.slice();
    }

    return list
      .map((r) => ({ r, matches: matchedDishes(r) }))
      .filter(({ r }) => {
        const price = bestPrice(r) ?? Infinity;
        const ratingOk = r.rating >= ratingMin;
        const priceOk = price <= priceMax;
        const distOk = r.distanceKm <= distanceMax;
        return ratingOk && priceOk && distOk;
      });
  }, [priceMax, ratingMin, distanceMax, selectedDishNames, ignoreCartFilter, mode]);

  // analytics: availability checks
  useEffect(() => {
    track('availability_check', {
      results: rows.length,
      selected_dishes: selectedDishNames,
      filters: { priceMax, ratingMin, distanceMax, mode },
    });
  }, [rows.length, selectedDishNames, priceMax, ratingMin, distanceMax, mode]);

  return (
    <main className="min-h-screen pb-16">
      {/* stale notice */}
      {rows.length > 0 && rows.every(({ r }) => freshnessInfo(r).stale) ? (
        <div className="mx-auto max-w-6xl px-3 mt-3">
          <div className="rounded-2xl border border-amber-300/40 bg-amber-200/15 text-amber-50 px-4 py-3 text-sm backdrop-blur">
            Data looks older than 30 minutes. We’ll refresh in the background; totals may be approximate.
          </div>
        </div>
      ) : null}

      {/* When location is DENIED, show blocker. We don't early-return the component
         so hook order above stays stable. */}
      {blocked ? (
        <div className="grid place-items-center min-h-[70vh] px-3">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-gradient-to-br from-[#0d1224]/85 via-[#0b1020]/90 to-[#0a0f1c]/88 backdrop-blur-xl p-6 text-center shadow-2xl shadow-black/40 text-white">
            <div className="mb-3 text-sm uppercase tracking-[0.2em] text-white/60">Location needed</div>
            <h2 className="font-semibold text-lg mb-2">
              {perm === 'deny' ? 'Location is turned off' : 'Share location to find nearby options'}
            </h2>
            <p className="text-sm text-white/70">
              We use your location only to check availability and ETAs from Swiggy and Zomato.
            </p>

            <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                className={`px-4 py-2 rounded-full bg-white text-[#0b1120] font-semibold shadow-lg shadow-black/30 transition ${
                  busy === 'always' ? 'opacity-70' : ''
                }`}
                disabled={!!busy}
                onClick={async () => {
                  setBusy('always');
                  try {
                    setPermPolicy('location', 'always');
                  } catch {}
                  try {
                    await loc.getCurrentPosition?.(6000);
                  } catch {}
                  setTimeout(() => window.dispatchEvent(new Event('bw:perm:recheck')), 0);
                }}
              >
                {busy === 'always' ? 'Requesting…' : 'Allow while using app'}
              </button>

              <button
                className={`px-4 py-2 rounded-full border border-white/25 bg-white/5 text-white transition ${
                  busy === 'session' ? 'opacity-70' : ''
                }`}
                disabled={!!busy}
                onClick={async () => {
                  setBusy('session');
                  try {
                    allowForThisSession('location');
                  } catch {}
                  try {
                    await loc.getCurrentPosition?.(6000);
                  } catch {}
                  setTimeout(() => window.dispatchEvent(new Event('bw:perm:recheck')), 0);
                }}
              >
                {busy === 'session' ? 'Requesting…' : 'Allow for this session'}
              </button>
            </div>

            <p className="text-xs text-white/60 mt-4">
              You can change this anytime in Settings → Permissions.
            </p>
          </div>
        </div>
      ) : (
        // Normal screen when not blocked
        <div className="max-w-4xl mx-auto w-full px-3 pt-4">
          {/* header */}
          <GlassPanel tone="dark" className="mb-3">
            <div className="flex items-center justify-between">
              <button
                className="px-3 py-1.5 text-sm rounded-full border border-white/25 bg-white/10"
                onClick={() => nav(-1)}
              >
                ← Back
              </button>

              <div className="text-center">
                <h1 className="bw-heading text-lg">Check availability</h1>
                <div className="text-[11px] text-white/80">
                  Last updated: <b className="tabular-nums">{timeAgo(lastSyncTs)}</b>
                </div>
              </div>

              <div className="w-12" />
            </div>
          </GlassPanel>

          {/* comparison mode */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div className="inline-flex rounded-2xl border border-white/15 bg-white/10 backdrop-blur px-1 py-1 text-sm text-white shadow">
              <button
                className={`px-3 py-1 rounded-xl transition ${
                  mode === 'same-restaurant' ? 'bg-white text-slate-900 shadow' : ''
                }`}
                onClick={() => setMode('same-restaurant')}
              >
                Same restaurant (platforms)
              </button>
              <button
                className={`px-3 py-1 rounded-xl transition ${
                  mode === 'other-restaurants' ? 'bg-white text-slate-900 shadow' : ''
                }`}
                onClick={() => setMode('other-restaurants')}
              >
                Other restaurants
              </button>
            </div>

            {mode === 'same-restaurant' && selectedDishNames.length > 0 && (
              <div className="flex-1 text-xs text-white/80 sm:text-right">
                Looking for the same dish nearby?{' '}
                <button
                  className="underline decoration-dotted underline-offset-4 font-semibold text-amber-200"
                  onClick={() => setMode('other-restaurants')}
                >
                  Show alternatives
                </button>
              </div>
            )}
            {mode === 'other-restaurants' && (
              <div className="flex-1 text-xs text-white/80 sm:text-right">
                Showing other restaurants with the same dish, sorted by rating/price/ETA.
              </div>
            )}
          </div>

          {/* filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <GlassPanel tone="light" padding="p-3">
              <div className="text-xs font-semibold text-slate-700 mb-1">
                Price ≤ ₹{priceMax}
              </div>
              <input
                type="range"
                min={50}
                max={1500}
                value={priceMax}
                onChange={(e) => {
                  if (ignoreCartFilter) setIgnoreCartFilter(false);
                  setPriceMax(Number(e.target.value));
                }}
                className="w-full"
              />
            </GlassPanel>

            <GlassPanel tone="light" padding="p-3">
              <div className="text-xs font-semibold text-slate-700 mb-1">
                Rating ≥ {ratingMin.toFixed(1)}
              </div>
              <input
                type="range"
                min={0}
                max={5}
                step={0.5}
                value={ratingMin}
                onChange={(e) => {
                  if (ignoreCartFilter) setIgnoreCartFilter(false);
                  setRatingMin(Number(e.target.value));
                }}
                className="w-full"
              />
            </GlassPanel>

            <GlassPanel tone="light" padding="p-3">
              <div className="text-xs font-semibold text-slate-700 mb-1">
                Distance ≤ {distanceMax} km
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={distanceMax}
                onChange={(e) => {
                  if (ignoreCartFilter) setIgnoreCartFilter(false);
                  setDistanceMax(Number(e.target.value));
                }}
                className="w-full"
              />
            </GlassPanel>
          </div>

          {/* grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {loading
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="animate-pulse rounded-2xl border border-white/10 bg-white/5 h-64"
                  />
                ))
              : rows.length === 0
              ? (
                <>
                  {markDataEmpty('availability')}
                  <div className="col-span-2 text-center text-sm text-white/80 py-8">
                    No matches with current filters.
                    <button
                      className="ml-2 px-3 py-1.5 rounded-full border border-white/30 bg-white/10 hover:bg-white/20 transition"
                      onClick={() => {
                        setPriceMax(1500);
                        setRatingMin(0);
                        setDistanceMax(20);
                        setIgnoreCartFilter(true);
                      }}
                    >
                      Reset filters
                    </button>
                  </div>
                </>
              )
              : rows.map(({ r, matches }) => (
                  <Tile
                    key={String((r as any).id)}
                    r={r}
                    matchedDishNames={matches as string[]}
                    onCompare={(row) => nav(`/compare/${String((row as any).id)}`)}
                  />
                ))}
          </div>
        </div>
      )}
    </main>
  );
}
