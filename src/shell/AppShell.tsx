// src/shell/AppShell.tsx
import React, { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import ToastHost from '../components/ToastHost';
import RewardHost from '../components/RewardHost';
import ConfettiBurst from '../components/ConfettiBurst';
import { clearSessionPerms, decidePerm } from '../lib/permPrefs';
import { startTaskEngine } from '../lib/TaskEngine';
import { setLastRoute, getActivePhone, getLastRoute } from '../lib/profileStore';
import { emit, on } from '../lib/events';
import { syncTokensFromCloud } from '../lib/tokens';
import ReturnBanner from '../components/ReturnBanner';
import InstallBanner from '../components/InstallBanner';
// 🔄 Cloud profile
import { hydrateActiveFromCloud, pushActiveToCloud } from '../lib/cloudProfile';
// Passive live pings (no prompts)
import { startLiveLocationWatcher } from '../lib/location';

// ✅ NEW: hook up push init when auth/permission are ready
import { initOrRefreshPushOnAuth } from '../lib/notify';
import { initReturnListener } from '../lib/orderReturn';

const IDLE_MS = 60 * 1000;
const FEED_KIND = import.meta.env.VITE_FEED || 'dummy';

export default function AppShell() {
  const nav = useNavigate();
  const location = useLocation();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(async (regs) => {
        const hasPrimary = regs.some((r) => r.active?.scriptURL.includes('pwa-sw.js'));
        if (!hasPrimary) {
          try {
            const reg = await navigator.serviceWorker.register('/pwa-sw.js');
            console.log('[sw] pwa-sw.js registered', reg.scope);
          } catch (e) {
            console.warn('[sw] register failed', e);
          }
        } else {
          console.log('[sw] already registered');
        }
      });
    }
  }, []);

  const hasActiveSession = () => {
    try { return !!sessionStorage.getItem('bw.session.phone'); } catch { return false; }
  };

  /* Track last route (return after unlock) */
  useEffect(() => {
    if (
      !location.pathname.startsWith('/onboarding') &&
      !location.pathname.startsWith('/auth') &&
      location.pathname !== '/unlock'
    ) {
      const path = location.pathname + (location.search || '');
      setLastRoute(path);
      try { sessionStorage.setItem('bw.lastRoute', path); } catch {}
    }
  }, [location.pathname, location.search]);

  /* Redirect on auth change ONLY from Unlock (not during onboarding) */
  useEffect(() => {
    const handleAuth = async () => {
      try {
        if (!hasActiveSession()) return;
        const path = location.pathname;
        const fromUnlock = path === '/unlock';
        const inOnboarding = path.startsWith('/onboarding');
        if (!fromUnlock || inOnboarding) return;

        // ✅ ensure push is “registered” locally when we successfully unlock
        try { await initOrRefreshPushOnAuth(getActivePhone() || undefined); } catch {}

        const last = sessionStorage.getItem('bw.lastRoute') || getLastRoute() || '/home';
        setTimeout(() => nav(last, { replace: true }), 0);
      } catch {
        setTimeout(() => nav('/home', { replace: true }), 0);
      }
    };
    const off = on('bw:auth:changed', handleAuth);
    return () => off();
  }, [nav, location.pathname]);

  /* PERMISSION RECHECK → route to wizard (no silent prompts here) */
  useEffect(() => {
  const run = async () => {
    try {
      const authed = !!getAuth().currentUser;
      if (authed && hasActiveSession() && getActivePhone()) {
        await hydrateActiveFromCloud();
        await pushActiveToCloud();
        await syncTokensFromCloud();
      }
    } catch {}
  };
  run();
  const off = on('bw:auth:changed', run);
  return () => off();
}, []);

  /* ✅ NEW: if notifications flip to granted at runtime, init push */
  useEffect(() => {
    const onPermChanged = async () => {
      try {
        if (decidePerm('notifications') === 'allow' && hasActiveSession()) {
          await initOrRefreshPushOnAuth(getActivePhone() || undefined);
        }
      } catch {}
    };
    const off = on('bw:perm:recheck', onPermChanged);
    window.addEventListener('storage', onPermChanged);
    return () => {
      off();
      window.removeEventListener('storage', onPermChanged);
    };
  }, []);

  useEffect(() => {
    const stop = initReturnListener();
    return () => stop && stop();
    
  }, []);

  /* Cloud hydrate/push */
  useEffect(() => {
    const run = async () => {
      try {
        if (hasActiveSession() && getActivePhone()) {
          await hydrateActiveFromCloud();
          await pushActiveToCloud();
        }
      } catch {}
    };
    run();
    const off = on('bw:auth:changed', run);
    return () => off();
  }, []);

  /* Idle logout */
  useEffect(() => {
    const auth = getAuth();
    const inAuthContext = () => {
      const p = location.pathname;
      return p.startsWith('/onboarding') || p.startsWith('/auth') || p === '/unlock';
    };
    const clearTimer = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    const scheduleLogout = () => {
      clearTimer();
      // ⛔️ Do not arm an idle logout if there is no active session OR we're inside onboarding/auth
      if (!hasActiveSession() || inAuthContext()) return;
      timerRef.current = window.setTimeout(async () => {
  // 1. mark reason + remember phone for prefill
  const lastPhone =
    sessionStorage.getItem('bw.session.phone') || '' ;

  try {
    sessionStorage.setItem('bw.logoutReason', 'idle');
    if (lastPhone) {
      try { localStorage.setItem('bw.lastPhone', lastPhone); } catch {}
    }

    // 2. hard sign out of Firebase so tokens are dead
    try {
      await signOut(getAuth());
    } catch {
      // ignore network / already-signed-out errors
    }

    // 3. clear in-tab auth hints
    try {
      sessionStorage.removeItem('bw.session.phone');
      localStorage.removeItem('bw.idle.until');
    } catch {}

    // 4. broadcast auth change (cart badges, balances, etc.)
    try { window.dispatchEvent(new Event('bw:auth:changed')); } catch {}
    try {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'bw.session.phone',
          newValue: null as any,
        }) as any
      );
    } catch {}
  } finally {
    // 5. go to /unlock
    setTimeout(() => nav('/unlock', { replace: true }), 0);
  }
}, IDLE_MS);
    };
    const onActivity = () => {
      if (document.visibilityState === 'visible') scheduleLogout();
    };
    // initial arm/skip
    scheduleLogout();
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener('mousemove', onActivity, opts);
    window.addEventListener('keydown', onActivity, opts);
    window.addEventListener('click', onActivity, opts);
    window.addEventListener('scroll', onActivity, opts);
    window.addEventListener('wheel', onActivity, opts);
    window.addEventListener('pointerdown', onActivity, opts);
    window.addEventListener('touchstart', onActivity, opts);
    window.addEventListener('visibilitychange', onActivity, opts);
    // reschedule when the session phone changes
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'bw.session.phone') scheduleLogout();
    };
    window.addEventListener('storage', onStorage);
    // cleanup
    return () => {
      clearTimer();
      window.removeEventListener('mousemove', onActivity, opts);
      window.removeEventListener('keydown', onActivity, opts);
      window.removeEventListener('click', onActivity, opts);
      window.removeEventListener('scroll', onActivity, opts);
      window.removeEventListener('wheel', onActivity, opts);
      window.removeEventListener('pointerdown', onActivity, opts);
      window.removeEventListener('touchstart', onActivity, opts);
      window.removeEventListener('visibilitychange', onActivity, opts);
      window.removeEventListener('storage', onStorage);
    };
  }, [nav, location.pathname]);

  /* Feed boot */
  useEffect(() => {
    let stop: (() => void) | null = null;
    (async () => {
      try {
        if (FEED_KIND === 'actowiz') {
          const m = await import('../lib/feed/ActowizAdapter');
          stop = m.startActowizFeed({
            apiBase: import.meta.env.VITE_ACTOWIZ_API,
            token: import.meta.env.VITE_ACTOWIZ_TOKEN,
          });
        } else {
          const m = await import('../lib/feed/DummyAdapter');
          stop = m.startDummyFeed();
        }
      } catch (err) {
        console.error('Feed init failed', err);
      }
    })();
    return () => { stop?.(); };
  }, []);

  /* Tasks engine */
  useEffect(() => {
    const stop = startTaskEngine();
    return () => stop?.();
  }, []);

  /* Passive live pings */
  useEffect(() => {
    const stop = startLiveLocationWatcher(20000);
    return () => stop();
  }, []);

  return (
    <div className="app-shell">
      <div className="app-shell__aurora" aria-hidden="true" />
      <div className="app-shell__noise" aria-hidden="true" />
      <main className="app-shell__content">
        <Outlet />
      </main>
      <ConfettiBurst />
      <RewardHost />
      <ToastHost />
      <ReturnBanner />
      <InstallBanner />
    </div>
  );
}
