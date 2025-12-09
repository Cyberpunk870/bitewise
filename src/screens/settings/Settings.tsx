// src/screens/settings/Settings.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../../store/theme';
import { getActiveProfile, setActiveProfileFields } from '../../lib/profileStore';
import {
  getPermPolicy,
  setPermPolicy,
  clearPermPolicy,
  allowForThisSession,
  usePermDecision,
  getMicPermission,
  setMicPermission,
  type PermPolicy,
  type PermKey,
} from '../../lib/permPrefs';
import { gateLocation, gateMic } from '../../lib/permGate';
import { manualLogout } from '../../lib/session';
import { emit } from '../../lib/events';
import { toast } from '../../store/toast';
import {
  upsertProfile,
  getReferralStatus,
  createReferralCode,
  redeemReferralCode,
  getCoinsSummary,
  getUserProfile,
  getAddresses as apiGetAddresses,
  addAddress as apiAddAddress,
} from '../../lib/api';
import { logError } from '../../lib/logger';
import { getAuth } from 'firebase/auth';
import { fetchPasskeys, deletePasskey, type PasskeySummary } from '../../lib/webauthnClient';
import { resolveApiBase } from '../../lib/apiBase';
import NotificationsPanel from './NotificationsPanel';
import PushStatus from './PushStatus';

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
const loadNotify = () => import('../../lib/notify');

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
const KEYS: PermKey[] = ['location', 'microphone'];

