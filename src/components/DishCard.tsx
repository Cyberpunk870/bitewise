  // src/components/DishCard.tsx
  import { memo } from 'react';
  
  export type DishVM = {
    id: string | number;
    name: string;
    cuisine?: string;
    rating?: number;
    image: string;
  };
  
  type Props = {
    d: DishVM;
    qty: number;
    onInc: (id: string | number) => void;
    onDec: (id: string | number) => void;
    onAddFirst: (id: string | number, name: string) => void;
    selected: boolean;
    onSelect: (id: string | number) => void;
  };
  
  /**
   * WHY: CTA lives in an overlay that appears when the card is "selected".
  * Buttons stop propagation so tapping them doesn't toggle selection.
  */
  const DishCard = memo(function DishCard({
    d,
    qty,
    onInc,
    onDec,
    onAddFirst,
    selected,
    onSelect,
  }: Props) {
    return (
      <div
        className={[
          'group relative rounded-2xl bg-white/10 text-white border border-white/15 backdrop-blur transition shadow-lg',
          selected ? 'ring-2 ring-white/70' : '',
        ].join(' ')}
        onClick={() => onSelect(d.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onSelect(d.id)}
        style={{ contain: 'content' }}
      >
        {/* 4:3 media box */}
        <div className="relative w-full rounded-xl overflow-hidden mb-2 pb-[75%]">
          <img
            src={d.image}
            alt={d.name}
            className="absolute inset-0 h-full w-full object-cover object-center"
            loading="lazy"
          />
          {/* CTA overlay */}
          {selected && (
            <div className="absolute inset-0 bg-black/30 flex items-end justify-center p-3 z-20">
              {qty <= 0 ? (
                <button
                  className="px-4 py-2 rounded-xl bg-white text-black font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddFirst(d.id, d.name);
                  }}
                >
                  Add to cart
                </button>
              ) : (
                <div
                  className="flex items-center gap-3 bg-white rounded-full px-3 py-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button className="px-3 text-xl leading-none" onClick={() => onDec(d.id)}>
                    −
                  </button>
                  <span className="min-w-6 text-center">{qty}</span>
                  <button className="px-3 text-xl leading-none" onClick={() => onInc(d.id)}>
                    +
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
  
        <p className="text-sm font-medium truncate text-white">{d.name}</p>
        {d.cuisine ? (
          <p className="text-xs text-white/70">{d.cuisine}</p>
        ) : null}
      </div>
    );
  });
  
  export default DishCard;
