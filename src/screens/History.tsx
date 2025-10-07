import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Order = {
  id: string;
  platform: 'swiggy' | 'zomato';
  restaurant?: string;
  total?: number;
  saved?: number;   // estimated vs other platform
  ts: number;
};

const LS_ORD = 'bw.orders.history';

function load(): Order[] {
  try { return JSON.parse(localStorage.getItem(LS_ORD) || '[]'); } catch { return []; }
}
function save(list: Order[]) {
  localStorage.setItem(LS_ORD, JSON.stringify(list.slice(0, 50)));
}

export default function History() {
  const nav = useNavigate();
  const [list, setList] = useState<Order[]>(() => load());

  useEffect(() => save(list), [list]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-500 to-orange-400">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-4">
          <button className="px-3 py-1.5 text-sm rounded-full border bg-white/80" onClick={() => nav(-1)}>← Back</button>
          <h1 className="text-lg font-semibold text-white drop-shadow">Order history</h1>
          <div className="w-16" />
        </header>

        <div className="rounded-xl bg-white shadow divide-y">
          {list.length === 0 ? (
            <div className="p-6 text-sm text-center text-gray-500">
              No orders saved yet. After you return from Swiggy/Zomato, hit “I placed it” to log.
            </div>
          ) : (
            list.map(o => (
              <div key={o.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium capitalize">{o.platform}{o.restaurant ? ` • ${o.restaurant}` : ''}</div>
                  <div className="text-xs opacity-60">{new Date(o.ts).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  {typeof o.total === 'number' && <div className="text-sm">₹{o.total.toFixed(2)}</div>}
                  {typeof o.saved === 'number' && <div className="text-xs text-emerald-600">Saved ₹{o.saved.toFixed(0)}</div>}
                </div>
              </div>
            ))
          )}
        </div>

        {list.length > 0 && (
          <div className="flex gap-2 mt-4">
            <button className="px-3 py-1.5 rounded-xl border bg-white" onClick={() => setList([])}>Clear history</button>
          </div>
        )}
      </div>
    </main>
  );
}
