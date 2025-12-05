// src/store/address.ts
import { create } from 'zustand';

export type AddressLabel =
  | 'Home'
  | 'Work'
  | 'Gym'
  | 'Friend'
  | { custom: string };

type AddressState = {
  addressLine: string | null;
  lat: number | null;
  lng: number | null;
  label: AddressLabel | null;
  confirmed: boolean;

  // setters
  setGeocode: (v: { addressLine: string; lat: number; lng: number }) => void;
  setLabel: (v: AddressLabel) => void;
  setConfirmed: (ok: boolean) => void;

  clear: () => void;
};

export const useAddress = create<AddressState>()((set) => ({
  addressLine: null,
  lat: null,
  lng: null,
  label: null,
  confirmed: false,

  setGeocode: ({ addressLine, lat, lng }) =>
    set({ addressLine, lat, lng, confirmed: false }),

  setLabel: (v) => set({ label: v }),

  setConfirmed: (ok) => set({ confirmed: ok }),

  clear: () =>
    set({
      addressLine: null,
      lat: null,
      lng: null,
      label: null,
      confirmed: false,
    }),
}));

// Allow both `import { useAddress }` and `import useAddress`
export default useAddress;
