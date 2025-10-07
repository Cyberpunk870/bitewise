// src/store/user.ts
import { create } from 'zustand';
import { loadSession, saveSession, clearSession, type SessionUser } from '../lib/session';

type UserState = {
  user?: SessionUser;
  setUser: (u: SessionUser) => void;
  clear: () => void;
  hydrate: () => void;
};

export const useUser = create<UserState>((set) => ({
  user: undefined,
  setUser: (u) => { saveSession(u); set({ user: u }); },
  clear: () => { clearSession(); set({ user: undefined }); },
  hydrate: () => { set({ user: loadSession() }); },
}));
