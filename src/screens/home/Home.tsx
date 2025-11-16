// src/screens/home/Home.tsx
import React, { useEffect, useMemo, useRef, useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../../components/AppHeader';
import { useCart } from '../../store/cart';
import { DISH_CATALOG, allDishNames } from '../../data/dishCatalog';
import { getDishImage, placeholderDishUrl } from '../../lib/images';
import { ensureActiveProfile, getActiveProfile } from '../../lib/profileStore';
import {
  haversineMeters,
  reverseGeocode,
  deriveAddressLabel,
  maybeLiveLocationFlow,
  SAME_LOCATION_THRESHOLD_M,
} from '../../lib/location';
import { usePermDecision, setPermPolicy, allowForThisSession, decidePerm } from '../../lib/permPrefs';
import { emit } from '../../lib/events';
import { nearestSavedTo, rememberActiveProfileAddress } from '../../lib/addressBook'; // ← NEW

const DISTANCE_THRESHOLD_M = 300;
const SHOW_DEBUG = false;
const HERO_PLACEHOLDER = placeholderDishUrl();

/** --- NEW: prompt suppression (prevents loop after “Update address”) --- */
const SUPPRESS_KEY = 'bw.locationPrompt.suppressUntil';
const SUPPRESS_MS = 8 * 60 * 1000; // ~8 min grace
function setPromptSuppress(ms = SUPPRESS_MS) {
  try { sessionStorage.setItem(SUPPRESS_KEY, String(Date.now() + ms)); } catch {}
}
function isPromptSuppressed() {
  try {
    const t = Number(sessionStorage.getItem(SUPPRESS_KEY) || '0');
    return t > Date.now();
  } catch { return false; }
}
function clearPromptSuppress() { try { sessionStorage.removeItem(SUPPRESS_KEY); } catch {} }

/* ----- tiny stars ----- */
function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-[14px] w-[14px] inline-block align-[-1px]">
      <path
        d="M10,2 11.7,7 16,7.4 14.3,10.3 13.6,15.5 10,16.5 5.7,13 6.6,8.4 7.7,7.16"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
function StarHalf() {
  return (
    <svg viewBox="0 0 20 20" className="h-[14px] w-[14px] inline-block align-[-1px]">
      <linearGradient id="halfFill" x1="0" y1="0" x2="1" y2="0">
        <stop offset="50%" stopColor="currentColor" />
        <stop offset="50%" stopColor="transparent" />
      </linearGradient>
      <path
        d="M10,2 11.7,7 16,7.4 14.3,10.3 13.6,15.5 10,16.5 5.7,13 6.6,8.4 7.7,7.16"
        fill="url(#halfFill)"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
function Stars({ value = 4.2 }: { value?: number }) {
  const v = Math.max(0, Math.min(5, value));
  const full = Math.floor(v);
  const half = v - full > 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <>
      {Array.from({ length: full }).map((_, i) => (<Star key={`s${i}`} filled />))}
      {half ? <StarHalf key="half" /> : null}
      {Array.from({ length: empty }).map((_, i) => (<Star key={`e${i}`} filled={false} />))}
    </>
  );
}

/* ----- types ----- */
type TabKey = 'all' | 'popular' | 'frequent' | 'value';
type DishVM = { id: string; name: string; cuisine?: string; rating?: number; image: string };

/* ----- memoised card ----- */
const DishCard = memo(function DishCard({
  d,
  qty,
  onInc,
  onDec,
  onAddFirst,
  selected,
  onSelect,
  priority = false,
}: {
  d: DishVM;
  qty: number;
  onInc: () => void;
  onDec: () => void;
  onAddFirst: () => void;
  selected: boolean;
  onSelect: () => void;
  priority?: boolean;
}) {
  return (
    <div
      className={[
        'group relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl text-white shadow-lg shadow-black/30 p-3 transition',
        selected ? 'ring-2 ring-white/70' : '',
      ].join(' ')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      style={{ contain: 'content', containIntrinsicSize: '320px 280px' } as any}
      onClick={onSelect}
    >
      <div className="relative w-full rounded-xl overflow-hidden mb-2 pb-[175%]">
        <img
          src={d.image || placeholderDishUrl()}
          className="absolute inset-0 h-full w-full object-cover object-center"
          loading={priority ? 'eager' : 'lazy'}
          fetchpriority={priority ? 'high' : 'auto'}
          decoding="async"
          sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
          onError={(e) => {
            const el = (e.currentTarget as HTMLImageElement)!;
            const ph = placeholderDishUrl();
            if (!el.src.endsWith(ph)) el.src = ph;
          }}
          alt={d.name}
        />
        {selected && (
          <div className="absolute inset-0 bg-[rgba(4,9,20,0.88)] backdrop-blur-sm flex items-end justify-center p-3 gap-2">
            {qty > 0 ? (
              <div
                className="grid grid-cols-[36px,52px,36px] items-center gap-2 rounded-full border border-white/20 bg-white/10 text-white px-2 py-2 shadow-lg shadow-black/40"
                onClick={(e) => e.stopPropagation()}
              >
                <button className="px-3 text-xl leading-none text-white hover:text-rose-200" onClick={onDec}>
                  -
                </button>
                <div className="text-center select-none font-semibold">{qty}</div>
                <button className="px-3 text-xl leading-none text-white hover:text-lime-200" onClick={onInc}>
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="text-sm w-full rounded-xl px-4 py-2 font-semibold bg-gradient-to-r from-[#fde68a] via-[#f9a8d4] to-[#c084fc] text-[#0b1120] shadow-lg shadow-rose-500/30"
                onClick={onAddFirst}
              >
                Add to cart
              </button>
            )}
          </div>
        )}
      </div>
      <p className="font-semibold text-white">{d.name}</p>
      {d.cuisine ? <p className="text-sm text-white/70">{d.cuisine}</p> : null}
      {typeof d.rating === 'number' && (
        <p className="text-sm mt-1 flex items-center gap-2 text-white/80">
          <span className="text-yellow-300"><Stars value={d.rating} /></span>
          <span>{d.rating.toFixed(1)}</span>
        </p>
      )}
    </div>
  );
});

export default function Home() {
  const nav = useNavigate();
  const locPerm = usePermDecision('location'); // 'allow' | 'deny' | 'ask'
  const { add, dec, itemsMap, count } = useCart();

  // recent thumbnails (kept, but filtered to only items still in cart)
  const recentRef = useRef<string[]>([]);
  function pushRecent(id: string) {
    const arr = recentRef.current.filter((x) => x !== id);
    arr.push(id);
    while (arr.length > 12) arr.shift();
    recentRef.current = arr;
  }

  // task signal
  function addAndTrack({ id, name }: { id: string; name: string }) {
    add({ id, name });          // ⬅️ was: add({ id })
    pushRecent(String(id));
    emit('bw:dish:add', { id, name });
  }
  function onDishSelect(id: string) {
    setSelectedId((cur) => (cur === id ? null : id));
    emit('bw:dish:browse', { id });
  }

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [query, setQuery] = useState('');
  const [filters, setFilters] =
    useState<{ priceMax?: number; ratingMin?: number; distanceMax?: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLocModalOpen, setLocModalOpen] = useState(false);
  const live = useRef<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [actLabel, setActLabel] = useState<string | null>(null);
  const [locationKey, setLocationKey] = useState<string>('init');
  const log = (...args: any[]) => SHOW_DEBUG && console.log('[Home]', ...args);
  const liveTimer = useRef<number | null>(null);

  /* ----- startup wiring ----- */
  useEffect(() => { ensureActiveProfile(); }, []);
  useEffect(() => {
    try {
      const names = DISH_CATALOG.map((d: any) => d.name);
      window.dispatchEvent(new CustomEvent('bw:dishes:names', { detail: names }));
    } catch {}
  }, []);

  // ❌ Remove the older hard-coded redirect to location wizard on this flag.
  // (AppShell now routes to the correct first-needed permission.)
  // Keep this effect as a fallback (it routes to the *first* needed perm if a flag is still present)
  useEffect(() => {
    try {
      if (sessionStorage.getItem('bw.requirePermRecheck') === '1') {
        sessionStorage.removeItem('bw.requirePermRecheck');
        const needs = (['location', 'notifications', 'mic'] as const)
          .filter((k) => decidePerm(k) === 'ask');
        if (needs.length) {
          nav(`/onboarding/perm/${needs[0]}?from=unlock`, { replace: true });
        }
        emit('bw:perm:recheck', null);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onLive = (e: Event) => {
      const val = (e as CustomEvent).detail as string;
      if (liveTimer.current) window.clearTimeout(liveTimer.current);
      liveTimer.current = window.setTimeout(() => setQuery(val || ''), 120);
    };
    const onEnter = (e: Event) => setQuery(((e as CustomEvent).detail as string) || '');
    const onVoice = (e: Event) => setQuery(((e as CustomEvent).detail as string) || '');
    window.addEventListener('bw:keyword:live', onLive as any);
    window.addEventListener('bw:keyword:search', onEnter as any);
    window.addEventListener('bw:voice:search', onVoice as any);
    return () => {
      window.removeEventListener('bw:keyword:live', onLive as any);
      window.removeEventListener('bw:keyword:search', onEnter as any);
      window.removeEventListener('bw:voice:search', onVoice as any);
    };
  }, []);

  useEffect(() => {
    const onFilters = (e: Event) => {
      const pf = ((e as CustomEvent).detail as any) || null;
      setFilters(pf);
      setSelectedId(null);
    };
    window.addEventListener('bw:filters:update', onFilters as any);
    return () => window.removeEventListener('bw:filters:update', onFilters as any);
  }, []);

  /** ✅ SINGLE live-location effect (robust + suppression + multi-address) */
  useEffect(() => {
    let cancelled = false;

    async function run(source: string) {
      if (locPerm !== 'allow') return;
      if (isPromptSuppressed()) return;

      const res = await maybeLiveLocationFlow(({ live: newLive }) => {
        if (cancelled) return;

        // Prefer nearest among all saved addresses
        const { meters } = nearestSavedTo(newLive);
        if (typeof meters === 'number' && meters <= (SAME_LOCATION_THRESHOLD_M || 100)) {
          // within 100m -> silently prefer, do nothing
          return;
        }
        if (typeof meters === 'number' && meters < DISTANCE_THRESHOLD_M) {
          // between 100 and 300m → still skip prompt
          return;
        }

        // 300m+ → prompt
        live.current = newLive;
        setActLabel(typeof meters === 'number' ? `${meters} m` : 'New position');
        setLocModalOpen(true);
      });

      if (res === 'auto-switched') {
        setLocationKey(`switched:${Date.now()}`);
      }
    }

    run('mount');

    const onVisible = () => { if (document.visibilityState === 'visible') run('visible'); };
    const onPermRecheck = () => run('perm-recheck');

    const onBackendLive = (e: CustomEvent<{ lat: number; lng: number }>) => {
      if (cancelled || locPerm !== 'allow' || isPromptSuppressed()) return;
      const coords = e.detail;
      if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return;

      const { meters } = nearestSavedTo(coords);
      if (typeof meters === 'number') {
        if (meters <= (SAME_LOCATION_THRESHOLD_M || 100)) {
          // within 100m of a saved address → do nothing (silently prefer saved)
          return;
        }
        if (meters >= DISTANCE_THRESHOLD_M) {
          live.current = coords;
          setActLabel(`${Math.round(meters)} m`);
          setLocModalOpen(true);
        }
      } else {
        // no saved addresses → behave like before
        live.current = coords;
        setActLabel('New position');
        setLocModalOpen(true);
      }
    };

    const onProfileUpdate = () => {
      try {
        // remember updated active profile in the address book
        rememberActiveProfileAddress(); // ← NEW

        const saved = getActiveProfile();
        if (!saved || live.current.lat == null || live.current.lng == null) return;

        const { meters } = nearestSavedTo({ lat: live.current.lat!, lng: live.current.lng! });
        if (typeof meters === 'number' && meters <= (SAME_LOCATION_THRESHOLD_M || 100)) {
          clearPromptSuppress();
        }
      } catch {}
      setLocationKey(`profile:${Date.now()}`);
    };

    window.addEventListener('visibilitychange', onVisible);
    window.addEventListener('bw:perm:recheck' as any, onPermRecheck as any);
    window.addEventListener('bw:backend:liveLocation' as any, onBackendLive as any);
    window.addEventListener('bw:profile:update' as any, onProfileUpdate as any);
    window.addEventListener('storage', onProfileUpdate as any);

    return () => {
      cancelled = true;
      window.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('bw:perm:recheck' as any, onPermRecheck as any);
      window.removeEventListener('bw:backend:liveLocation' as any, onBackendLive as any);
      window.removeEventListener('bw:profile:update' as any, onProfileUpdate as any);
      window.removeEventListener('storage', onProfileUpdate as any);
    };
  }, [locPerm]);

  /* ----- listing ----- */
  const visibleDishes = useMemo(() => {
    let list = DISH_CATALOG.slice(0);
    switch (activeTab) {
      case 'popular':
        list = list.filter((d: any) => d.popular === true || (d.tags || []).includes('popular'));
        break;
      case 'frequent':
        list = list.filter((_: any, i: number) => i % 2 === 0);
        break;
      case 'value':
        list = list.filter((d: any) => typeof d.price === 'number' && d.price < 200);
        break;
      default:
        break;
    }
    if (filters) {
      const { priceMax, ratingMin, distanceMax } = filters;
      list = list.filter((d: any) => {
        const price = typeof d.price === 'number' ? d.price : undefined;
        const distance = (d as any).distance as number | undefined;
        const rating = (d as any).rating as number | undefined;
        const okP = typeof priceMax === 'number' ? (price ?? Infinity) <= priceMax : true;
        const okR = typeof ratingMin === 'number' ? (rating ?? -Infinity) >= ratingMin : true;
        const okD = typeof distanceMax === 'number' ? (distance ?? Infinity) <= distanceMax : true;
        return okP && okR && okD;
      });
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((d: any) => d.name.toLowerCase().includes(q));
    }
    return (list as any[]).map((d: any) => ({
      id: String(d.id),
      name: d.name,
      cuisine: d.cuisine,
      rating: d.rating,
      image: getDishImage(d.name, d.imageUrl),
    })) as DishVM[];
  }, [activeTab, query, filters, locationKey, itemsMap]);

  /* ----- helpers ----- */
  const qtyOf = (id: string | number) => (itemsMap as any)?.[String(id)]?.qty ?? 0;

  // 🚦 “Update address” → seed onboarding and suppress prompts while we travel there
  async function onLocationChanged() {
    const livePos = live.current;
    if (!livePos || livePos.lat == null || livePos.lng == null) return;
    setPromptSuppress();
    const addr = await reverseGeocode(livePos as any);
    const label2 = deriveAddressLabel(addr);
    try {
      sessionStorage.setItem(
        'bw.pending.liveAddress',
        JSON.stringify({ lat: livePos.lat, lng: livePos.lng, addressLine: addr, label: label2 })
      );
    } catch {}
    emit('bw:location:changed', { lat: livePos.lat, lng: livePos.lng });
    nav('/onboarding/address/pick', { replace: true });
  }

  /* ----- recent thumbnails for bottom CTA (live sync with cart) ----- */
  const recentThumbs = useMemo(() => {
    const idsInCart = new Set(Object.keys(itemsMap || {}));
    const filtered = recentRef.current.filter((id) => idsInCart.has(String(id)));
    const backfill = Object.keys(itemsMap || {}).filter((id) => !filtered.includes(id));
    const ids = [...filtered, ...backfill].slice(-3);
    return ids.map((id) => {
      const key = String(id);
      const entry = (itemsMap as any)?.[key] || {};
      const cat = DISH_CATALOG.find((d: any) => String(d.id) === key) as any;
      const name = entry.name || cat?.name || '';
      const img = getDishImage(name, entry.imageUrl || cat?.imageUrl || null);
      return { id: key, name, img };
    });
  }, [itemsMap, activeTab, query, filters, locationKey]);

  /* ----- UI ----- */
  return (
    <main className="min-h-screen text-white pb-28 px-3">
      <div className="max-w-4xl mx-auto w-full max-w-6xl px-3 pb-28">
        <AppHeader />

        {/* Tabs */}
        <div className="mt-4 flex gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'popular', label: 'Popular' },
            { key: 'frequent', label: 'Frequently Ordered' },
            { key: 'value', label: 'Best Offers' },
          ].map((t: any) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as TabKey)}
              className={[
                'px-3 py-1.5 rounded-full text-sm border transition',
                activeTab === t.key
                  ? 'bg-white text-black border-white'
                  : 'bg-white/10 text-white/80 border-white/20',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Dish grid */}
        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleDishes.map((d, idx) => {
            const id = String(d.id);
            const qty = qtyOf(id);
            const selected = selectedId === id;
            return (
              <DishCard
                key={id}
                d={d}
                qty={qty}
                selected={selected}
                priority={idx < 3}
                onSelect={() => onDishSelect(id)}
                onInc={() => addAndTrack({ id, name: d.name })}
                onDec={() => dec(id)}
                onAddFirst={() => addAndTrack({ id, name: d.name })}
              />
            );
          })}
        </section>

        {/* Bottom bar */}
        {count > 0 && (
          <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30">
            <div className="inline-flex items-center gap-2 rounded-full border bg-white/95 backdrop-blur px-2 py-1 shadow-lg">
              <div className="flex -space-x-2">
                {recentThumbs.map((t) => (
                  <img
                    key={t.id}
                    src={t.img}
                    alt={t.name}
                    className="w-7 h-7 rounded-full object-cover border bg-white"
                  />
                ))}
              </div>
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded-full bg-black text-white"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  nav('/availability');
                }}
              >
                Check availability
              </button>
            </div>
          </div>
        )}

        {/* Location modal */}
        {isLocModalOpen && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md px-4">
              <div className="glass-card border-white/10 text-white p-5">
                <p className="font-semibold mb-2">Update your location</p>
                <p className="text-sm text-white/70 mb-4">
                  {actLabel
                    ? `You're ~${actLabel} from your saved address. Update for accurate prices.`
                    : 'Update your location for accurate prices.'}
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    className="rounded-xl border border-white/30 px-3 py-2 text-sm text-white/80"
                    onClick={() => setLocModalOpen(false)}
                  >
                    Not now
                  </button>
                  <button
                    className="rounded-xl px-3 py-2 text-sm bg-white text-black font-semibold"
                    onClick={async () => {
                      await onLocationChanged();
                      setLocModalOpen(false);
                    }}
                  >
                    Update address
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = HERO_PLACEHOLDER;
    (link as any).fetchPriority = 'high';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);
