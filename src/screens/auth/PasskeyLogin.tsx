// src/screens/auth/PasskeyLogin.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clearSessionPerms } from '../../lib/permPrefs';
import { emit } from '../../lib/events';
import { decidePerm } from '../../lib/permPrefs';

const LAST_ROUTE_KEY = 'bw.lastRoute';

export default function PasskeyLogin() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const reason = useMemo(() => params.get('reason') || '', [params]);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (reason === 'idle') {
      try { clearSessionPerms(); } catch {}
      try { sessionStorage.setItem('bw.requirePermRecheck', '1'); } catch {}
      try { emit('bw:perm:changed', null); } catch {}
    }
  }, [reason]);

  const lastRoute = () => {
    try { return sessionStorage.getItem(LAST_ROUTE_KEY) || '/home'; } catch { return '/home'; }
  };

  function markAuthed() {
    try { sessionStorage.setItem('bw.session.phone', 'passkey'); } catch {}
    try { sessionStorage.removeItem('bw.logoutReason'); } catch {}
    try { window.dispatchEvent(new Event('bw:auth:changed')); } catch {}
    try {
      window.dispatchEvent(new StorageEvent('storage', { key: 'bw.session.phone', newValue: 'passkey' } as any));
    } catch {}
  }

  function unlock() {
    const pin = (code || '').trim();
    if (pin.length < 4 || pin.length > 6) return;

    // Force re-prompts after this unlock (for all “Only this time” perms)
    try { clearSessionPerms(); } catch {}
    try { sessionStorage.setItem('bw.requirePermRecheck', '1'); } catch {}
    try { sessionStorage.setItem('bw.justUnlocked', '1'); } catch {}

    markAuthed();

    // 🔹 Optional: trigger permission-step recheck for "Only this time" policies
setTimeout(() => {
  try {
    if (decidePerm('location') === 'ask') {
      nav('/onboarding/perm/location', { replace: true });
    } else if (decidePerm('notifications') === 'ask') {
      nav('/onboarding/perm/notifications', { replace: true });
    } else if (decidePerm('mic') === 'ask') {
      nav('/onboarding/perm/mic', { replace: true });
    }
  } catch {}
}, 0);

    const target = lastRoute();
    nav(target, { replace: true });

    // Kick the recheck loop as soon as we land
    setTimeout(() => { try { emit('bw:perm:recheck', null); } catch {} }, 0);
  }

  function goOtp() {
    const redirect = lastRoute();
    try { sessionStorage.setItem('bw.auth.redirect', redirect); } catch {}
    nav(`/auth/phone?redirect=${encodeURIComponent(redirect)}`, { replace: true });
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-500 to-orange-400 grid place-items-center">
      <div className="w-[min(92vw,380px)] rounded-2xl border bg-white/95 shadow p-4 space-y-3">
        <h1 className="text-lg font-semibold">Unlock</h1>
        {reason === 'idle' && (
          <p className="text-sm opacity-70">You were locked for inactivity. Sign in to continue.</p>
        )}
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Enter 4–6 digit passkey"
          className="w-full rounded-xl border px-3 py-2 bg-white"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && unlock()}
          autoFocus
        />
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={unlock}>Unlock</button>
          <button className="px-3 py-2 rounded-xl border" onClick={() => nav('/onboarding/auth/phone?mode=login', {replace: true })}
         >
         Use OTP instead
         </button>
        </div>
      </div>
    </main>
  );
}
