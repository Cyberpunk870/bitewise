// src/store/savings.ts
// Lightweight savings tracker (last 7 days) persisted in localStorage.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type SavingsEvent = { ts: number; amount: number };

type SavingsState = {
  events: SavingsEvent[];
  total7d: number;
  lastSavedAt: number | null;
  add: (amount: number) => void;
  clear: () => void;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function prune(events: SavingsEvent[]): SavingsEvent[] {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const filtered = events.filter((e) => e.ts >= cutoff);
  // keep array small
  if (filtered.length > 100) {
    return filtered.slice(filtered.length - 100);
  }
  return filtered;
}

function recalc(events: SavingsEvent[]) {
  const pruned = prune(events);
  const total7d = pruned.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const lastSavedAt = pruned.length ? pruned[pruned.length - 1].ts : null;
  return { events: pruned, total7d, lastSavedAt };
}

export const useSavings = create<SavingsState>()(
  persist(
    (set) => ({
      events: [],
      total7d: 0,
      lastSavedAt: null,
      add: (amount: number) =>
        set((s) => {
          const nextEvents = [...s.events, { ts: Date.now(), amount: Math.max(0, amount) }];
          return recalc(nextEvents);
        }),
      clear: () => set(() => ({ events: [], total7d: 0, lastSavedAt: null })),
    }),
    {
      name: 'bw.savings.v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ events: s.events }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const next = recalc(state.events || []);
        Object.assign(state, next);
      },
    }
  )
);

export function addSavings(amount: number) {
  useSavings.getState().add(amount);
}

export function getSavingsSummary() {
  const { total7d, lastSavedAt } = useSavings.getState();
  return { total7d, lastSavedAt };
}
