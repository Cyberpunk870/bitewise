// src/store/onboarding.ts
import { create } from 'zustand';
import persistUtils from './persist';

/** Permission status we track per capability */
export type PermStatus = 'unknown' | 'granted' | 'denied' | 'unavailable';

/** All onboarding steps */
export type OnboardStep =
  | 'welcome'
  | 'name'
  | 'dob'
  | 'addressPick'
  | 'addressLabel'
  | 'phone'
  | 'otp'
  | 'permLocation'
  | 'permNotifications'
  | 'permMic'
  | 'finish'
  | 'done';

/**
 * Steps that participate in progress UI.
 * (Exclude 'welcome' and 'done' so progress bar works correctly.)
 */
export const PROGRESSION_STEPS: Exclude<
  OnboardStep,
  'welcome' | 'done'
>[] = [
  'name',
  'dob',
  'addressPick',
  'addressLabel',
  'phone',
  'permLocation',
  'permNotifications',
  'permMic',
  'finish',
];

/** Store shape */
type State = {
  // collected
  name: string;
  dob: string;
  addressLine: string;
  lat?: number;
  lng?: number;
  phone?: string;

  // progress
  step: OnboardStep;
  complete: boolean;

  // permissions
  perm: {
    location: PermStatus;
    notifications: PermStatus;
    mic: PermStatus;
  };

  // actions
  setStep: (s: OnboardStep) => void;
  markComplete: () => void;
  setName: (v: string) => void;
  setDob: (v: string) => void;
  setGeocode: (v: { addressLine: string; lat: number; lng: number }) => void;
  setPhone: (v: string) => void;
  setPerm: (k: keyof State['perm'], v: PermStatus) => void;
  reset: () => void;
};

/** Initial state (also used by reset) */
const initialState: Omit<State, keyof State & 'actions'> = {
  name: '',
  dob: '',
  addressLine: '',
  lat: undefined,
  lng: undefined,
  phone: undefined,

  step: 'welcome',
  complete: false,

  perm: { location: 'unknown', notifications: 'unknown', mic: 'unknown' },
};

export const useOnboarding = create<State>()((set) => ({
  ...initialState,

  setStep: (s) => set({ step: s }),
  markComplete: () => set({ complete: true, step: 'done' }),

  setName: (name) => set({ name }),
  setDob: (dob) => set({ dob }),
  setGeocode: ({ addressLine, lat, lng }) => set({ addressLine, lat, lng }),
  setPhone: (phone) => set({ phone }),

  setPerm: (k, v) =>
    set((st) => ({
      perm: {
        ...st.perm,
        [k]: v,
      },
    })),

  reset: () =>
    set({
      ...initialState,
    }),
}));

/* ----------------------------- Persistence ----------------------------- */
/**
 * Hydrate from your custom persist utils at module load.
 * `persistUtils` is expected to expose:
 *   - load(): Partial<State> | undefined
 *   - savePatch(patch: Partial<State>): void
 *   - clear(): void
 */
try {
  const saved = persistUtils?.load?.();
  if (saved && typeof saved === 'object') {
    // Only merge the keys we actually persist
    const {
      name,
      dob,
      addressLine,
      lat,
      lng,
      phone,
      step,
      complete,
      perm,
    } = saved as Partial<State>;
    useOnboarding.setState((st) => ({
      ...st,
      ...(name !== undefined ? { name } : null),
      ...(dob !== undefined ? { dob } : null),
      ...(addressLine !== undefined ? { addressLine } : null),
      ...(lat !== undefined ? { lat } : null),
      ...(lng !== undefined ? { lng } : null),
      ...(phone !== undefined ? { phone } : null),
      ...(step !== undefined ? { step } : null),
      ...(complete !== undefined ? { complete } : null),
      ...(perm !== undefined ? { perm } : null),
    }));
  }
} catch {
  // ignore hydration errors (private mode, corrupted JSON, etc.)
}

/** Save a compact patch whenever state changes */
useOnboarding.subscribe((st) => {
  persistUtils?.savePatch?.({
    name: st.name,
    dob: st.dob,
    addressLine: st.addressLine,
    lat: st.lat,
    lng: st.lng,
    phone: st.phone,
    step: st.step,
    complete: st.complete,
    perm: st.perm,
  });
});

export default useOnboarding;
