// src/screens/settings/Settings.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../../store/theme';
import { getActiveProfile, setActiveProfileFields } from '../../lib/profileStore';
import {
  getPermPolicy,
  setPermPolicy,
  clearPermPolicy,
  usePermDecision,
  type PermPolicy,
  type PermKey,
} from '../../lib/permPrefs';
import { gateLocation, gateMic, gateNotifications } from '../../lib/permGate';
import { ensureNotifPermissionOrRoute } from '../../lib/notify';
import { hasLocalPasskey, clearLocalPasskey } from '../../lib/passkeyLocal';
import { manualLogout } from '../../lib/session';
import { emit } from '../../lib/events';
import { toast } from '../../store/toast';
import { upsertProfile } from '../../lib/api';
import {
  getAddresses as apiGetAddresses,
  addAddress as apiAddAddress,
} from '../../lib/api';
import { getAuth } from 'firebase/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Address shape mirrored from backend
// ─────────────────────────────────────────────────────────────────────────────
type SavedAddr = {
  id: string;
  label: string;
  addressLine: string;
  lat: number;
  lng: number;
  active?: boolean;
  lastUsedTs?: number;
};

const ADDR_KEY = 'bw.addresses';

// Fetch list from server; fallback to cache if server fails
async function fetchAddresses(): Promise<SavedAddr[]> {
  try {
    const list = (await apiGetAddresses()) as SavedAddr[]; // api.ts getAddresses()
    const arr = Array.isArray(list) ? list : [];
    try {
      localStorage.setItem(ADDR_KEY, JSON.stringify(arr));
    } catch {}
    return arr;
  } catch {
    try {
      return JSON.parse(localStorage.getItem(ADDR_KEY) || '[]') || [];
    } catch {
      return [];
    }
  }
}

