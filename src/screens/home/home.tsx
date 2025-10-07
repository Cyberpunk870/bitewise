// /src/screens/home/Home.tsx
import React, { useEffect, useMemo, useRef, useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../../components/AppHeader';
import useCart from '../../store/cart';
import { DISH_CATALOG, allDishNames } from '../../data/dishCatalog';
import { getDishImage, placeholderDishUrl } from '../../lib/images';
import {
  ensureActiveProfile,
  getActiveProfile,
  setActiveProfileFields,
} from '../../lib/profileStore';
import {
  getCurrentPosition,
  haversineMeters,
  reverseGeocode,
  deriveAddressLabel,
} from '../../lib/location';
import { decidePerm } from '../../lib/permPrefs';
import { emit } from '../../lib/events';
import TopBanner from '../../components/TopBanner';

// Optional: notifications helper (if present)
let pushNotice: undefined | ((n: any) => void);
try { pushNotice = require('../../lib/notifications').pushNotice; } catch {}

const DISTANCE_THRESHOLD_M = 300; // prompt when moved this much
const CELL_PRECISION = 2;         // area cell precision for silent updates

/* ----- tiny stars ----- */
function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-[14px] w-[14px] inline-block align-[-1px]">
      <path d="M10,2 11.7,7 16,7.4 14.3,10.3 13.6,15.5 10,16.5 5.7,13 6.6,8.4 7.7,7.16"
        fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1" />
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
      <path d="M10,2 11.7,7 16,7.4 14.3,10.3 13.6,15.5 10,16.5 5.7,13 6.6,8.4 7.7,7.16"
        fill="url(#halfFill)" stroke="currentColor" strokeWidth="1" />
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
      {Array.from({ length: full }).map((_, i) => <Star key={`s${i}`} filled />)}
      {half ? <StarHalf key="half" /> : null}
      {Array.from({ length: empty }).map((_, i) => <Star key={`e${i}`} filled={false} />)}
    </>
  );
}

/* ----- types ----- */
type TabKey = 'all' | 'popular' | 'frequent' | 'value';
type DishVM = { id: string; name: string; cuisine?: string; rating?: number; image: string };

