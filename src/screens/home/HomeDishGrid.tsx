import React, {
  memo,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DISH_CATALOG } from '../../data/dishCatalog';
import { getDishImage, getPictureSources, placeholderDishUrl } from '../../lib/images';
import { inferCategory } from '../../data/categoryImages';
import type { FilterState, TabKey } from './types';

type DishVM = { id: string; name: string; cuisine?: string; rating?: number; image: string };

type Props = {
  activeTab: TabKey;
  query: string;
  filters: FilterState;
  locationKey: string;
  itemsMap: Record<string, any>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (input: { id: string; name: string }) => void;
  onDec: (id: string) => void;
  dishes?: any[];
};

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
  const sources = getPictureSources(d.image || placeholderDishUrl());
  return (
    <div
      className={[
        'group relative w-full max-w-[360px] mx-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl text-white shadow-lg shadow-black/30 p-3 transition h-full',
        selected ? 'ring-2 ring-white/70' : '',
      ].join(' ')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      style={{ contain: 'layout paint size', containIntrinsicSize: '300px 360px' } as any}
      onClick={onSelect}
    >
      <div className="relative w-full rounded-xl overflow-hidden mb-2 aspect-[16/9] bg-white/5">
        <picture className="absolute inset-0 h-full w-full">
          {sources.avif && <source srcSet={sources.avif} type="image/avif" />}
          {sources.webp && <source srcSet={sources.webp} type="image/webp" />}
          <img
            src={sources.fallback}
            className="absolute inset-0 h-full w-full object-cover object-center"
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'low'}
            decoding="async"
            sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
            onError={(e) => {
              const el = (e.currentTarget as HTMLImageElement)!;
              const ph = placeholderDishUrl();
              if (!el.src.endsWith(ph)) el.src = ph;
            }}
            alt={d.name}
          />
        </picture>
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
      <div className="mt-1 space-y-1 min-h-[48px]">
        <p className="font-semibold text-white leading-snug">{d.name}</p>
        {d.cuisine ? <p className="text-sm text-white/70">{d.cuisine}</p> : null}
        {typeof d.rating === 'number' && (
          <p className="text-sm flex items-center gap-2 text-white/80">
            <span className="text-yellow-300"><Stars value={d.rating} /></span>
            <span>{d.rating.toFixed(1)}</span>
          </p>
        )}
      </div>
    </div>
  );
});

export default function HomeDishGrid({
  activeTab,
  query,
  filters,
  locationKey,
  itemsMap,
  selectedId,
  onSelect,
  onAdd,
  onDec,
  dishes,
}: Props) {
  const deferredQuery = useDeferredValue(query);
  const deferredFilters = useDeferredValue(filters);
  const deferredItems = useDeferredValue(itemsMap);
  const deferredLocationKey = useDeferredValue(locationKey);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null =null;
    let idleId: number | null = null;
    const mark = () => setHydrated(true);
    if ('requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(
        () => {
          idleId = null;
          mark();
        },
        { timeout: 2000 }
      );
    } else {
      timeoutId = setTimeout(() => {
        timeoutId = null;
        mark();
      }, 1500);
    }

    return () => {
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }

      if ( idleId != null &&
        'cancelIdleCallback' in window && typeof (window as any).cancelIdleCallback === 'function') {
          (window as any).cancelIdleCallback(idleId);
        } 
    };
  }, []);

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
    if (deferredFilters) {
      const { priceMax, ratingMin, distanceMax } = deferredFilters;
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
    if (deferredQuery.trim()) {
      const q = deferredQuery.trim().toLowerCase();
      list = list.filter((d: any) => d.name.toLowerCase().includes(q));
    }
    return (list as any[]).map((d: any) => ({
      id: String(d.id),
      name: d.name,
      cuisine: d.cuisine,
      rating: d.rating,
      image: getDishImage(d.name, d.imageUrl, d.category || inferCategory(d.name)),
    })) as DishVM[];
  }, [activeTab, deferredQuery, deferredFilters, deferredLocationKey, deferredItems]);

  const limitedList = hydrated ? visibleDishes : visibleDishes.slice(0, 6);
  const qtyOf = (id: string | number) => (itemsMap as any)?.[String(id)]?.qty ?? 0;

  return (
    <section
      id="home-dish-grid"
      className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-6"
    >
      {limitedList.map((d, idx) => {
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
            onSelect={() => onSelect(id)}
            onInc={() => onAdd({ id, name: d.name })}
            onDec={() => onDec(id)}
            onAddFirst={() => onAdd({ id, name: d.name })}
          />
        );
      })}
    </section>
  );
}