function formatPasskeyTimestamp(ts?: string) {
  if (!ts) return 'Never used yet';
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

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
  const decMic = usePermDecision('microphone');

  // Current saved policy (for radios)
const [policies, setPolicies] = useState<Record<PermKey, PermPolicy | undefined>>({
  location: getPermPolicy('location'),
  microphone: (() => {
    const m = getMicPermission();
    if (m === 'always') return 'always';
    if (m === 'once') return 'session';
    if (m === 'never') return 'never';
    return undefined;
  })(),
});

  // Passkey state
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const hasPk = passkeys.length > 0;

  // Push notifications
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState<'checking' | 'blocked' | 'granted' | 'registered' | 'prompt'>('checking');

  // Coins summary
  const [coins, setCoins] = useState<{
    total_coins: number;
    dailyEarned: number;
    monthlyEarned: number;
    dailyRemaining: number;
    monthlyRemaining: number;
    dailyCap: number;
    monthlyCap: number;
    redeemableCap: number;
  } | null>(null);

  // Referrals
  const [refBusy, setRefBusy] = useState(false);
  const [refStatus, setRefStatus] = useState<{
    code: string | null;
    uses: number;
    uses_limit: number;
    redeemed?: any;
    rewards?: { referrer: number; redeemer: number };
  } | null>(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);
  const [redeemErr, setRedeemErr] = useState<string | null>(null);

  const refreshPushStatus = useCallback(() => {
    try {
      const perm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
      const cached = (() => {
        try { return localStorage.getItem('bw.push.token'); } catch { return null; }
      })();
      if (perm === 'denied') {
        setPushStatus('blocked');
      } else if (cached && perm === 'granted') {
        setPushStatus('registered');
      } else if (perm === 'granted') {
        setPushStatus('granted');
      } else {
        setPushStatus('prompt');
      }
    } catch {
      setPushStatus('prompt');
    }
  }, []);

  const fetchPushStatus = useCallback(async () => {
    try {
      const user = getAuth().currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch(`${resolveApiBase()}/push/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setPushStatus(data.registered ? 'registered' : 'granted');
      }
    } catch {
      /* ignore */
    }
  }, []);

  const refreshPasskeys = useCallback(async () => {
    if (!phone) {
      setPasskeys([]);
      return;
    }
    try {
      const list = await fetchPasskeys();
      setPasskeys(list);
    } catch (err) {
      console.warn('fetchPasskeys(settings) failed', err);
      setPasskeys([]);
    }
  }, [phone]);

  useEffect(() => {
    refreshPasskeys();
    const handler = () => refreshPasskeys();
    window.addEventListener('bw:passkey:set' as any, handler as any);
    return () => {
      window.removeEventListener('bw:passkey:set' as any, handler as any);
    };
  }, [refreshPasskeys]);

  useEffect(() => {
    refreshPushStatus();
    fetchPushStatus();
  }, [refreshPushStatus, fetchPushStatus]);

  // Referral status loader
  const loadReferral = useCallback(async () => {
    if (!getAuth().currentUser) return;
    try {
      setRefBusy(true);
      const res = await getReferralStatus();
      setRefStatus({
        code: res.code ?? null,
        uses: Number(res.uses || 0),
        uses_limit: Number(res.uses_limit || 3),
        redeemed: res.redeemed,
        rewards: res.rewards,
      });
    } catch (err: any) {
      setRefStatus(null);
      console.warn('referral status failed', err);
    } finally {
      setRefBusy(false);
    }
  }, []);

  useEffect(() => {
    loadReferral();
  }, [loadReferral, uid]);

  useEffect(() => {
    if (!uid) return;
    getCoinsSummary()
      .then((res) => setCoins(res))
      .catch((err) => {
        logError('getCoinsSummary settings failed', { err: String(err) });
        setCoins(null);
      });
  }, [uid]);

  useEffect(() => {
    const onCoins = () => {
      if (!uid) return;
      getCoinsSummary()
        .then((res) => setCoins(res))
        .catch((err) => {
          logError('getCoinsSummary refresh failed', { err: String(err) });
          setCoins(null);
        });
    };
    window.addEventListener('bw:coins:updated' as any, onCoins as any);
    return () => window.removeEventListener('bw:coins:updated' as any, onCoins as any);
  }, [uid]);

  // Keep local radio state in sync if changed elsewhere
  useEffect(() => {
    const refresh = () => {
      setPolicies({
        location: getPermPolicy('location'),
        microphone: (() => {
          const m = getMicPermission();
          if (m === 'always') return 'always';
          if (m === 'once') return 'session';
          if (m === 'never') return 'never';
          return undefined;
        })(),
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
    if (key === 'microphone') {
      const v = value === 'always' ? 'always' : value === 'session' ? 'once' : 'never';
      setMicPermission(v);
    } else {
      setPermPolicy(key, value);
    }
    setPolicies((s) => ({ ...s, [key]: value }));
    try { window.dispatchEvent(new Event('bw:perm:changed')); } catch {}
    toast.success('Saved preference');
  };

  const clearPolicyHandler = (key: PermKey) => {
    if (key === 'microphone') {
      setMicPermission('unknown');
      setPolicies((s) => ({ ...s, [key]: undefined }));
    } else {
      clearPermPolicy(key);
      setPolicies((s) => ({ ...s, [key]: undefined }));
    }
    try { window.dispatchEvent(new Event('bw:perm:changed')); } catch {}
    toast.success('Cleared preference');
  };

  const requestNativePrompt = async (key: PermKey) => {
    if (key === 'location') {
      try {
        const { getCurrentPosition } = await import('../../lib/location');
        await getCurrentPosition(4000);
      } catch {}
    } else if (key === 'microphone') {
      try {
        if (
          navigator.mediaDevices?.getUserMedia &&
          (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))
        ) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
          allowForThisSession('microphone');
          try { window.dispatchEvent(new Event('bw:perm:changed')); } catch {}
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
      microphone: gateMic(),
    };
  }, [decLoc, decMic]);

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

  const removePasskey = async (id: string) => {
    if (!id) return;
    setPasskeyBusy(true);
    try {
      await deletePasskey(id);
      toast.success('Passkey removed');
      await refreshPasskeys();
    } catch (err) {
      console.warn('removePasskey failed', err);
      toast.error('Could not remove passkey');
    } finally {
      setPasskeyBusy(false);
    }
  };

  const goSetPasskey = () => {
    nav('/onboarding/setpasskey');
  };

  const enablePush = async () => {
    if (!uid) {
      toast.error('Sign in to enable push notifications.');
      return;
    }
    setPushBusy(true);
    try {
      const { initOrRefreshPushOnAuth } = await loadNotify();
      await initOrRefreshPushOnAuth(phone || undefined);
      refreshPushStatus();
      await fetchPushStatus();
      toast.success('Push notifications enabled');
    } catch (err) {
      console.warn('enablePush failed', err);
      toast.error('Could not enable push. Check permissions and try again.');
    } finally {
      setPushBusy(false);
    }
  };

  const sendPushTest = async () => {
    if (!uid) {
      toast.error('Sign in to send a test notification.');
      return;
    }
    setPushBusy(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('missing token');
      const res = await fetch(`${resolveApiBase()}/push/sendTest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: 'BiteWise', body: 'Notifications are live!' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || res.statusText);
      }
      toast.success('Test notification sent');
    } catch (err) {
      console.warn('sendPushTest failed', err);
      // Fallback: local notification if permission is granted
      const { sendLocalTestNotification } = await loadNotify();
      const shown = await sendLocalTestNotification('BiteWise test', 'If you see this, push works locally.');
      if (!shown) toast.error('Could not send test. Check permissions.');
    } finally {
      setPushBusy(false);
    }
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
    const decision = k === 'location' ? decLoc : decMic;
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => requestNativePrompt(k)}
              className="text-xs px-2 py-1 rounded-lg bg-black/10 dark:bg-white/20 hover:bg-black/20"
            >
              Re-check
            </button>
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

        <NotificationsPanel />
        <PushStatus />

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

      <Link
        to="/legal/delete-account"
        className="px-3 py-1.5 rounded-xl bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
      >
        Delete account
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

        {/* Coins & Rewards */}
        <section className="rounded-2xl bg-white/70 dark:bg-white/10 p-4 shadow text-sm space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-base font-semibold">BiteCoins</div>
              <div className="opacity-80">
                Daily cap {coins?.dailyCap ?? 30}, monthly cap {coins?.monthlyCap ?? 500}. Up to 80% redeemable monthly.
              </div>
            </div>
            <button
              onClick={() => nav('/legal/rewards')}
              className="px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/20 hover:bg-black/20"
            >
              View policy
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/15 bg-white/70 dark:bg-white/5 p-3">
              <div className="text-xs uppercase tracking-[0.18em] text-white/60">Balance</div>
              <div className="text-3xl font-semibold mt-1">{coins?.total_coins ?? '—'}</div>
              <div className="text-xs opacity-70 mt-1">
                Redeemable this month: {coins ? Math.max(0, Math.min(coins.redeemableCap, coins.monthlyCap * 0.8)) : '—'}
              </div>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/70 dark:bg-white/5 p-3 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span>Today earned</span>
                <span className="font-semibold">{coins?.dailyEarned ?? '—'} / {coins?.dailyCap ?? 30}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Remaining today</span>
                <span className="font-semibold">{coins?.dailyRemaining ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>This month earned</span>
                <span className="font-semibold">{coins?.monthlyEarned ?? '—'} / {coins?.monthlyCap ?? 500}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Remaining this month</span>
                <span className="font-semibold">{coins?.monthlyRemaining ?? '—'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Referrals */}
        <section className="rounded-2xl bg-white/70 dark:bg-white/10 p-4 shadow text-sm space-y-3">
          <div className="flex flex-col gap-1">
            <div className="text-base font-semibold">Referrals</div>
            <div className="opacity-80">
              Share your code to earn coins. Referrer +{refStatus?.rewards?.referrer ?? 50} coins,
              friend +{refStatus?.rewards?.redeemer ?? 25} coins. Cap: 3 redemptions per code.
            </div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/70 dark:bg-white/5 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm opacity-75">Your code</div>
              <div className="text-2xl font-extrabold tracking-widest">
                {refStatus?.code || 'Not generated'}
              </div>
              <div className="text-xs opacity-70">
                Uses: {refStatus?.uses ?? 0}/{refStatus?.uses_limit ?? 3}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:flex-nowrap">
              <button
                disabled={refBusy}
                onClick={async () => {
                  if (refStatus?.code) {
                    try {
                      await navigator.clipboard?.writeText(refStatus.code);
                      toast.success('Copied');
                    } catch {
                      toast.error('Copy failed');
                    }
                    return;
                  }
                  setRefBusy(true);
                  try {
                    const res = await createReferralCode();
                    setRefStatus((s) => ({
                      ...(s || { uses: 0, uses_limit: res.uses_limit ?? 3, redeemed: null }),
                      code: res.code,
                      uses: res.uses ?? 0,
                      uses_limit: res.uses_limit ?? 3,
                    }));
                    toast.success('Code created');
                  } catch (err: any) {
                    toast.error(err?.message || 'Could not create code');
                  } finally {
                    setRefBusy(false);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/20 hover:bg-black/20 disabled:opacity-50"
              >
                {refStatus?.code ? 'Copy code' : 'Generate code'}
              </button>
              {refStatus?.code ? (
                <button
                  disabled={refBusy}
                  onClick={async () => {
                    try {
                      if (navigator.share) {
                        await navigator.share({
                          title: 'BiteWise referral',
                          text: `Use my BiteWise code ${refStatus.code} to earn coins!`,
                        });
                      } else if (navigator.clipboard) {
                        await navigator.clipboard.writeText(refStatus.code);
                        toast.success('Copied to share');
                      }
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50"
                >
                  Share
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/60 dark:bg-white/5 p-3 space-y-2">
            <div className="text-sm font-semibold">Redeem a code</div>
            <div className="text-xs opacity-70">One redemption per account.</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
                className="px-3 py-2 rounded-xl bg-white/80 dark:bg-black/20 border border-white/20 text-sm"
              />
              <button
                disabled={refBusy}
                onClick={async () => {
                  setRedeemErr(null);
                  setRedeemMsg(null);
                  setRefBusy(true);
                  try {
                    await redeemReferralCode(redeemCode);
                    setRedeemMsg('Code applied! Rewards will reflect in coins shortly.');
                    toast.success('Redeemed');
                    await loadReferral();
                  } catch (err: any) {
                    const msg = err?.message || 'Failed';
                    setRedeemErr(msg);
                    toast.error(msg);
                  } finally {
                    setRefBusy(false);
                  }
                }}
                className="px-3 py-2 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50"
              >
                Redeem
              </button>
            </div>
            {redeemMsg ? <div className="text-xs text-green-200">{redeemMsg}</div> : null}
            {redeemErr ? <div className="text-xs text-red-200">{redeemErr}</div> : null}
            {refStatus?.redeemed ? (
              <div className="text-xs text-white/80">
                Already redeemed code {refStatus.redeemed.code} on{' '}
                {new Date(refStatus.redeemed.redeemed_at).toLocaleDateString()}.
              </div>
            ) : null}
          </div>
        </section>

        {/* Permissions */}
        <section className="space-y-4">
          <div className="text-white/95 font-semibold">Permissions</div>

          {/* Push Notifications */}
          <div className="rounded-2xl bg-white/70 dark:bg-white/10 p-4 shadow">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="text-base font-semibold">Push notifications</div>
                <div className="text-sm opacity-80">
                  Alerts for price drops, big discounts, coupons, and new favorites in town.
                </div>
                <div className="text-xs opacity-75">
                  Status:{' '}
                  <span className="font-medium">
                    {pushStatus === 'checking'
                      ? 'Checking...'
                      : pushStatus === 'registered'
                      ? 'Enabled'
                      : pushStatus === 'granted'
                      ? 'Allowed (not registered)'
                      : pushStatus === 'blocked'
                      ? 'Blocked in browser'
                      : 'Not enabled'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  disabled={pushBusy}
                  onClick={enablePush}
                  className="px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/20 hover:bg-black/20 disabled:opacity-50"
                >
                  {pushStatus === 'blocked' ? 'Open settings & retry' : 'Enable push'}
                </button>
                <button
                  disabled={pushBusy || pushStatus === 'prompt'}
                  onClick={sendPushTest}
                  className="px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/20 hover:bg-black/20 disabled:opacity-50"
                >
                  Send test
                </button>
              </div>
            </div>
          </div>

          <PolicyRadios
            k="location"
            label="Location"
            helper="Used to show availability and prices near you."
          />
          <PolicyRadios
            k="microphone"
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
                  className="rounded-xl border bg-white/80 dark:bg-white/10 p-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 w-full">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">{a.label || 'Saved'}</div>
                      {a.active ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/10">
                          Active
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs opacity-80 break-words">{a.addressLine}</div>
                    <div className="text-[11px] opacity-60 mt-0.5">
                      {a.lat.toFixed(5)}, {a.lng.toFixed(5)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:justify-end w-full sm:w-auto">
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
        <section className="rounded-2xl bg-white/70 dark:bg-white/10 p-4 shadow text-sm space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-base font-semibold">Quick Unlock Passkey</div>
              <div className="opacity-80">
                {hasPk
                  ? 'You have passkeys registered for this account.'
                  : 'No passkeys yet. Add one to unlock quickly after idle.'}
              </div>
            </div>
            <button
              onClick={goSetPasskey}
              className="px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/20 hover:bg-black/20"
            >
              {hasPk ? 'Add another' : 'Set Passkey'}
            </button>
          </div>
          {hasPk ? (
            <div className="space-y-2">
              {passkeys.map((pk) => (
                <div
                  key={pk.id}
                  className="rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">{pk.label || pk.deviceType || 'Passkey'}</div>
                    <div className="text-xs opacity-70">
                      Last used {formatPasskeyTimestamp(pk.lastUsedAt || pk.createdAt)}
                    </div>
                  </div>
                  <button
                    disabled={passkeyBusy}
                    onClick={() => removePasskey(pk.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-black/20 dark:border-white/30 hover:bg-black/5 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-black/20 dark:border-white/20 p-3 text-xs opacity-70">
              When you register a passkey we’ll show device info here so you can revoke it later.
            </div>
          )}
        </section>

        {/* Legal */}
        <section className="rounded-2xl bg-white/70 dark:bg-white/10 p-4 shadow text-sm space-y-2">
          <div className="flex flex-col gap-1">
            <div className="text-base font-semibold">Legal</div>
            <p className="opacity-80">
              Learn how we protect your data and the rules that govern BiteWise.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/legal/terms"
              className="flex-1 rounded-xl border border-white/30 px-3 py-2 hover:bg-white/5 text-center"
            >
              Terms of Service
            </Link>
            <Link
              to="/legal/privacy"
              className="flex-1 rounded-xl border border-white/30 px-3 py-2 hover:bg-white/5 text-center"
            >
              Privacy Policy
            </Link>
            <Link
              to="/legal/rewards"
              className="flex-1 rounded-xl border border-white/30 px-3 py-2 hover:bg-white/5 text-center"
            >
              Rewards & Notifications
            </Link>
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

        {/* Feedback */}
        <section className="rounded-2xl bg-white/70 dark:bg-white/10 p-4 shadow text-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold">Feedback for testers</div>
              <div className="opacity-80">
                Spot a bug or confusing flow? Share details so we can fix it before launch.
              </div>
            </div>
            <Link
              to="/feedback"
              className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400"
            >
              Send feedback
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
