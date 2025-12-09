// src/screens/home/Home.tsx
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../store/cart';
import { DISH_CATALOG, allDishNames } from '../../data/dishCatalog';
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
import { nearestSavedTo, rememberActiveProfileAddress } from '../../lib/addressBook'; // ← NEW
import { listActiveThemes, resolveSeasonalTheme, type SeasonalTheme } from '../../lib/seasonalThemes';
import { fetchThemesPublic, trackThemeEvent } from '../../lib/api';
import { track } from '../../lib/track';
import { setActiveProfileFields } from '../../lib/profileStore';
import GlassPanel from '../../components/GlassPanel';
const AppHeader = React.lazy(() => import('../../components/AppHeader'));
import DishGrid from './HomeDishGrid';
const HomeSectionCarousel = React.lazy(() => import('../../components/home/HomeSectionCarousel'));

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
    try {
      window.dispatchEvent(new Event('bw:profile:update'));
    } catch {}
    return true;
  }
  return false;
}

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

  // task signal
  function addAndTrack({ id, name }: { id: string; name: string }) {
    add({ id, name });
    emit('bw:dish:add', { id, name });
  }
  const addById = useCallback(
    (id: string) => {
      const hit = DISH_CATALOG.find((d: any) => String(d.id) === String(id));
      addAndTrack({ id, name: hit?.name || 'Item' });
    },
    [add]
  );
  function onDishSelect(id: string) {
    setSelectedId((cur) => (cur === id ? null : id));
    emit('bw:dish:browse', { id });
  }

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLocModalOpen, setLocModalOpen] = useState(false);
  const [profile, setProfile] = useState(() => getActiveProfile());
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelSuggestion, setLabelSuggestion] = useState<string>('Home');
  const QUICK_LABELS = ['Home', 'Work', 'PG', 'Parents', 'Friend'];
  const [theme, setTheme] = useState<SeasonalTheme | null>(() => resolveSeasonalTheme());
  const [themes, setThemes] = useState<SeasonalTheme[]>(() => listActiveThemes());
  const [themeIndex, setThemeIndex] = useState(0);
  const [extraSections, setExtraSections] = useState({
    similar: [] as any[],
    brands: [] as any[],
    people: [] as any[],
    priceDrops: [] as any[],
  });

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

  // Build lightweight carousel data from catalog
  useEffect(() => {
    const imgFor = (d: any) => getDishImage(d.name, d.imageUrl, d.category) || d.imageUrl || placeholderDishUrl();
    const catalog = DISH_CATALOG.slice(0, 40);
    const similar = catalog.slice(0, 10).map((d) => ({
      id: String(d.id),
      title: d.name,
      image: imgFor(d),
    }));
    const people = catalog.slice(10, 22).map((d) => ({
      id: String(d.id),
      title: d.name,
      image: imgFor(d),
    }));
    const priceDrops = catalog.slice(5, 18).map((d, idx) => ({
      id: String(d.id),
      title: d.name,
      image: imgFor(d),
      discountLabel: `${10 + (idx % 4) * 5}% OFF`,
    }));
    const brandsMap = new Map<string, string>();
    catalog.forEach((d) => {
      const key = (d.cuisines && d.cuisines[0]) || d.category || 'Popular';
      if (!brandsMap.has(key)) brandsMap.set(key, imgFor(d));
    });
    const brands = Array.from(brandsMap.entries()).slice(0, 12).map(([title, image], i) => ({
      id: `brand-${i}`,
      title,
      image,
    }));
    setExtraSections({ similar, people, priceDrops, brands });
  }, []);

  // Re-evaluate seasonal theme every 6h
  useEffect(() => {
    const tick = () => {
      const active = listActiveThemes();
      setThemes(active);
      setTheme(resolveSeasonalTheme());
      if (active.length === 0) setThemeIndex(0);
      if (active.length > 0 && themeIndex >= active.length) setThemeIndex(0);
    };
    tick();
    const id = window.setInterval(tick, 6 * 60 * 60 * 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch remote themes (admin-managed) with fallback to static
  useEffect(() => {
    let alive = true;
    fetchThemesPublic()
      .then((data) => {
        if (!alive) return;
        if (Array.isArray(data) && data.length) {
          setThemes(data as SeasonalTheme[]);
          setTheme(data[0] as SeasonalTheme);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Light auto-rotate through active themes if more than one is active.
  useEffect(() => {
    if (themes.length <= 1) return;
    const id = window.setInterval(() => {
      setThemeIndex((i) => (i + 1) % themes.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [themes.length]);

  const currentTheme = themes.length ? themes[themeIndex % themes.length] : theme;

  // Track impression once per theme
  const seenThemes = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentTheme?.name) return;
    if (seenThemes.current.has(currentTheme.name)) return;
    seenThemes.current.add(currentTheme.name);
    trackThemeEvent(currentTheme.name, 'impression');
  }, [currentTheme?.name]);

  // ❌ Remove the older hard-coded redirect to location wizard on this flag.
  // (AppShell now routes to the correct first-needed permission.)
  // Keep this effect as a fallback (it routes to the *first* needed perm if a flag is still present)
  useEffect(() => {
    try {
      if (sessionStorage.getItem('bw.requirePermRecheck') === '1') {
        sessionStorage.removeItem('bw.requirePermRecheck');
        const needs = (['location', 'notifications', 'microphone'] as const)
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
    const wrapEnter = (e: Event) => {
      const q = ((e as CustomEvent).detail as string) || '';
      setQuery(q);
      track('search', { q, source: 'text' });
    };
    const wrapVoice = (e: Event) => {
      const q = ((e as CustomEvent).detail as string) || '';
      setQuery(q);
      track('search', { q, source: 'voice' });
    };
    window.addEventListener('bw:keyword:live', onLive as any);
    window.addEventListener('bw:keyword:search', wrapEnter as any);
    window.addEventListener('bw:voice:search', wrapVoice as any);
    return () => {
      window.removeEventListener('bw:keyword:live', onLive as any);
      window.removeEventListener('bw:keyword:search', wrapEnter as any);
      window.removeEventListener('bw:voice:search', wrapVoice as any);
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
        if (typeof meters === 'number') {
          // Auto-switch to nearest saved if within 300 m (even if >100 m)
          if (applyNearestSwitch(newLive)) {
            setLocationKey(`auto:${Date.now()}`);
            return;
          }
          if (meters < DISTANCE_THRESHOLD_M) {
            // between 100 and 300m but no switch (unlikely) → keep silent
            return;
          }
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
        if (applyNearestSwitch(coords)) {
          setLocationKey(`auto:${Date.now()}`);
          return;
        }
        if (typeof meters === 'number') {
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
      sessionStorage.setItem('bw.liveAddress.flow', 'live');
    } catch {}
    emit('bw:location:changed', { lat: livePos.lat, lng: livePos.lng });
    nav('/onboarding/address/pick', { replace: true });
  }

  /* ----- recent thumbnails for bottom CTA (sorted by cart updatedAt) ----- */
  const recentThumbs = useMemo(() => {
    const items = Object.values(itemsMap || {}) as any[];
    items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return items.slice(0, 3).map((entry) => {
      const key = String(entry.id);
      const cat = DISH_CATALOG.find((d: any) => String(d.id) === key) as any;
      const name = entry.name || cat?.name || '';
      const img = getDishImage(name, entry.imageUrl || cat?.imageUrl || null);
      return { id: key, name, img };
    });
  }, [itemsMap]);

  /* ----- UI ----- */
  return (
    <main className="min-h-screen text-white pb-32 px-3">
      <div className="max-w-4xl mx-auto w-full max-w-6xl px-3 pb-28">
        <Suspense fallback={<div className="h-32 w-full animate-pulse rounded-2xl bg-white/5" />}>
          <AppHeader />
        </Suspense>

        {/* Hero strip for modes */}
        <GlassPanel tone="dark" className="mt-4">
          <div className="bw-heading text-lg">Pick your savings mode</div>
          <p className="bw-subtitle text-sm mt-1">
            Add a dish and tap <b>Check availability</b> to see the best price/ETA on the same restaurant. Want options?
            Switch to <b>Alternatives</b> to compare the same dish across nearby restaurants.
          </p>
        </GlassPanel>

        {currentTheme && (
          <div
            className="mt-4 rounded-2xl p-4 shadow border border-white/10"
            style={{ background: currentTheme.gradient }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="text-sm uppercase tracking-[0.2em] text-white/70">
                  {currentTheme.name}
                </div>
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

        {/* Similar products preview strip */}
        {extraSections.similar.length > 0 && (
          <section className="px-4 mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white/90">Similar products</h2>
              <button className="flex items-center gap-1 text-xs font-medium text-teal-300" onClick={() => emit('bw:carousel:seeall', { section: 'similar' })}>
                See all <span className="text-base leading-none">›</span>
              </button>
            </div>
            <div className="flex items-center gap-3">
              {extraSections.similar.slice(0, 3).map((dish) => (
                <div
                  key={dish.id}
                  className="h-14 w-14 rounded-full overflow-hidden bg-slate-800 border border-white/10"
                >
                  <img
                    src={dish.image}
                    alt={dish.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        <Suspense fallback={null}>
          <HomeSectionCarousel title="Brands in this category" items={extraSections.brands} />
          <HomeSectionCarousel title="People also bought" items={extraSections.people} onAdd={addById} />
          <HomeSectionCarousel title="Price drop" items={extraSections.priceDrops} onAdd={addById} />
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
            <div className="flex flex-wrap gap-2 mt-3">
              {QUICK_LABELS.map((lbl) => (
                <button
                  key={lbl}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs border',
                    lbl === labelSuggestion ? 'bg-white text-black' : 'border-white/30 text-white/80 hover:bg-white/10',
                  ].join(' ')}
                  onClick={() => {
                    try {
                      sessionStorage.setItem('bw.labelPrompt.prefill', lbl);
                      sessionStorage.setItem('bw.liveAddress.flow', 'label');
                    } catch {}
                    setShowLabelModal(false);
                    nav('/onboarding/address/label');
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
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
          try {
            sessionStorage.setItem('bw.liveAddress.flow', 'label');
            sessionStorage.setItem('bw.labelPrompt.prefill', labelSuggestion || 'Home');
          } catch {}
          nav('/onboarding/address/label');
        }}
      >
        Label address
      </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
