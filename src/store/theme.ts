// src/store/theme.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeState = {
  dark: boolean;
  setDark: (on: boolean) => void;
  toggle: () => void;
};

// WHY: Persist + reflect to <html> immediately so Tailwind 'dark' works across pages/reloads.
export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      dark: false,
      setDark: (on) => {
        set({ dark: on });
        document.documentElement.classList.toggle('dark', on);
      },
      toggle: () => {
        const next = !get().dark;
        set({ dark: next });
        document.documentElement.classList.toggle('dark', next);
      },
    }),
    { name: 'bw_theme' }
  )
);

// Apply persisted theme on first import (app boot).
const persisted = JSON.parse(localStorage.getItem('bw_theme') || '{}');
if (persisted?.state?.dark) {
  document.documentElement.classList.add('dark');
}
