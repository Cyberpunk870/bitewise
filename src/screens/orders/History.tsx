// src/screens/orders/History.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrders } from '../../lib/api'; // <-- backend fetch
import { on } from '../../lib/events';
import useCart from '../../store/cart';
import { addNotice } from '../../lib/notifications';
import Modal from '../../components/Modal';

type OrderRow = {
  id: string;
  platform: string;
  restaurant?: string;
  dish_name?: string;
  status?: 'pending' | 'completed' | 'failed' | string;
  items?: Array<{ name?: string; qty?: number; price?: number }>;
  breakdown?: {
    subtotal?: number;
    discount?: number;
    fees?: number;
    tax?: number;
    delivery?: number;
    total?: number;
  };
  platform_price?: number;
  saved_amount?: number;
  compare_price?: number;
  delta?: number;
  created_at?: string;
  completed_at?: string;
};

const fmtMoney = (n?: number) =>
  typeof n === 'number' && Number.isFinite(n) ? `₹${n.toFixed(0)}` : '—';

export default function History() {
  const nav = useNavigate();
  const { add: addToCart } = useCart();
  const [list, setList] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const [selected, setSelected] = useState<OrderRow | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadOrders = useCallback(async (opts?: { silent?: boolean }) => {
    const showSpinner = !opts?.silent;
    if (showSpinner) setLoading(true);
    let errored = false;
    try {
      const resp = await getOrders();
      const rows = Array.isArray(resp?.data) ? (resp.data as OrderRow[]) : [];
      if (mountedRef.current) setList(rows);
    } catch (err) {
      errored = true;
      if (mountedRef.current) setList([]);
    } finally {
      if (mountedRef.current && showSpinner) setLoading(false);
      if (errored) {
        addNotice({
          kind: 'system',
          title: 'Could not load orders',
          body: 'Please try again in a bit.',
        });
      }
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const off = on('bw:orders:refresh', () => loadOrders({ silent: true }));
    return () => {
      off?.();
    };
  }, [loadOrders]);

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
          <h1 className="bw-heading text-lg font-semibold">Order history</h1>
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
              const total = typeof o.breakdown?.total === 'number'
                ? o.breakdown.total
                : typeof o.platform_price === 'number'
                  ? o.platform_price
                  : undefined;
              const saved = typeof o.saved_amount === 'number' ? o.saved_amount : undefined;
              const subtotal = o.breakdown?.subtotal;
              const discount = o.breakdown?.discount;
              const fees = o.breakdown?.fees ?? o.breakdown?.tax ?? o.breakdown?.delivery;
              return (
                <div
                  key={o.id}
                  className="p-4 space-y-3 bg-white/5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold capitalize text-white">
                        {o.platform || '—'}
                        {o.restaurant ? ` • ${o.restaurant}` : ''}
                      </div>
                      {o.dish_name && (
                        <div className="text-xs text-white/70">{o.dish_name}</div>
                      )}
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/80">
                          {o.status
                            ? o.status.toString()
                            : o.completed_at
                              ? 'completed'
                              : 'pending'}
                        </span>
                        <span className="text-white/60">{when}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {typeof total === 'number' && (
                        <div className="text-sm font-semibold text-white">
                          Paid {fmtMoney(total)}
                        </div>
                      )}
                      {typeof saved === 'number' && saved > 0 && (
                        <div className="text-xs text-emerald-300">Saved {fmtMoney(saved)}</div>
                      )}
                      {typeof o.compare_price === 'number' && (
                        <div className="text-xs text-white/60">
                          Other app: {fmtMoney(o.compare_price)}
                        </div>
                      )}
                      {Array.isArray(o.items) && o.items.length > 0 && (
                        <button
                          className="mt-2 text-xs rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10 transition"
                          onClick={() => {
                            o.items?.forEach((it) => {
                              if (!it?.name) return;
                              addToCart({ id: it.name, name: it.name, qty: it.qty || 1 });
                            });
                            addNotice({
                              kind: 'system',
                              title: 'Added to cart',
                              body: 'Items from this order were added back to your cart.',
                            });
                            nav('/cart');
                          }}
                        >
                          Reorder items
                        </button>
                      )}
                      <button
                        className="mt-2 ml-2 text-xs rounded-full border border-white/20 px-3 py-1 text-white/80 hover:bg-white/10 transition"
                        onClick={() => setSelected(o)}
                      >
                        View receipt
                      </button>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/60">
                      Items
                    </div>
                    {Array.isArray(o.items) && o.items.length > 0 ? (
                      <div className="space-y-1">
                        {o.items.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm text-white/90"
                          >
                            <div>
                              <div className="font-medium">
                                {it.name || 'Item'}
                              </div>
                              {typeof it.qty === 'number' && (
                                <div className="text-xs text-white/60">Qty {it.qty}</div>
                              )}
                            </div>
                            <div className="text-sm">{fmtMoney(it.price)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-white/70">
                        No item-level detail captured for this order.
                      </div>
                    )}
                  </div>

                  {/* Pricing breakdown */}
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/90 space-y-1">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/60 mb-1">
                      Price breakdown
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Subtotal</span>
                      <span>{fmtMoney(subtotal ?? total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Discount</span>
                      <span className="text-emerald-300">
                        {discount ? `-${fmtMoney(discount)}` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Fees/Tax/Delivery</span>
                      <span>{fmtMoney(fees)}</span>
                    </div>
                    <div className="flex items-center justify-between font-semibold border-t border-white/10 pt-1">
                      <span>Total paid</span>
                      <span>{fmtMoney(total)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Modal
          open={!!selected}
          onClose={() => setSelected(null)}
          title="Receipt"
        >
          {selected && (
            <>
              <div className="text-sm text-white/80">
                {selected.platform} • {selected.restaurant || selected.dish_name || 'Order'}
              </div>
              <div className="text-xs text-white/60">
                {selected.completed_at || selected.created_at
                  ? new Date(selected.completed_at || selected.created_at!).toLocaleString()
                  : ''}
              </div>

              <div className="text-xs uppercase tracking-[0.2em] text-white/60 mt-3">Items</div>
              <div className="space-y-1">
                {Array.isArray(selected.items) && selected.items.length ? (
                  selected.items.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium">{it.name || 'Item'}</div>
                        {typeof it.qty === 'number' && (
                          <div className="text-xs text-white/60">Qty {it.qty}</div>
                        )}
                      </div>
                      <div>{fmtMoney(it.price)}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-white/70">No item-level detail.</div>
                )}
              </div>

              <div className="text-xs uppercase tracking-[0.2em] text-white/60 mt-4">Status</div>
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/80">
                  {selected.status || 'completed'}
                </span>
                <div className="text-white/60 text-xs">Timeline</div>
              </div>

              <div className="mt-2 space-y-1 text-sm text-white/80">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Order created</span>
                  <span className="ml-auto text-white/60 text-xs">
                    {selected.created_at ? new Date(selected.created_at).toLocaleString() : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>Completed</span>
                  <span className="ml-auto text-white/60 text-xs">
                    {selected.completed_at ? new Date(selected.completed_at).toLocaleString() : '—'}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/90 space-y-1 mt-4">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{fmtMoney(selected.breakdown?.subtotal ?? selected.platform_price)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Discount</span>
                  <span className="text-emerald-300">
                    {selected.breakdown?.discount ? `-${fmtMoney(selected.breakdown.discount)}` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Fees/Tax/Delivery</span>
                  <span>{fmtMoney(selected.breakdown?.fees ?? selected.breakdown?.tax ?? selected.breakdown?.delivery)}</span>
                </div>
                <div className="flex items-center justify-between font-semibold border-t border-white/10 pt-1">
                  <span>Total paid</span>
                  <span>{fmtMoney(selected.breakdown?.total ?? selected.platform_price)}</span>
                </div>
                {typeof selected.saved_amount === 'number' && selected.saved_amount > 0 && (
                  <div className="flex items-center justify-between text-emerald-300">
                    <span>Savings</span>
                    <span>{fmtMoney(selected.saved_amount)}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </Modal>
      </div>
    </main>
  );
}
