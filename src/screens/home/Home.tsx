// src/screens/home/Home.tsx
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../store/cart';
import { DISH_CATALOG, allDishNames } from '../../data/dishCatalog';
import { getDishImage } from '../../lib/images';
import type { FilterState, TabKey } from './types';
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
const AppHeader = React.lazy(() => import('../../components/AppHeader'));
const FirstTimeGuide = React.lazy(() => import('../../components/FirstTimeGuide'));
const DishGrid = React.lazy(() => import('./HomeDishGrid'));

const DISTANCE_THRESHOLD_M = 300;
const SHOW_DEBUG = false;

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
  const [filters, setFilters] = useState<FilterState>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLocModalOpen, setLocModalOpen] = useState(false);
  const [showGuide, setShowGuide] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bw.guide.done') !== '1';
    } catch {
      return true;
    }
  });
  const [profile, setProfile] = useState(() => getActiveProfile());
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelSuggestion, setLabelSuggestion] = useState<string>('Home');

  const dismissGuide = useCallback(() => {
    setShowGuide(false);
    try {
      localStorage.setItem('bw.guide.done', '1');
    } catch {}
  }, []);

  const guideAction = useCallback(
    (action: string) => {
      if (action === 'compare') {
        nav('/availability');
        return;
      }
      if (action === 'missions') {
        nav('/tasks');
        return;
      }
      if (action === 'cart-focus') {
        const el = document.getElementById('home-dish-grid');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [nav]
  );
  const tourSteps = useMemo(
    () => [
      {
        id: 'search',
        title: 'Search any craving',
        body: 'Use search or voice to jump straight to your favourite dishes.',
      },
      {
        id: 'add',
        title: 'Add dishes to compare',
        body: 'Tap a card to add it to your cart. Two dishes are enough to start comparing.',
        actionLabel: 'See dishes',
        action: 'cart-focus',
      },
      {
        id: 'compare',
        title: 'Find the cheapest platform',
        body: 'Hit “Check availability” to see Swiggy vs Zomato pricing before you order.',
        actionLabel: 'Open compare',
        action: 'compare',
      },
    ],
    []
  );
  useEffect(() => {
    const refresh = () => setProfile(getActiveProfile());
    window.addEventListener('storage', refresh);
    window.addEventListener('bw:profile:update' as any, refresh as any);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('bw:profile:update' as any, refresh as any);
    };
  }, []);

  const openLabelPrompt = useCallback((hint?: string) => {
    setLabelSuggestion(hint || deriveAddressLabel(hint || '') || 'Home');
    setShowLabelModal(true);
    try { sessionStorage.removeItem('bw.labelPrompt.skip'); } catch {}
  }, []);

  const maybePromptLabel = useCallback(() => {
    try {
      if (sessionStorage.getItem('bw.labelPrompt.skip') === '1') return;
    } catch {}
    const active = getActiveProfile();
    if (!active?.addressLine || active.addressLabel) return;
    openLabelPrompt(active.addressLine);
  }, [openLabelPrompt]);

  useEffect(() => {
    if (!profile?.addressLine || profile?.addressLabel) return;
    const timer = window.setTimeout(() => maybePromptLabel(), 1200);
    return () => window.clearTimeout(timer);
  }, [profile?.addressLine, profile?.addressLabel, maybePromptLabel]);
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
        openLabelPrompt();
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
          openLabelPrompt();
        }
      } else {
        // no saved addresses → behave like before
        live.current = coords;
        setActLabel('New position');
        setLocModalOpen(true);
        openLabelPrompt();
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
  }, [locPerm, maybePromptLabel]);

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
        <Suspense fallback={<div className="h-32 w-full animate-pulse rounded-2xl bg-white/5" />}>
          <AppHeader />
        </Suspense>

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
        <Suspense
          fallback={
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-[320px] rounded-2xl border border-white/5 bg-white/5 animate-pulse"
                />
              ))}
            </div>
          }
        >
          <DishGrid
            activeTab={activeTab}
            query={query}
            filters={filters}
            locationKey={locationKey}
            itemsMap={itemsMap}
            selectedId={selectedId}
            onSelect={onDishSelect}
            onAdd={addAndTrack}
            onDec={(id) => dec(id)}
          />
        </Suspense>

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
                    loading="lazy"
                    decoding="async"
                  />
                ))}
              </div>
              <button
                id="home-compare-cta"
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
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    className="rounded-xl border border-white/30 px-3 py-2 text-sm text-white/80"
                    onClick={() => setLocModalOpen(false)}
                  >
                    Not now
                  </button>
                  <button
                    className="rounded-xl border border-white/30 px-3 py-2 text-sm text-white/80"
                    onClick={() => {
                      setShowLabelModal(true);
                      setLocModalOpen(false);
                    }}
                  >
                    Edit label
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
      {showLabelModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 grid place-items-center px-4">
          <div className="glass-card border-white/10 text-white p-5 max-w-sm w-full">
            <p className="font-semibold mb-2">Add a nickname</p>
            <p className="text-sm text-white/70">
              Give this address a quick label like “Home” or “Work” so we can switch faster later.
            </p>
            <p className="text-xs text-white/50 mt-2">Suggested: {labelSuggestion}</p>
            <div className="flex flex-wrap gap-2 justify-end mt-4">
              <button
                className="rounded-xl border border-white/30 px-3 py-2 text-sm text-white/80"
                onClick={() => {
                  setShowLabelModal(false);
                  try { sessionStorage.setItem('bw.labelPrompt.skip', '1'); } catch {}
                }}
              >
                Later
              </button>
              <button
                className="rounded-xl px-3 py-2 text-sm bg-white text-black font-semibold"
                onClick={() => {
                  setShowLabelModal(false);
                  nav('/onboarding/address/label');
                }}
              >
                Label address
              </button>
            </div>
          </div>
        </div>
      )}
      {showGuide && (
        <Suspense fallback={null}>
          <FirstTimeGuide steps={tourSteps} onDismiss={dismissGuide} onAction={guideAction} />
        </Suspense>
      )}
    </main>
  );
}
