// src/lib/feed/ActowizAdapter.ts
import { addNotice } from '../notifications';

type ActowizEvent =
  | { type: 'price_drop'; dish: string; newPrice: number; oldPrice?: number }
  | { type: 'offer'; platform: 'swiggy'|'zomato'; text: string }
  | { type: 'eta_change'; restaurant: string; newEtaMins: number };

export function startActowizFeed(opts: { apiBase: string; token?: string }) {
  let alive = true;
  let cursor = Number(localStorage.getItem('bw.actowiz.cursor') || 0);

  async function poll() {
    if (!alive) return;
    try {
      const res = await fetch(`${opts.apiBase}/events?since=${cursor}`, {
        headers: opts.token ? { Authorization: `Bearer ${opts.token}` } : undefined,
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { cursor: number; items: ActowizEvent[] };
      cursor = data.cursor;
      try { localStorage.setItem('bw.actowiz.cursor', String(cursor)); } catch {}

      for (const ev of data.items || []) {
        switch (ev.type) {
          case 'price_drop':
            addNotice({
              kind: 'price',
              title: 'Price drop!',
              body: `${ev.dish} now ₹${ev.newPrice}${ev.oldPrice ? ` (was ₹${ev.oldPrice})` : ''}.`,
            });
            break;
          case 'offer':
            addNotice({ kind: 'price', title: `New ${ev.platform} offer`, body: ev.text });
            break;
          case 'eta_change':
            addNotice({ kind: 'price', title: 'Faster delivery', body: `${ev.restaurant} ~${ev.newEtaMins} mins.` });
            break;
        }
      }
    } catch {
      // simple backoff
      await new Promise(r => setTimeout(r, 5000));
    } finally {
      setTimeout(poll, 10000);
    }
  }

  poll();
  return () => { alive = false; };
}
