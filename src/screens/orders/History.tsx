// src/screens/orders/History.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrders } from '../../lib/api'; // <-- backend fetch

type OrderRow = {
  id: string;
  platform: string;
  restaurant?: string;
  platform_price?: number;
  saved_amount?: number;
  created_at?: string;
  completed_at?: string;
};

export default function History() {
  const nav = useNavigate();
  const [list, setList] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resp = await getOrders(); // calls /api/orders with bearer token
        // backend returns { ok: true, data: OrderEventDoc[] }
        if (resp && resp.ok && Array.isArray(resp.data)) {
          if (!alive) return;
          setList(resp.data as OrderRow[]);
        } else {
          if (!alive) return;
          setList([]);
        }
      } catch {
        if (!alive) return;
        setList([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-4">
          <button
            className="px-3 py-1.5 text-sm rounded-full border bg-white/80"
            onClick={() => nav(-1)}
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold text-white drop-shadow">
            Order history
          </h1>
          <div className="w-16" />
        </header>

        <div className="rounded-xl bg-white shadow divide-y">
          {loading ? (
            <div className="p-6 text-sm text-center text-gray-500">
              Loading…
            </div>
          ) : list.length === 0 ? (
            <div className="p-6 text-sm text-center text-gray-500">
              No orders yet. After you place on Swiggy/Zomato and tap
              “I placed it”, it’ll appear here.
            </div>
          ) : (
            list.map((o) => {
              const ts = o.completed_at || o.created_at;
              const when = ts ? new Date(ts).toLocaleString() : '';
              const total = typeof o.platform_price === 'number'
                ? o.platform_price
                : undefined;
              const saved = typeof o.saved_amount === 'number'
                ? o.saved_amount
                : undefined;
              return (
                <div
                  key={o.id}
                  className="p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium capitalize">
                      {o.platform || '—'}
                      {o.restaurant ? ` • ${o.restaurant}` : ''}
                    </div>
                    <div className="text-xs opacity-60">{when}</div>
                  </div>

                  <div className="text-right">
                    {typeof total === 'number' && (
                      <div className="text-sm">₹{total.toFixed(2)}</div>
                    )}
                    {typeof saved === 'number' && saved > 0 && (
                      <div className="text-xs text-emerald-600">
                        Saved ₹{saved.toFixed(0)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}