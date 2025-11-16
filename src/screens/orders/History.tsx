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
    <main className="min-h-screen px-4 py-6 text-white">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <button
            className="px-3 py-1.5 text-sm rounded-full border border-white/20 bg-white/10 hover:bg-white/20 transition"
            onClick={() => nav(-1)}
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold">Order history</h1>
          <div className="w-16" />
        </header>

        <div className="glass-card border border-white/10 divide-y divide-white/10">
          {loading ? (
            <div className="p-6 text-sm text-center text-white/70">Loading…</div>
          ) : list.length === 0 ? (
            <div className="p-6 text-sm text-center text-white/70">
              No orders yet. After you place on Swiggy/Zomato and tap “I placed it”, it’ll appear here.
            </div>
          ) : (
            list.map((o) => {
              const ts = o.completed_at || o.created_at;
              const when = ts ? new Date(ts).toLocaleString() : '';
              const total =
                typeof o.platform_price === 'number' ? o.platform_price : undefined;
              const saved =
                typeof o.saved_amount === 'number' ? o.saved_amount : undefined;
              return (
                <div
                  key={o.id}
                  className="p-4 flex items-center justify-between gap-4 bg-white/5"
                >
                  <div>
                    <div className="text-sm font-semibold capitalize text-white">
                      {o.platform || '—'}
                      {o.restaurant ? ` • ${o.restaurant}` : ''}
                    </div>
                    <div className="text-xs text-white/60">{when}</div>
                  </div>
                  <div className="text-right">
                    {typeof total === 'number' && (
                      <div className="text-sm font-semibold text-white">₹{total.toFixed(0)}</div>
                    )}
                    {typeof saved === 'number' && saved > 0 && (
                      <div className="text-xs text-emerald-300">Saved ₹{saved.toFixed(0)}</div>
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
