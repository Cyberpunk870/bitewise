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
        'bg-white/6 rounded-3xl border border-white/10 overflow-hidden flex flex-col text-white shadow-lg shadow-black/30 transition',
        selected ? 'ring-2 ring-white/70' : '',
      ].join(' ')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      style={{ contain: 'layout paint size' } as any}
      onClick={onSelect}
    >
      <div className="w-full aspect-[4/3] overflow-hidden bg-white/5">
        <picture className="block h-full w-full">
          {sources.avif && <source srcSet={sources.avif} type="image/avif" />}
          {sources.webp && <source srcSet={sources.webp} type="image/webp" />}
          <img
            src={sources.fallback}
            className="w-full h-full object-cover object-center"
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'low'}
            decoding="async"
            sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              const ph = placeholderDishUrl();
              if (!el.src.endsWith(ph)) el.src = ph;
            }}
            alt={d.name}
          />
        </picture>
      </div>

      <div className="flex-1 px-3 pt-2 pb-1 flex flex-col gap-1">
        <p className="text-[13px] font-semibold leading-tight line-clamp-2">{d.name}</p>
        {d.cuisine ? <p className="text-[11px] text-white/60">{d.cuisine}</p> : null}
        {typeof d.rating === 'number' && (
          <div className="flex items-center gap-1 text-[11px] text-white/70">
            <span className="text-yellow-300"><Stars value={d.rating} /></span>
            <span>{d.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="px-3 pb-3">
        {qty > 0 ? (
          <div className="w-full h-8 rounded-full border border-emerald-400 bg-emerald-500/10 flex items-center justify-between px-3 text-[13px] font-semibold">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDec();
              }}
              className="px-1"
            >
              -
            </button>
            <span className="select-none">{qty}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInc();
              }}
              className="px-1"
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddFirst();
            }}
            className="w-full h-8 rounded-full border border-emerald-400 text-[12px] font-semibold text-emerald-300 bg-black/10 hover:bg-black/20 flex items-center justify-center"
          >
            ADD
          </button>
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
}: Props) {
  const deferredQuery = useDeferredValue(query);
  const deferredFilters = useDeferredValue(filters);
  const deferredItems = useDeferredValue(itemsMap);
  const deferredLocationKey = useDeferredValue(locationKey);
  const [hydrated, setHydrated] = useState(false);

useEffect(() => {
    let idleHandle: ReturnType<typeof setTimeout> | number | null = null;
    const mark = () => setHydrated(true);
    if ('requestIdleCallback' in window) {
      idleHandle = (window as any).requestIdleCallback(
        () => {
          idleHandle = null;
          mark();
        },
        { timeout: 2000 }
      );
    } else {
      idleHandle = setTimeout(() => {
        idleHandle = null;
        mark();
      }, 1500);
    }
    return () => {
      if (idleHandle != null) {
        if ('cancelIdleCallback' in window && typeof (window as any).cancelIdleCallback === 'function') {
          (window as any).cancelIdleCallback(idleHandle);
        } else {
          clearTimeout(idleHandle);
        }
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

  // Debug: surface runtime state to diagnose empty grid
  console.log('home-dish-grid', {
    catalog: DISH_CATALOG.length,
    visible: visibleDishes.length,
    hydrated,
    query,
    filters,
  });

  return (
    <>
      <section
        id="home-dish-grid"
        className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 px-4 pb-6 items-stretch"
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
      {!hydrated && visibleDishes.length > 6 && (
        <p className="mt-2 text-xs text-white/60">Loading more dishes…</p>
      )}
    </>
  );
}
