import { create } from 'zustand';

type ToastItem = { id: string; text: string; tone?: 'default'|'success'|'error' };
type ToastState = {
  items: ToastItem[];
  push: (text: string, tone?: ToastItem['tone']) => void;
  remove: (id: string) => void;
  success: (text: string) => void;
  error: (text: string) => void;
};

export const useToast = create<ToastState>()((set, get) => ({
  items: [],
  push: (text, tone) =>
    set((s) => ({ items: [...s.items, { id: crypto.randomUUID(), text, tone }] })),
  remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
  success: (text) => get().push(text, 'success'),
  error: (text) => get().push(text, 'error'),
}));

export const toast = {
  success: (t: string) => useToast.getState().success(t),
  error: (t: string) => useToast.getState().error(t),
  push: (t: string) => useToast.getState().push(t),
};
