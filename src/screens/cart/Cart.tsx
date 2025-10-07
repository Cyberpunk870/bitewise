// /src/screens/cart/Cart.tsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useCart from '../../store/cart';
import { DISH_CATALOG } from '../../data/dishCatalog';
import { getDishImage } from '../../lib/images';

type CartRow = {
  id: string;
  name: string;
  price: number | null; // null when unknown
  qty: number;
  image: string;
};

export default function Cart() {
  const nav = useNavigate();
  const { items, inc, dec, remove, clear } = useCart();

  // WHY: store may only keep id/qty; we enrich defensively from catalog
  const rows = useMemo<CartRow[]>(() => {
    return items.map(({ id, qty }) => {
      const dish = DISH_CATALOG.find(d => String(d.id) === String(id));
      const name = dish?.name ?? '(Unknown item)';
      const price =
        typeof dish?.price === 'number' && !Number.isNaN(dish.price)
          ? dish.price
          : null;
      const image = getDishImage(dish?.name ?? null, (dish as any)?.imageUrl ?? null);

      return { id: String(id), name, price, qty, image };
    });
  }, [items]);

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Your Cart</h1>
          <button
            className="text-sm underline"
            onClick={() => nav('/home')}
          >
            Continue shopping
          </button>
        </div>

        {/* empty state */}
        {rows.length === 0 ? (
          <p className="opacity-70">Your cart is empty.</p>
        ) : (
          <ul className="space-y-4">
            {rows.map(r => (
              <li key={r.id} className="flex gap-3 items-center border rounded-xl p-3">
                <img
                  src={r.image}
                  alt={r.name}
                  loading="lazy"
                  className="w-20 h-16 object-cover rounded-lg bg-white"
                />

                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-sm opacity-70">
                    {r.price !== null ? `₹${r.price.toFixed(2)}` : '—'}
                  </div>
                </div>

                {/* qty controls */}
                <div className="flex items-center gap-2">
                  <button
                    className="px-2 py-1 border rounded"
                    onClick={() => dec(r.id)}
                  >
                    −
                  </button>
                  <div className="w-8 text-center">{r.qty}</div>
                  <button
                    className="px-2 py-1 border rounded"
                    onClick={() => inc(r.id)}
                  >
                    +
                  </button>
                </div>

                <button
                  className="ml-2 text-sm underline opacity-70"
                  onClick={() => remove(r.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* actions */}
        {rows.length > 0 && (
          <div className="mt-6 flex gap-2">
            <button
              className="px-4 py-2 rounded-xl border"
              onClick={() => clear()}
            >
              Clear cart
            </button>

            <button
              className="px-4 py-2 rounded-xl bg-black text-white"
              onClick={() => nav('/availability')}
            >
              Check availability
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
