// src/screens/home/Home.tsx
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../store/cart';
import { DISH_CATALOG } from '../../data/dishCatalog';
import type { DishRecord } from '../../data/dishCatalog';
import { getDishImage, placeholderDishUrl } from '../../lib/images';
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
import { nearestSavedTo, rememberActiveProfileAddress } from '../../lib/addressBook';
import { listActiveThemes, resolveSeasonalTheme, type SeasonalTheme } from '../../lib/seasonalThemes';
import { fetchThemesPublic, trackThemeEvent } from '../../lib/api';
import { track } from '../../lib/track';
import { setActiveProfileFields } from '../../lib/profileStore';
import GlassPanel from '../../components/GlassPanel';
const AppHeader = React.lazy(() => import('../../components/AppHeader'));
import DishGrid from './HomeDishGrid';
import { fetchHomeDishes, type HomeDish } from '../../lib/homeDishes';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const DISTANCE_THRESHOLD_M = 300;
const SHOW_DEBUG = false;

function applyNearestSwitch(coords: { lat: number; lng: number }): boolean {
  const { addr, meters } = nearestSavedTo(coords);
  if (!addr || meters == null) return false;
  if (meters <= DISTANCE_THRESHOLD_M) {
    setActiveProfileFields({
      addressLine: addr.addressLine,
      addressLabel: addr.label,
      lat: addr.lat,
      lng: addr.lng,
    });
    rememberActiveProfileAddress();
    emit('bw:profile:update');
    return true;
  }
  return false;
}

