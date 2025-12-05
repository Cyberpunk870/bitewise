// src/screens/cart/Cart.tsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useCart from '../../store/cart';
import { DISH_CATALOG } from '../../data/dishCatalog';
import { getDishImage } from '../../lib/images';
import { inferCategory } from '../../data/categoryImages';

type CartRow = {
  id: string;
  name: string;
  price: number | null; // null when unknown
  qty: number;
  image: string;
};

export default function Cart() {
  const nav = useNavigate();
  const { items, add, dec, remove, clear } = useCart();

  const rows = useMemo<CartRow[]>(() => {
    return items.map(({ id, name, qty }) => {
      const dish = DISH_CATALOG.find((d) => String((d as any).id) === String(id));
      const resolvedName = dish?.name ?? name ?? 'Saved dish';
      const rawPrice = (dish as any)?.price;
      const price = typeof rawPrice === 'number' && !Number.isNaN(rawPrice) ? rawPrice : null;
      const image = getDishImage(
        resolvedName,
        (dish as any)?.imageUrl ?? null,
        (dish as any)?.category || inferCategory(resolvedName)
      ) || '';
      return { id: String(id), name: resolvedName, price, qty, image };
    });
  }, [items]);

  const subtotal = rows.reduce((sum, r) => sum + ((r.price ?? 0) * r.qty), 0);
  const serviceFee = rows.length ? Math.max(5, Math.round(subtotal * 0.02)) : 0;
  const total = subtotal + serviceFee;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#050915] via-[#0b1224] to-[#120a1f] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/60">Cart</p>
            <h1 className="text-2xl font-semibold mt-1">Your picks</h1>
          </div>
          <button
            className="text-sm rounded-full border border-white/15 px-4 py-2 hover:bg-white/10"
            onClick={() => nav('/home')}
          >
            Continue browsing
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="glass-card border-white/10 text-white/80 px-5 py-8 text-center">
            Your cart is empty. Add a dish to compare delivery apps.
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <div key={r.id} className="glass-card border-white/10 flex flex-col sm:flex-row gap-4 p-4">
                <img
                  src={r.image}
                  alt={r.name}
                  className="w-full sm:w-32 h-32 rounded-2xl object-cover"
                  loading="lazy"
                />
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-lg">{r.name}</h2>
                      <p className="text-sm text-white/60">
                        {r.price !== null ? `₹${r.price.toFixed(2)} each` : 'Price will appear at checkout'}
                      </p>
                    </div>
                    <button className="text-xs text-white/60 hover:text-white" onClick={() => remove(r.id)}>
                      Remove
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center rounded-full border border-white/20 bg-white/5 px-2 py-1">
                      <button className="px-3 py-1 text-xl" onClick={() => dec(r.id)}>
                        −
                      </button>
                      <span className="text-base font-semibold w-8 text-center">{r.qty}</span>
                      <button className="px-3 py-1 text-xl" onClick={() => add({ id: r.id, name: r.name, qty: 1 })}>
                        +
                      </button>
                    </div>
                    <div className="text-right text-lg font-semibold">
                      {r.price !== null ? `₹${(r.price * r.qty).toFixed(2)}` : '—'}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="glass-card border-white/10 p-5 space-y-3">
              <div className="flex items-center justify-between text-sm text-white/70">
                <span>Items</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-white/70">
                <span>Service fee</span>
                <span>₹{serviceFee.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/10 font-semibold text-lg">
                <span>Total</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
              <div className="text-xs text-white/60">Taxes calculated on the delivery partner app.</div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button className="flex-1 rounded-full border border-white/15 px-4 py-2 text-sm" onClick={() => clear()}>
                  Clear cart
                </button>
                <button
                  className="flex-1 rounded-full bg-gradient-to-r from-amber-200 via-rose-300 to-purple-400 text-black font-semibold px-4 py-2"
                  onClick={() => nav('/availability')}
                >
                  Compare delivery apps
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