// Upsert (rename / make active). We POST and then reload fresh list.
async function upsertAddress(addr: {
  id?: string;
  label: string;
  addressLine: string;
  lat: number;
  lng: number;
  active?: boolean;
}): Promise<SavedAddr[] | null> {
  try {
    await apiAddAddress({
      ...(addr.id ? { id: addr.id } : {}),
      label: String(addr.label ?? ''),
      addressLine: String(addr.addressLine ?? ''),
      lat: Number(addr.lat),
      lng: Number(addr.lng),
      active: Boolean(addr.active),
    });
    const list = await fetchAddresses();
    try {
      localStorage.setItem(ADDR_KEY, JSON.stringify(list));
    } catch {}
    return list;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
const KEYS: PermKey[] = ['location', 'notifications', 'mic'];

export default function Settings() {
  const nav = useNavigate();
  const { dark, toggle: toggleDark } = useTheme();
  const profile = useMemo(() => getActiveProfile(), []);
  const phone = profile?.phone || '';
  const name = profile?.name || 'Guest';

  // track firebase uid so we know if user is signed in
  const [uid, setUid] = useState<string | null>(() => getAuth().currentUser?.uid ?? null);
  useEffect(() => {
    const auth = getAuth();
    const unsub = auth.onAuthStateChanged(u => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  // Live permission decisions (reacts to policy + events)
  const decLoc = usePermDecision('location');
  const decNot = usePermDecision('notifications');
  const decMic = usePermDecision('mic');

  // Current saved policy (for radios)
  const [policies, setPolicies] = useState<Record<PermKey, PermPolicy | undefined>>({
    location: getPermPolicy('location'),
    notifications: getPermPolicy('notifications'),
    mic: getPermPolicy('mic'),
  });

  // Passkey state
  const [hasPk, setHasPk] = useState<boolean>(false);
  useEffect(() => {
    setHasPk(!!(phone && hasLocalPasskey(phone)));
  }, [phone]);

  // Keep local radio state in sync if changed elsewhere
  useEffect(() => {
    const refresh = () => {
      setPolicies({
        location: getPermPolicy('location'),
        notifications: getPermPolicy('notifications'),
        mic: getPermPolicy('mic'),
      });
    };
    window.addEventListener('bw:perm:changed' as any, refresh as any);
    window.addEventListener('storage', (e: StorageEvent) => { if (!e.key) refresh(); });
    return () => {
      window.removeEventListener('bw:perm:changed' as any, refresh as any);
      window.removeEventListener('storage', refresh as any);
    };
  }, []);

  const setPolicy = (key: PermKey, value: PermPolicy) => {
    setPermPolicy(key, value);
    setPolicies((s) => ({ ...s, [key]: value }));
    try { window.dispatchEvent(new Event('bw:perm:changed')); } catch {}
    toast.success('Saved preference');
  };

  const clearPolicyHandler = (key: PermKey) => {
    clearPermPolicy(key);
    setPolicies((s) => ({ ...s, [key]: undefined }));
    try { window.dispatchEvent(new Event('bw:perm:changed')); } catch {}
    toast.success('Cleared preference');
  };

  const requestNativePrompt = async (key: PermKey) => {
    if (key === 'location') {
      try {
        const { getCurrentPosition } = await import('../../lib/location');
        await getCurrentPosition(4000);
      } catch {}
    } else if (key === 'notifications') {
      await ensureNotifPermissionOrRoute(nav);
    } else if (key === 'mic') {
      try {
        if (
          navigator.mediaDevices?.getUserMedia &&
          (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))
        ) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
        }
      } catch {}
    }
    setTimeout(() => emit('bw:perm:recheck', null), 0);
  };

  // --- Local test notification for dev
  function showLocalTestNotification() {
    try {
      new Notification('🍔 BiteWise Test', {
        body: 'Looks like notifications work!',
        silent: false,
      });
    } catch {}
  }

  async function sendTestNotification() {
    if (!('Notification' in window)) return;
    try {
      if ((Notification as any).permission === 'granted') {
        showLocalTestNotification();
        return;
      }
      const res = await (Notification as any).requestPermission?.();
      if (res === 'granted') {
        showLocalTestNotification();
        setTimeout(() => emit('bw:perm:recheck', null), 0);
      } else if (res === 'denied') {
        toast.error('Notifications are blocked. Allow them in your browser settings.');
      }
    } catch {}
  }

  const gates = useMemo(() => {
    return {
      location: gateLocation(),
      notifications: gateNotifications(),
      mic: gateMic(),
    };
  }, [decLoc, decNot, decMic]);

  // ✅ Manual logout via unified helper
  const logout = async () => {
    try { await manualLogout(); } catch {}
  };

  const editName = async () => {
    if (!uid) {
      toast.error('You must be signed in to change your name.');
      return;
    }

    const current = name || '';
    const next = window.prompt('Your display name:', current)?.trim();

    if (!next || next === current) return;

    try {
      // 1. Push to backend (writes into Firestore users{uid}.name)
      await upsertProfile({ name: next });

      // 2. Update local profile cache immediately
      setActiveProfileFields({ name: next });

      // 3. Broadcast so any subscribers re-render
      try {
        window.dispatchEvent(new Event('bw:profile:update'));
      } catch {}

      toast.success('Name updated');
    } catch (err) {
      console.warn('editName failed', err);
      toast.error('Could not update name. Please try again.');
    }
  };

  const removePasskey = async () => {
    if (!phone) return;
    try {
      clearLocalPasskey(phone);
      setHasPk(false);
      toast.success('Passkey removed from this device');
    } catch {
      toast.error('Could not remove passkey');
    }
  };

  const goSetPasskey = () => {
    nav('/onboarding/setpasskey');
  };

  const PolicyRadios = (props: { k: PermKey; label: string; helper?: string }) => {
    const k = props.k;
    const value = policies[k];
    const helper = props.helper;
    const Radio = ({
      id,
      label,
      val,
    }: {
      id: string;
      label: string;
      val: PermPolicy;
    }) => (
      <label htmlFor={id} className="inline-flex items-center gap-2 cursor-pointer">
        <input
          id={id}
          name={`perm-${k}`}
          type="radio"
          className="h-4 w-4"
          checked={value === val}
          onChange={() => setPolicy(k, val)}
        />
        <span className="text-sm">{label}</span>
      </label>
    );
    const decision =
      k === 'location' ? decLoc : k === 'notifications' ? decNot : decMic;
    return (
      <div className="rounded-2xl bg-white/70 dark:bg-white/10 p-4 shadow">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold">{props.label}</div>
            {helper ? <div className="text-xs opacity-75">{helper}</div> : null}
            <div className="mt-1 text-xs opacity-75">
              Decision now: <span className="font-medium">{decision}</span>
              {gates[k].ok ? null : (
                <span className="ml-2">( {gates[k].reason} )</span>
              )}
            </div>
          </div>
          {/* Re-check + (DEV) Send test for notifications */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => requestNativePrompt(k)}
              className="text-xs px-2 py-1 rounded-lg bg-black/10 dark:bg-white/20 hover:bg-black/20"
            >
              Re-check
            </button>
            {k === 'notifications' && import.meta.env.DEV && (
              <button
                onClick={sendTestNotification}
                className="text-xs px-2 py-1 rounded-lg bg-black/10 dark:bg-white/20 hover:bg-black/20"
                title="Send a local test notification"
              >
                Send test
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:flex sm:items-center sm:gap-6">
          <Radio id={`r-${k}-always`} label="Always allow" val="always" />
          <Radio id={`r-${k}-session`} label="Only this time" val="session" />
          <Radio id={`r-${k}-never`} label="Never" val="never" />
          <button
            onClick={() => clearPolicyHandler(k)}
            className="text-xs px-2 py-1 rounded-lg bg-black/10 dark:bg-white/20 hover:bg-black/20"
          >
            Clear
          </button>
        </div>
      </div>
    );
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Manage saved addresses (beta)
  // ───────────────────────────────────────────────────────────────────────────
  const [addrBusy, setAddrBusy] = useState(false);
  const [addresses, setAddresses] = useState<SavedAddr[]>([]);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      if (!uid) return; // must be signed in
      const list = await fetchAddresses();
      if (!ignore) setAddresses(list);
    };
    load();

    const onProfile = () => load();
    window.addEventListener('bw:profile:update' as any, onProfile as any);
    window.addEventListener('storage', onProfile as any);

    return () => {
      ignore = true;
      window.removeEventListener('bw:profile:update' as any, onProfile as any);
      window.removeEventListener('storage', onProfile as any);
    };
  }, [uid]);

  async function makeActive(a: SavedAddr) {
    if (!uid) return;
    setAddrBusy(true);
    try {
      // 1) mark active on backend
      const list = await upsertAddress({
        id: a.id,
        label: a.label,
        addressLine: a.addressLine,
        lat: a.lat,
        lng: a.lng,
        active: true,
      });
      if (list) setAddresses(list);

      // 2) update active profile locally so UI reflects immediately
      setActiveProfileFields({
        addressLabel: a.label,
        addressLine: a.addressLine,
        lat: a.lat,
        lng: a.lng,
      });

      // 3) broadcast
      try { window.dispatchEvent(new Event('bw:profile:update')); } catch {}
      toast.success('Active address updated');
    } finally {
      setAddrBusy(false);
    }
  }

  async function renameLabel(a: SavedAddr) {
    if (!uid) return;
    const next = window.prompt('New label (e.g., Home, Office):', a.label || 'Saved');
    if (!next || next.trim() === a.label) return;

    setAddrBusy(true);
    try {
      const list = await upsertAddress({
        id: a.id,
        label: next.trim(),
        addressLine: a.addressLine,
        lat: a.lat,
        lng: a.lng,
        active: !!a.active,
      });
      if (list) setAddresses(list);

      if (a.active) {
        setActiveProfileFields({ addressLabel: next.trim() });
        try { window.dispatchEvent(new Event('bw:profile:update')); } catch {}
      }

      toast.success('Label updated');
    } finally {
      setAddrBusy(false);
    }
  }

  return (
    <div className="min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-6 animate-fade-up">
        {/* Header */}
        <div className="text-white">
          <h1 className="text-3xl font-extrabold drop-shadow">Settings</h1>
          <p className="opacity-90">Manage permissions, theme, passkey and account.</p>
        </div>

        {/* Account */}
        <section className="rounded-2xl bg-white/70 dark:bg-white/10 p-4 shadow text-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold">Account</div>
              <div className="opacity-80">
                {name} {phone ? <span className="opacity-60">({phone})</span> : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
      <button
        onClick={editName}
        className="px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/20 hover:bg-black/20"
      >
        Edit name
      </button>

      <Link
        to="/orders/history"
        className="px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/20 hover:bg-black/20"
      >
        Order history
      </Link>

      <button
        onClick={logout}
        className="px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/20 hover:bg-black/20"
      >
        Logout
      </button>
    </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="rounded-2xl bg-white/70 dark:bg-white/10 p-4 shadow text-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold">Appearance</div>
              <div className="opacity-80">Use device theme preference or toggle manually.</div>
            </div>
            <button
              onClick={toggleDark}
              className="px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/20 hover:bg-black/20"
            >
              {dark ? 'Use Light' : 'Use Dark'}
            </button>
          </div>
        </section>

        {/* Permissions */}
        <section className="space-y-4">
          <div className="text-white/95 font-semibold">Permissions</div>

          <PolicyRadios
            k="location"
            label="Location"
            helper="Used to show availability and prices near you."
          />
          <PolicyRadios
            k="notifications"
            label="Notifications"
            helper="Order updates, task rewards and important alerts."
          />
          <PolicyRadios
            k="mic"
            label="Microphone"
            helper="Enables voice search for dishes and restaurants."
          />
        </section>

        {/* Manage saved addresses (beta) */}
        <section className="rounded-2xl bg-white/70 dark:bg-white/10 p-4 shadow text-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-base font-semibold">Manage saved addresses (beta)</div>
              <div className="opacity-80">
                Keep up to 3 places. We silently prefer one within 100 m; prompt if 300 m+ away.
              </div>
            </div>
            <button
              disabled={addrBusy}
              onClick={async () => {
                if (!uid) return;
                setAddrBusy(true);
                const list = await fetchAddresses();
                setAddresses(list);
                setAddrBusy(false);
                toast.success('Refreshed');
              }}
              className="px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/20 hover:bg-black/20 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {addresses.length === 0 ? (
            <div className="rounded-xl border p-3 opacity-80">
              No saved addresses yet. Use the onboarding “Update address” flow to add one.
            </div>
          ) : (
            <div className="grid gap-2">
              {addresses.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border bg-white/80 dark:bg-white/10 p-3 flex items-start justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">{a.label || 'Saved'}</div>
                      {a.active ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/10">
                          Active
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs opacity-80 truncate">{a.addressLine}</div>
                    <div className="text-[11px] opacity-60 mt-0.5">
                      {a.lat.toFixed(5)}, {a.lng.toFixed(5)}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      disabled={addrBusy}
                      onClick={() => renameLabel(a)}
                      className="text-xs px-2 py-1 rounded-lg bg-black/10 dark:bg-white/20 hover:bg-black/20 disabled:opacity-50"
                    >
                      Rename
                    </button>
                    <button
                      disabled={addrBusy || a.active}
                      onClick={() => makeActive(a)}
                      className="text-xs px-2 py-1 rounded-lg bg-black text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Make active
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick Unlock Passkey */}
        <section className="rounded-2xl bg-white/70 dark:bg-white/10 p-4 shadow text-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold">Quick Unlock Passkey</div>
              <div className="opacity-80">
                {hasPk
                  ? 'A device-local passkey is set for quick unlock after idle.'
                  : 'No passkey set. Add one to unlock quickly after idle.'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasPk ? (
                <button
                  onClick={removePasskey}
                  className="px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/20 hover:bg-black/20"
                >
                  Remove
                </button>
              ) : null}
              <button
                onClick={goSetPasskey}
                className="px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/20 hover:bg-black/20"
              >
                {hasPk ? 'Change' : 'Set Passkey'}
              </button>
            </div>
          </div>
        </section>

        {/* Utilities */}
        <section className="rounded-2xl bg-white/70 dark:bg-white/10 p-4 shadow text-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold">Utilities</div>
              <div className="opacity-80">Need to start fresh? Use the reset route.</div>
            </div>
            <Link
              to="/reset"
              className="px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/20 hover:bg-black/20"
            >
              Reset App
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}