// src/components/home/HomeSectionCarousel.tsx
import React from 'react';

export type MiniItem = {
  id: string;
  title: string;
  image: string;
  rating?: number;
  discountLabel?: string;
};

type MiniCardProps = {
  item: MiniItem;
  onAdd?: (input: { id: string; name: string }) => void;
};

function MiniProductCard({ item, onAdd }: MiniCardProps) {
  return (
    <div className="w-32 shrink-0 rounded-2xl border border-white/10 bg-white/5 text-white shadow-lg shadow-black/20 overflow-hidden flex flex-col h-full">
      <div className="aspect-[1/1] w-full overflow-hidden bg-white/5">
        <img
          src={item.image}
          alt={item.title}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="px-2 pt-2 pb-1 space-y-1 flex-1 flex flex-col">
        <p className="text-[11px] font-semibold leading-tight line-clamp-2">{item.title}</p>
        {item.discountLabel ? (
          <p className="text-[10px] text-emerald-300 font-semibold">{item.discountLabel}</p>
        ) : null}
      </div>
      <div className="px-2 pb-2 mt-auto pt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          className="px-4 py-1 rounded-full border border-emerald-400 text-[11px] font-semibold text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/25 flex-1 text-center"
          onClick={() => onAdd?.({ id: item.id, name: item.title })}
        >
          ADD
        </button>
      </div>
    </div>
  );
}

type Props = {
  title: string;
  subtitle?: string;
  items: MiniItem[];
  onSeeAll?: () => void;
  onAdd?: (input: { id: string; name: string }) => void;
};

export default function HomeSectionCarousel({ title, subtitle, items, onSeeAll, onAdd }: Props) {
  if (!items.length) return null;
  return (
    <section className="mt-4">
      <div className="flex items-baseline justify-between px-4 mb-2">
        <div>
          <h2 className="text-[15px] font-semibold text-white">{title}</h2>
          {subtitle ? <p className="text-[11px] text-white/60">{subtitle}</p> : null}
        </div>
        {onSeeAll ? (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-[11px] font-semibold text-white/80 px-3 py-1 rounded-full border border-white/20 hover:bg-white/10"
          >
            See all
          </button>
        ) : null}
      </div>
      <div className="px-4">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {items.map((item) => (
            <MiniProductCard key={item.id} item={item} onAdd={onAdd} />
          ))}
        </div>
      </div>
    </section>
  );
}
