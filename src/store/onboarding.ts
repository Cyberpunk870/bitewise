// src/store/onboarding.ts
import { create } from 'zustand';
import persistUtils from './persist';

export type PermStatus = 'unknown' | 'granted' | 'denied' | 'unavailable';

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

export const PROGRESSION_STEPS: Exclude<OnboardStep, 'welcome' | 'done'>[] = [
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

type State = {
  name: string;
  dob: string;
  addressLine: string;
  addressLabel?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  step: OnboardStep;
  complete: boolean;
  verified?: boolean; // ✅ added for Review compatibility
  perm: {
    location: PermStatus;
    notifications: PermStatus;
    mic: PermStatus;
  };
  setStep: (s: OnboardStep) => void;
  markComplete: () => void;
  setName: (v: string) => void;
  setDob: (v: string) => void;
  setGeocode: (v: { addressLine: string; lat: number; lng: number }) => void;
  setAddressLabel: (v: string) => void;
  setPhone: (v: string) => void;
  setPerm: (k: keyof State['perm'], v: PermStatus) => void;
  reset: () => void;
};

const initialState: Omit<
  State,
  'setStep' | 'markComplete' | 'setName' | 'setDob' | 'setGeocode' |
  'setAddressLabel' | 'setPhone' | 'setPerm' | 'reset'
> = {
  name: '',
  dob: '',
  addressLine: '',
  addressLabel: '',
  lat: undefined,
  lng: undefined,
  phone: undefined,
  step: 'welcome',
  complete: false,
  verified: false,
  perm: { location: 'unknown', notifications: 'unknown', mic: 'unknown' },
};

export const useOnboarding = create<State>()((set) => ({
  ...initialState,
  setStep: (s) => set({ step: s }),
  markComplete: () => set({ complete: true, step: 'done' }),
  setName: (name) => set({ name }),
  setDob: (dob) => set({ dob }),
  setGeocode: ({ addressLine, lat, lng }) => set({ addressLine, lat, lng }),
  setAddressLabel: (addressLabel) => set({ addressLabel }),
  setPhone: (phone) => set({ phone }),
  setPerm: (k, v) => set((st) => ({ perm: { ...st.perm, [k]: v } })),
  reset: () => set({ ...initialState }),
}));

// Hydration (unchanged)
const persistAny: any = persistUtils || {};
try {
  const saved = persistAny?.load?.();
  if (saved && typeof saved === 'object') {
    const { name, dob, addressLine, addressLabel, lat, lng, phone, step, complete, perm } = saved as Partial<State>;
    useOnboarding.setState((st) => ({
      ...st,
      name: name ?? st.name,
      dob: dob ?? st.dob,
      addressLine: addressLine ?? st.addressLine,
      addressLabel: addressLabel ?? st.addressLabel,
      lat: lat ?? st.lat,
      lng: lng ?? st.lng,
      phone: phone ?? st.phone,
      step: step ?? st.step,
      complete: complete ?? st.complete,
      perm: perm ?? st.perm,
    }));
  }
} catch {}

useOnboarding.subscribe((st) => {
  persistAny?.savePatch?.({
    name: st.name,
    dob: st.dob,
    addressLine: st.addressLine,
    addressLabel: st.addressLabel,
    lat: st.lat,
    lng: st.lng,
    phone: st.phone,
    step: st.step,
    complete: st.complete,
    perm: st.perm,
  });
});

export default useOnboarding;