function formatDistance(meters: number) {
  if (!meters || Number.isNaN(meters)) return '';
  if (meters < 1500) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function useRecentThumbs(itemsMap: Record<string, any>, dishes: DishRecord[]) {
  return useMemo(() => {
    const e = Object.values(itemsMap || {});
    e.sort((a: any, b: any) => (b?.updatedAt || 0) - (a?.updatedAt || 0));
    return e.slice(0, 3).map((item: any) => {
      const id = String(item.id);
      const hit = dishes.find((d) => String(d.id) === id);
      const img = hit ? getDishImage(hit.name, hit.imageUrl, hit.category) : placeholderDishUrl();
      const name = hit?.name || 'Item';
      return { id, img, name };
    });
  }, [itemsMap, dishes]);
}

function useSeasonalThemes() {
  const [themes, setThemes] = useState<SeasonalTheme[]>(() => resolveSeasonalTheme() ? [resolveSeasonalTheme()!] : []);
  const [current, setCurrent] = useState<SeasonalTheme | null>(() => resolveSeasonalTheme());

  useEffect(() => {
    const local = resolveSeasonalTheme();
    if (local) {
      setCurrent(local);
      setThemes([local]);
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchThemesPublic();
        if (cancelled) return;
        const list = (res?.themes || []) as SeasonalTheme[];
        const active = list.filter((t) => {
          const today = new Date().toISOString().slice(0, 10);
          return t.start <= today && today <= t.end;
        });
        if (active.length) {
          active.sort((a, b) => (b.priority || 0) - (a.priority || 0));
          setThemes(active);
          setCurrent(active[0]);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!themes.length) return;
    const id = window.setInterval(() => {
      setCurrent((cur) => {
        const idx = themes.findIndex((t) => t.name === cur?.name);
        const next = themes[(idx + 1) % themes.length];
        return next;
      });
    }, 8000);
    return () => window.clearInterval(id);
  }, [themes]);

  return current;
}

export default function Home() {
  const nav = useNavigate();
  const locPerm = usePermDecision('location'); // 'allow' | 'deny' | 'ask'
  const { add, dec, itemsMap, count } = useCart();

  // task signal
  function addAndTrack({ id, name }: { id: string; name: string }) {
    add({ id, name });
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
  const [locationKey, setLocationKey] = useState<string>('');
  const [locLabel, setLocLabel] = useState<string | null>(null);
  const [actLabel, setActLabel] = useState<string | null>(null);
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [pendingLiveLoc, setPendingLiveLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingLiveLabel, setPendingLiveLabel] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<'live' | 'label' | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [liveFlow, setLiveFlow] = useState<'idle' | 'working' | 'done'>('idle');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [dishes, setDishes] = useState<HomeDish[]>(DISH_CATALOG as HomeDish[]);
  const [city, setCity] = useState<string | undefined>(undefined);
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [pincode, setPincode] = useState<string | undefined>(undefined);
  const derivePincode = (src?: string | null) => {
    if (!src) return undefined;
    const match = src.match(/\b(\d{6})\b/);
    return match ? match[1] : undefined;
  };
  const fallbackPincode = '560001';
  const [authReady, setAuthReady] = useState(false);
  const [userLoggedIn, setUserLoggedIn] = useState(false);

  const currentTheme = useSeasonalThemes();

  const recentThumbs = useRecentThumbs(itemsMap, dishes);

  // ensure profile is ready
  useEffect(() => {
    ensureActiveProfile();
  }, []);

  // watch auth state
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthReady(true);
      setUserLoggedIn(!!u);
    });
    return () => unsub();
  }, []);

  // hydrate dish names into voice search
  useEffect(() => {
    try {
      const names = dishes.map((d) => d.name);
      window.dispatchEvent(new CustomEvent('bw:dishes:names', { detail: names }));
    } catch {}
  }, [dishes]);

  // update location key when profile changes and load dishes
  useEffect(() => {
    try {
      const profile = getActiveProfile();
      const key = profile ? `${profile.lat || ''}:${profile.lng || ''}:${profile.addressLabel || ''}` : '';
      setLocationKey(key);
      setActLabel(profile?.addressLabel || null);
      setAddress(profile?.addressLine || undefined);
      setPincode(derivePincode(profile?.addressLine || profile?.addressLabel || undefined) || fallbackPincode);
      setCity(profile?.city || undefined);
      (async () => {
        if (!authReady || !userLoggedIn) return;
        try {
          const list = await fetchHomeDishes(
            {
              city: profile?.city || undefined,
              address: profile?.addressLine || undefined,
              pincode: derivePincode(profile?.addressLine || profile?.addressLabel || undefined) || fallbackPincode,
            },
            query
          );
          setDishes(list);
        } catch (err: any) {
          if (err?.message === 'not-authenticated') {
            // wait for auth
            return;
          }
        }
      })();
    } catch {}
  }, [authReady, userLoggedIn]);

  // live location flow
  useEffect(() => {
    const handle = (e: Event) => {
      const detail = (e as CustomEvent)?.detail as { lat: number; lng: number } | null;
      if (!detail) return;
      setPendingLiveLoc(detail);
      const meters = haversineMeters(detail, { lat: detail.lat, lng: detail.lng });
      setPendingLiveLabel(formatDistance(meters));
      setIsLocModalOpen(true);
      setPendingType('live');
    };
    window.addEventListener('bw:backend:liveLocation', handle);
    return () => window.removeEventListener('bw:backend:liveLocation', handle);
  }, []);

  useEffect(() => {
    if (!pendingLiveLoc) return;
    const attempt = async () => {
      try {
        const addr = await reverseGeocode(pendingLiveLoc);
        const label = deriveAddressLabel(addr);
        setPendingLiveLabel(label);
      } catch {}
    };
    attempt();
  }, [pendingLiveLoc]);

  const toggleLocModal = (open: boolean) => setIsLocModalOpen(open);

  const onConfirmLive = async () => {
    if (!pendingLiveLoc) return;
    setLiveFlow('working');
    try {
      const applied = applyNearestSwitch(pendingLiveLoc);
      if (!applied) {
        setActiveProfileFields({
          lat: pendingLiveLoc.lat,
          lng: pendingLiveLoc.lng,
          addressLine: pendingLiveLabel || 'Current location',
          addressLabel: pendingLiveLabel || 'Live',
        });
        rememberActiveProfileAddress();
      }
      setLiveFlow('done');
      setIsLocModalOpen(false);
      emit('bw:profile:update');
    } catch (err: any) {
      setLiveFlow('idle');
      setLiveError(err?.message || 'Could not save location');
    }
  };

  const filteredCatalog = useMemo(() => {
    let list = dishes.slice(0);
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
    return list;
  }, [activeTab, filters, dishes]);

  // live fetch on query/city change with light debounce
  useEffect(() => {
    if (!authReady || !userLoggedIn) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const run = async () => {
        try {
          const list = await fetchHomeDishes(
            { city, address, pincode },
            query
          );
          if (!cancelled) setDishes(list);
        } catch (err: any) {
          if (err?.message === 'not-authenticated') {
            return;
          }
        }
      };
      void run();
    }, query ? 300 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, city, address, pincode, authReady, userLoggedIn]);

  // location permission helper
  const requestLoc = useCallback(async () => {
    try {
      const { getCurrentPosition } = await import('../../lib/location');
      const loc = await getCurrentPosition(6000);
      if (!loc) {
        setLocLabel(null);
        return;
      }
      const label = formatDistance(haversineMeters(loc, loc));
      setLocLabel(label);
      emit('bw:perm:recheck', null);
    } catch (err: any) {
      setLocLabel(null);
    }
  }, []);

  const onChangeFilter = (patch: Partial<FilterState>) => {
    setFilters((cur) => ({ ...(cur || {}), ...patch }));
  };

  return (
    <main className="min-h-screen text-white pb-32 px-3">
      <div className="max-w-4xl mx-auto w-full max-w-6xl px-3 pb-28">
        <Suspense fallback={<div className="h-32 w-full animate-pulse rounded-2xl bg-white/5" />}>
          <AppHeader />
        </Suspense>

        <GlassPanel tone="dark" className="mt-4">
          <div className="bw-heading text-lg">Pick your savings mode</div>
          <p className="bw-subtitle text-sm mt-1">
            Add a dish and tap <b>Check availability</b> to see the best price/ETA on the same restaurant. Want options?
            Switch to <b>Alternatives</b> to compare the same dish across nearby restaurants.
          </p>
        </GlassPanel>

        {currentTheme && (
          <div className="mt-4 rounded-2xl p-4 shadow border border-white/10" style={{ background: currentTheme.gradient }}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="text-sm uppercase tracking-[0.2em] text-white/70">{currentTheme.name}</div>
                <div className="text-2xl font-extrabold">{currentTheme.heroTitle}</div>
                <div className="text-sm text-white/80">{currentTheme.heroSubtitle}</div>
                {currentTheme.promo ? (
                  <div className="mt-2 text-sm text-white/85">
                    <div className="font-semibold">{currentTheme.promo.title}</div>
                    {currentTheme.promo.body ? <div className="text-white/80">{currentTheme.promo.body}</div> : null}
                  </div>
                ) : null}
              </div>
              {currentTheme.promo?.href ? (
                <button
                  onClick={() => {
                    if (currentTheme?.name) trackThemeEvent(currentTheme.name, 'click');
                    nav(currentTheme.promo!.href!);
                  }}
                  className="mt-2 sm:mt-0 px-4 py-2 rounded-xl font-semibold text-black"
                  style={{ backgroundColor: currentTheme.accent }}
                >
                  {currentTheme.promo.ctaLabel || 'View offers'}
                </button>
              ) : null}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3 max-w-2xl">
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
                'w-full px-3 py-1.5 rounded-full text-sm border transition text-center',
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
            dishes={filteredCatalog}
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
                    onClick={() => toggleLocModal(false)}
                  >
                    Not now
                  </button>
                  <button
                    className="rounded-xl border border-white/30 px-3 py-2 text-sm text-white/80"
                    onClick={() => {
                      setPendingType('label');
                      toggleLocModal(false);
                      try {
                        sessionStorage.setItem('bw.liveAddress.flow', 'label');
                      } catch {}
                      nav('/onboarding/address/label');
                    }}
                  >
                    Edit label
                  </button>
                  <button
                    className="rounded-xl px-3 py-2 text-sm bg-white text-black font-semibold"
                    onClick={onConfirmLive}
                  >
                    Update address
                  </button>
                </div>
                {liveError ? <p className="mt-2 text-sm text-rose-300">{liveError}</p> : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
