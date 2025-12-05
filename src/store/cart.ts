// src/store/cart.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { track } from '../lib/track';

export type CartItem = { id: string; name: string; qty: number; updatedAt?: number };

type CartState = {
  itemsMap: Record<string, CartItem>;
  items: CartItem[];
  count: number;
  totalCount: number;
  allIds: string[];
  add: (p: { id: string; name: string; qty?: number }) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
};

function recalc(map: Record<string, CartItem>) {
  const items = Object.values(map);
  // sort by most recently updated
  items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const count = items.reduce((s, it) => s + it.qty, 0);
  const allIds = items.map(it => it.id);
  return { itemsMap: map, items, count, totalCount: count, allIds };
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      itemsMap: {},
      items: [],
      count: 0,
      totalCount: 0,
      allIds: [],
      add: ({ id, name, qty = 1 }) =>
        set(s => {
          const prev = s.itemsMap[id]?.qty ?? 0;
          const nextMap = { ...s.itemsMap, [id]: { id, name, qty: prev + qty, updatedAt: Date.now() } };
          try { track('cart_add', { id, name, qty }); } catch {}
          return recalc(nextMap);
        }),
      dec: (id) =>
        set(s => {
          const prev = s.itemsMap[id]?.qty ?? 0;
          if (prev <= 1) {
            const nextMap = { ...s.itemsMap };
            delete nextMap[id];
            try { track('cart_remove', { id, qty: prev || 1 }); } catch {}
            return recalc(nextMap);
          }
          const nextMap = { ...s.itemsMap, [id]: { ...s.itemsMap[id], qty: prev - 1 } };
          try { track('cart_update', { id, qty: prev - 1 }); } catch {}
          return recalc(nextMap);
        }),
      remove: (id) =>
        set(s => {
          const nextMap = { ...s.itemsMap };
          delete nextMap[id];
          try { track('cart_remove', { id }); } catch {}
          return recalc(nextMap);
        }),
      clear: () => set(() => recalc({})),
    }),
    {
      name: 'bw.cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ itemsMap: s.itemsMap }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        Object.assign(state, recalc(state.itemsMap || {}));
      },
    }
  )
);

export default useCart;
