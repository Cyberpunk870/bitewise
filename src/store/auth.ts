// src/store/auth.ts
import { create } from 'zustand';
import type { ConfirmationResult } from 'firebase/auth';

type AuthState = {
  phone: string;
  uid: string | null;
  confirmation: ConfirmationResult | null; // not persisted
  setPhone: (p: string) => void;
  setUid: (u: string | null) => void;
  setConfirmation: (c: ConfirmationResult | null) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  phone: '',
  uid: null,
  confirmation: null,
  setPhone: (p) => set({ phone: p }),
  setUid: (u) => set({ uid: u }),
  setConfirmation: (c) => set({ confirmation: c }),
  clear: () => set({ phone: '', uid: null, confirmation: null })
}));
