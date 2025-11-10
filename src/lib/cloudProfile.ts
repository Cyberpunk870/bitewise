// src/lib/cloudProfile.ts
import { getActivePhone, loadProfileByPhone, saveProfile, type Profile } from './profileStore';
import { getUserProfile, upsertProfile } from './api';
import { getAuth } from 'firebase/auth';

const USE_CLOUD = import.meta.env.VITE_USE_FIRESTORE === '1';

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPushedSnapshot = '';

function stableSnapshot(p?: Profile | null): string {
  if (!p) return '';
  const minimal = {
    phone: p.phone ?? '',
    name: p.name ?? '',
    addressLine: p.addressLine ?? '',
    addressLabel: p.addressLabel ?? '',
    lat: typeof p.lat === 'number' ? p.lat : undefined,
    lng: typeof p.lng === 'number' ? p.lng : undefined,
  };
  try {
    return JSON.stringify(minimal);
  } catch {
    return '';
  }
}

export async function pushActiveToCloud(): Promise<void> {
  try {
    if (!USE_CLOUD) return;
    if (!getAuth().currentUser) return;
    const phone = getActivePhone();
    if (!phone) return;
    const local = loadProfileByPhone(phone);
    if (!local) return;
    const snapshot = stableSnapshot(local);
    if (snapshot === lastPushedSnapshot) return;

    const doPush = async () => {
      try {
        await upsertProfile({
          phone: local.phone,
          name:
            local.name &&
            local.name.trim().toLowerCase() !== "guest"
              ? local.name.trim()
              : undefined,
        });
        lastPushedSnapshot = snapshot;
      } catch (e) {
        console.warn('[cloudProfile] pushActiveToCloud failed', e);
      }
    };
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(doPush, 500);
  } catch (err) {
    console.warn("[cloudProfile] pushActiveToCloud failed", err);
  }
}

export async function hydrateActiveFromCloud(): Promise<boolean> {
  try {
    if (!USE_CLOUD) return false;
    if (!getAuth().currentUser) return false;
    const phone = getActivePhone();
    if (!phone) return false;
    const remote = await getUserProfile();
    if (!remote?.profile) return false;
    const local = loadProfileByPhone(phone) || ({ phone } as Profile);
    const merged: Profile = {
      ...local,
      ...remote.profile,
      phone,
      passkey: local.passkey,
      passkeyMeta: local.passkeyMeta,
    };
    saveProfile(merged);
    lastPushedSnapshot = stableSnapshot(merged);
    return true;
  } catch (err) {
    console.warn('[cloudProfile] hydrateActiveFromCloud failed', err);
    return false;
  }
}