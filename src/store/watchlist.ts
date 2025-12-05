// src/store/watchlist.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { track } from '../lib/track';

export type WatchItem = {
  id: string;
  name: string;
  kind: 'restaurant' | 'dish';
};

type WatchState = {
  items: WatchItem[];
  add: (item: WatchItem) => void;
  remove: (id: string, kind: WatchItem['kind']) => void;
  toggle: (item: WatchItem) => void;
  isWatched: (id: string, kind: WatchItem['kind']) => boolean;
  findByName: (name: string, kind?: WatchItem['kind']) => WatchItem | undefined;
  clear: () => void;
};

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

export const useWatchlist = create<WatchState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) =>
        set((s) => {
          const exists = s.items.some(
            (it) => it.id === item.id && it.kind === item.kind
          );
          if (exists) return s;
          try { track('watch_add', { id: item.id, name: item.name, kind: item.kind }); } catch {}
          return { items: [...s.items, item] };
        }),
      remove: (id, kind) =>
        set((s) => ({
          items: s.items.filter((it) => !(it.id === id && it.kind === kind)),
        })),
      toggle: (item) =>
        set((s) => {
          const exists = s.items.some(
            (it) => it.id === item.id && it.kind === item.kind
          );
          if (exists) {
            try { track('watch_remove', { id: item.id, name: item.name, kind: item.kind }); } catch {}
            return {
              items: s.items.filter(
                (it) => !(it.id === item.id && it.kind === item.kind)
              ),
            };
          }
          try { track('watch_add', { id: item.id, name: item.name, kind: item.kind }); } catch {}
          return { items: [...s.items, item] };
        }),
      isWatched: (id, kind) => {
        return get().items.some((it) => it.id === id && it.kind === kind);
      },
      findByName: (name, kind) => {
        const n = normalizeName(name);
        return get().items.find(
          (it) =>
            normalizeName(it.name) === n &&
            (kind ? it.kind === kind : true)
        );
      },
      clear: () => set(() => ({ items: [] })),
    }),
    {
      name: 'bw.watchlist.v1',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export function getWatchlist() {
  return useWatchlist.getState().items;
}

export function toggleWatch(item: WatchItem) {
  useWatchlist.getState().toggle(item);
}

export function isWatched(id: string, kind: WatchItem['kind']) {
  return useWatchlist.getState().isWatched(id, kind);
}

export function findWatchByName(name: string, kind?: WatchItem['kind']) {
  return useWatchlist.getState().findByName(name, kind);
}
