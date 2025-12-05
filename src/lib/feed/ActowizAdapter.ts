import { addNotice } from '../notifications';
import { setLastAvailabilitySync } from '../dataSync';
import { emit } from '../events';
import { getWatchlist } from '../../store/watchlist';

type ActowizEvent =
  | { type: 'price_drop'; dish: string; restaurant?: string; newPrice: number; oldPrice?: number }
  | { type: 'offer'; platform: 'swiggy'|'zomato'; text: string; restaurant?: string }
  | { type: 'eta_change'; restaurant: string; newEtaMins: number }
  | { type: 'menu_snapshot'; platform: string; restaurant: { restaurant_id: string; restaurant_name: string; image?: string }; items: { name: string; price?: number; mrp?: number; image?: string }[] };

export function startActowizFeed(opts: { apiBase: string; token?: string }) {
  let alive = true;
  let cursor = Number(localStorage.getItem('bw.actowiz.cursor') || 0);

  function matchesWatchlist(ev: ActowizEvent): boolean {
    const list = getWatchlist();
    if (!list.length) return false;
    const lc = (s: string) => s.toLowerCase();
    if (ev.type === 'price_drop') {
      const dish = lc(ev.dish);
      return list.some(
        (it) =>
          (it.kind === 'dish' && lc(it.name) === dish) ||
          (it.kind === 'restaurant' && lc(it.name) === lc(ev.dish))
      );
    }
    if (ev.type === 'offer' || ev.type === 'eta_change') {
      const text = ev.type === 'eta_change' ? ev.restaurant : ev.text;
      const l = lc(text);
      return list.some(
        (it) => lc(it.name) === l || (it.kind === 'dish' && l.includes(lc(it.name)))
      );
    }
    return false;
  }

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
        const hitWatch = matchesWatchlist(ev as any);
        switch (ev.type) {
          case 'price_drop':
            addNotice({
              kind: 'price',
              title: 'Price drop!',
              body: `${ev.dish}${ev.restaurant ? ` @ ${ev.restaurant}` : ''} now ₹${ev.newPrice}${ev.oldPrice ? ` (was ₹${ev.oldPrice})` : ''}.`,
            });
            break;
          case 'offer':
            addNotice({ kind: 'price', title: `New ${ev.platform} offer`, body: ev.text });
            break;
          case 'eta_change':
            addNotice({ kind: 'price', title: 'Faster delivery', body: `${ev.restaurant} ~${ev.newEtaMins} mins.` });
            break;
          case 'menu_snapshot':
            // Highlight top 1-2 items from fresh snapshot
            if (ev.items && ev.items.length) {
              const first = ev.items[0];
              addNotice({
                kind: 'price',
                title: `${ev.restaurant.restaurant_name} refreshed`,
                body: `${first.name}${first.price ? ` at ₹${first.price}` : ''}${ev.items.length > 1 ? ` +${ev.items.length - 1} more` : ''}`,
              });
            }
            break;
        }
        if (hitWatch) {
          addNotice({
            kind: 'price',
            title: 'On your watchlist',
            body:
              ev.type === 'price_drop'
                ? `${ev.dish} just dropped to ₹${ev.newPrice}.`
                : ev.type === 'offer'
                ? `New offer: ${ev.text}`
                : ev.type === 'menu_snapshot'
                ? `${ev.restaurant.restaurant_name} menu refreshed.`
                : `${(ev as any).restaurant} updated.`,
          });
        }
      }

      // mark a successful sync moment (even if no events) so UI shows freshness
      setLastAvailabilitySync(Date.now());
      emit('bw:data:availability:tick', {}); // optional: any listeners
    } catch {
      emit('bw:data:availabilityError', {});
      // simple backoff
      await new Promise(r => setTimeout(r, 5000));
    } finally {
      setTimeout(poll, 10000);
    }
  }

  poll();
  return () => { alive = false; };
}