/* ----- memoised card ----- */
const DishCard = memo(function DishCard({
  d, qty, onInc, onDec, onAddFirst, selected, onSelect,
}: {
  d: DishVM; qty: number; onInc: () => void; onDec: () => void;
  onAddFirst: () => void; selected: boolean; onSelect: () => void;
}) {
  return (
    <div
      className={[
        'group relative rounded-2xl bg-white/90 shadow border p-3 transition',
        selected ? 'ring-2 ring-black' : '',
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
          loading="lazy" decoding="async"
          sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
          onError={(e) => {
            const el = (e.currentTarget as HTMLImageElement)!;
            const ph = placeholderDishUrl();
            if (!el.src.endsWith(ph)) el.src = ph;
          }}
          alt={d.name}
        />
        {selected && (
          <div className="absolute inset-0 bg-black/30 flex items-end justify-center p-3 gap-2">
            {qty > 0 ? (
              <div
                className="grid grid-cols-[36px,40px,36px] items-center gap-2 bg-white rounded-full px-2 py-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button className="px-3 text-xl leading-none" onClick={onDec}>-</button>
                <div className="text-center select-none">{qty}</div>
                <button className="px-3 text-xl leading-none" onClick={onInc}>+</button>
              </div>
            ) : (
              <button type="button" className="text-sm w-full rounded-xl border px-3 py-2 bg-white" onClick={onAddFirst}>
                Add to cart
              </button>
            )}
          </div>
        )}
      </div>
      <p className="font-medium">{d.name}</p>
      {d.cuisine ? <p className="text-sm opacity-70">{d.cuisine}</p> : null}
      {typeof d.rating === 'number' && (
        <p className="text-sm mt-1 flex items-center gap-2">
          <span className="text-yellow-500"><Stars value={d.rating} /></span>
          <span className="opacity-70">{d.rating.toFixed(1)}</span>
        </p>
      )}
    </div>
  );
});

export default function Home() {
  const nav = useNavigate();
  const { add, dec, itemsMap, count, remove } = useCart();
  const recentRef = useRef<string[]>([]);
  function pushRecent(id: string) {
    const arr = recentRef.current.filter((x) => x !== id);
    arr.push(id);
    while (arr.length > 6) arr.shift();
    recentRef.current = arr;
  }
  function addAndTrack({ id, name }: { id: string; name: string }) {
    add({ id });
    pushRecent(String(id));
  }
  function onDishSelect(id: string) {
    setSelectedId((cur) => (cur === id ? null : id));
    emit('bw:dish:browse', { id });
  }

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<{ priceMax?: number; ratingMin?: number; distanceMax?: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [isLocModalOpen, setLocModalOpen] = useState(false);
  const live = useRef<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [actLabel, setActLabel] = useState<string | null>(null);
  const [locationKey, setLocationKey] = useState<string>('init');

  const [banner, setBanner] = useState<string | null>(null);
  const liveTimer = useRef<number | null>(null);

  /* ----- helpers ----- */
  const sameCell = (a: {lat:number,lng:number}, b:{lat:number,lng:number}) =>
    a && b &&
    a.lat.toFixed(CELL_PRECISION) === b.lat.toFixed(CELL_PRECISION) &&
    a.lng.toFixed(CELL_PRECISION) === b.lng.toFixed(CELL_PRECISION);

  const deriveAreaFromCoords = (lat: number, lng: number): string => {
    const cellLat = Number(lat.toFixed(CELL_PRECISION));
    const cellLng = Number(lng.toFixed(CELL_PRECISION));
    return `${cellLat.toFixed(CELL_PRECISION)}_${cellLng.toFixed(CELL_PRECISION)}`;
  };

  /* ----- startup wiring ----- */
  useEffect(() => { ensureActiveProfile(); }, []);
  useEffect(() => {
    try { window.dispatchEvent(new CustomEvent('bw:dishes:names', { detail: allDishNames() })); } catch {}
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

  /* ----- live location check (no rounding on save) ----- */
  useEffect(() => {
    let cancelled = false;

    async function checkLive() {
      const pref = decidePerm('location');
      if (pref === 'deny') return;

      const livePos = await getCurrentPosition(5000);
      if (cancelled || !livePos) return;

      // keep full precision in memory
      live.current = { lat: livePos.lat, lng: livePos.lng };

      const saved = getActiveProfile();
      if (!saved || typeof saved.lat !== 'number' || typeof saved.lng !== 'number') {
        const addrStr = await reverseGeocode(livePos);
        setActLabel(deriveAddressLabel(addrStr));
        setLocModalOpen(true);
        setBanner('Location detected. Update to refine results.');
        pushNotice?.({
          id: 'n-' + crypto.randomUUID(),
          ts: Date.now(),
          title: 'Location detected',
          body: 'Use current location to see accurate availability.',
          kind: 'system',
        });
        return;
      }

      const moved = haversineMeters({ lat: saved.lat, lng: saved.lng }, livePos);

      // Silent refresh if still in the same area "cell"
      if (sameCell(saved, livePos) && moved < DISTANCE_THRESHOLD_M) {
        // silently update address line/label (no modal)
        const addrStr = await reverseGeocode(livePos);
        const label2 = deriveAddressLabel(addrStr);
        setActiveProfileFields({ lat: livePos.lat, lng: livePos.lng, addressLine: addrStr, addressLabel: label2 });
        setLocationKey(`${livePos.lat}_${livePos.lng}:${Date.now()}`);
        setBanner('Updated to your current location.');
        return;
      }

      if (moved >= DISTANCE_THRESHOLD_M) {
        const addrStr = await reverseGeocode(livePos);
        setActLabel(deriveAddressLabel(addrStr));
        setLocModalOpen(true);
        setBanner('Location changed. Update before comparing for accurate results.');
        pushNotice?.({
          id: 'n-' + crypto.randomUUID(),
          ts: Date.now(),
          title: 'Location changed',
          body: 'Your live location differs from saved one. Update before comparing prices.',
          kind: 'system',
        });
      }
    }

    checkLive();
    return () => { cancelled = true; };
  }, []);

  /* ----- visible list ----- */
  const visibleDishes = useMemo(() => {
    let list = DISH_CATALOG.slice(0);
    switch (activeTab) {
      case 'popular':
        list = list.filter((d: any) => d.popular === true || (d.tags || []).includes('popular')); break;
      case 'frequent':
        list = list.filter((_: any, i: number) => i % 2 === 0); break;
      case 'value':
        list = list.filter((d: any) => typeof d.price === 'number' && d.price < 200); break;
      default: break;
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
  }, [activeTab, query, filters, locationKey]);

  /* ----- other helpers ----- */
  const qtyOf = (id: string | number) => itemsMap?.[String(id)]?.qty ?? 0;

  async function onLocationChanged(saveAsDefault = true) {
    const p = live.current;
    if (!p || p.lat == null || p.lng == null) return;

    const addrStr = await reverseGeocode({ lat: p.lat, lng: p.lng });
    const label2 = deriveAddressLabel(addrStr);

    // Save as current default address
    if (saveAsDefault) {
      setActiveProfileFields({
        lat: p.lat, lng: p.lng, addressLine: addrStr, addressLabel: (label2 && label2.trim()) || label2!,
      });
      setLocationKey(`${p.lat}_${p.lng}:${Date.now()}`);
    }

    // cleanup cart for out-of-area items
    setTimeout(() => {
      const items = useCart.getState().itemsMap || {};
      const active = getActiveProfile();
      const area = active ? deriveAreaFromCoords(active.lat, active.lng) : null;
      const visibleIds = new Set(
        (DISH_CATALOG || [])
          .filter((d: any) => {
            if (!area) return true;
            const zones = (d as any).serviceAreas || (d as any).zones;
            if (Array.isArray(zones) && zones.length) return zones.includes(area);
            const city = (d as any).city;
            if (typeof city === 'string' && city)
              return (area as string).toLowerCase().includes(city.toLowerCase());
            return true;
          })
          .map((d: any) => String(d.id))
      );
      Object.keys(items).forEach((id) => { if (!visibleIds.has(String(id))) remove(String(id)); });
    }, 0);
  }

  // “Check availability” is now permission + movement aware
  async function onCheckAvailabilityClick(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const policy = decidePerm('location');
    if (policy === 'deny') {
      setBanner('Location is off. Manage it in Settings to get accurate results.');
      pushNotice?.({
        id: 'n-' + crypto.randomUUID(),
        ts: Date.now(),
        title: 'Location disabled',
        body: 'Turn on location in Settings to compare nearby restaurants.',
        kind: 'system',
      });
      return;
    }

    try {
      const livePos = await getCurrentPosition(5000);
      const saved = getActiveProfile();
      if (livePos && saved?.lat != null && saved?.lng != null) {
        const moved = haversineMeters({ lat: saved.lat, lng: saved.lng }, livePos);
        if (moved >= DISTANCE_THRESHOLD_M) {
          const addrStr = await reverseGeocode(livePos);
          setActLabel(deriveAddressLabel(addrStr));
          live.current = { lat: livePos.lat, lng: livePos.lng };
          setLocModalOpen(true);
          setBanner('Location changed. Update before comparing for accurate results.');
          pushNotice?.({
            id: 'n-' + crypto.randomUUID(),
            ts: Date.now(),
            title: 'Location changed',
            body: 'Your live location differs from saved one. Update before comparing prices.',
            kind: 'system',
          });
          return;
        }
      }
    } catch {}
    nav('/availability');
  }

  /* ----- recent thumbnails for bottom CTA ----- */
  const recentThumbs = useMemo(() => {
    const ids = recentRef.current.length ? recentRef.current : Object.keys(itemsMap || {});
    const last3 = ids.slice(-3);
    return last3.map((id) => {
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
    <main className="min-h-screen bg-gradient-to-br from-pink-500 to-orange-400">
      <div className="max-w-4xl mx-auto w-full max-w-6xl px-3 pb-28">
        <AppHeader />

        {/* Top ephemeral banner */}
        {banner && <TopBanner text={banner} onDone={() => setBanner(null)} />}

        {/* Tabs */}
        <div className="mt-4 flex gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'popular', label: 'Popular' },
            { key: 'frequent', label: 'Frequently Ordered' },
            { key: 'value', label: 'Best Offers' },
          ].map((t: { key: TabKey; label: string }) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as TabKey)}
              className={[
                'px-3 py-1.5 rounded-full text-sm border transition',
                activeTab === t.key ? 'bg-black text-white border-black' : 'bg-white/70 border-black/20',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Dish grid */}
        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleDishes.map((d) => {
            const id = String(d.id);
            const qty = qtyOf(id);
            return (
              <DishCard
                key={id}
                d={d}
                qty={qty}
                selected={selectedId === id}
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
                  <img key={t.id} src={t.img} alt={t.name} className="w-7 h-7 rounded-full object-cover border bg-white" />
                ))}
              </div>
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded-full bg-black text-white"
                onClick={onCheckAvailabilityClick}
              >
                Check availability
              </button>
            </div>
          </div>
        )}

        {/* Location modal */}
        {isLocModalOpen && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/40">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
              <div className="rounded-2xl border bg-white p-4">
                <p className="font-semibold mb-2">Use current location?</p>
                <p className="text-sm opacity-70 mb-4">
                  We found a location {actLabel ? `(~${actLabel})` : ''}. This adjusts menus near your saved address.
                </p>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => setLocModalOpen(false)}>
                    Not now
                  </button>
                  <button
                    className="rounded-xl border px-3 py-2 text-sm"
                    onClick={async () => {
                      // QUICK SAVE AS NEW ADDRESS (go to label)
                      const p = live.current;
                      if (p && p.lat != null && p.lng != null) {
                        const addrStr = await reverseGeocode({ lat: p.lat, lng: p.lng });
                        const label2 = deriveAddressLabel(addrStr);
                        sessionStorage.setItem(
                          'bw.quickAddress',
                          JSON.stringify({ lat: p.lat, lng: p.lng, addressLine: addrStr, addressLabel: label2 })
                        );
                        setLocModalOpen(false);
                        // Jump into labeling screen; it should read bw.quickAddress.
                        nav('/onboarding/address/label?from=home');
                      }
                    }}
                  >
                    Save as address
                  </button>
                  <button
                    className="rounded-xl border px-3 py-2 text-sm bg-black text-white"
                    onClick={async () => {
                      await onLocationChanged(true);
                      setLocModalOpen(false);
                    }}
                  >
                    Use current
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
