// src/shell/AppShell.tsx
import React, { Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import ToastHost from '../components/ToastHost';
import RewardHost from '../components/RewardHost';
import ConfettiBurst from '../components/ConfettiBurst';
import { MissionStatsProvider } from '../components/StreakBadge';
import AppFooter from '../components/AppFooter';
import { clearSessionPerms, decidePerm } from '../lib/permPrefs';
import { setLastRoute, getActivePhone, getLastRoute } from '../lib/profileStore';
import { emit, on } from '../lib/events';
import { ensureFirebaseBoot } from '../lib/firebaseBoot';
import { toast } from '../store/toast';
import { track } from '../lib/track';
import TourOverlay from '../components/TourOverlay';
import { shouldAutoStartTour, useTour } from '../store/tour';
import OfflineBanner from '../components/OfflineBanner';
import OfflineTooltip from '../components/OfflineTooltip';
const lazyCloud = () => import('../lib/cloudProfile');
const lazyTokens = () => import('../lib/tokens');
const lazyNotify = () => import('../lib/notify');
const lazyReturn = () => import('../lib/orderReturn');
import BannerHost from '../components/BannerHost';
let authMod: Promise<typeof import('firebase/auth')> | null = null;
const loadAuth = () => {
  if (!authMod) authMod = import('firebase/auth');
  return authMod;
};
const ReturnBanner = React.lazy(() => import('../components/ReturnBanner'));

// Idle logout threshold (15 minutes)
const IDLE_MS = 15 * 60 * 1000;
const FEED_KIND = import.meta.env.VITE_FEED || 'dummy';

export default function AppShell() {
  const nav = useNavigate();
  const location = useLocation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [offline, setOffline] = React.useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    return navigator.onLine === false;
  });
  const hideTimestampRef = React.useRef<number | null>(null);

  // Eagerly boot Firebase once for the app shell to avoid race conditions (analytics/auth)
  useEffect(() => {
    ensureFirebaseBoot().catch(() => {});
  }, []);

  // Reload if the tab was hidden for >30 minutes
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        hideTimestampRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        const last = hideTimestampRef.current;
        if (last != null && Date.now() - last > 30 * 60 * 1000) {
          window.location.reload();
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // One-time cleanup of legacy session flags to avoid skipping OTP
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const MIGRATION_FLAG = 'bw.migration.v1.clearedStaleAuth';
    if (localStorage.getItem(MIGRATION_FLAG)) return;
    try {
      sessionStorage.removeItem('bw.session.phone');
      sessionStorage.removeItem('bw.active.phone');
      sessionStorage.removeItem('bw.session.phoneVerified'); // will be set after OTP
    } catch {}
    // Best-effort sign out stale Firebase session
    import('firebase/auth')
      .then(({ getAuth, signOut }) => {
        try { signOut(getAuth()).catch(() => {}); } catch {}
      })
      .catch(() => {});
    try { localStorage.setItem(MIGRATION_FLAG, '1'); } catch {}
  }, []);

  // Migrate legacy microphone keys to the canonical permPrefs.microphone storage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('bw:permPrefs:v1');
      if (raw && raw.includes('"mic"')) {
        const parsed = JSON.parse(raw || '{}') || {};
        if (parsed.mic && !parsed.microphone) {
          parsed.microphone = parsed.mic;
          delete parsed.mic;
          localStorage.setItem('bw:permPrefs:v1', JSON.stringify(parsed));
        }
      }
      if (sessionStorage.getItem('bw:permSession:mic') === '1') {
        sessionStorage.removeItem('bw:permSession:mic');
        sessionStorage.setItem('bw:permSession:microphone', '1');
      }
    } catch {
      /* ignore */
    }
  }, []);

  // App open + daily session ping
  useEffect(() => {
    try {
      track('app_open');
      const today = new Date().toISOString().slice(0, 10);
      const last = localStorage.getItem('bw.session.ping');
      if (last !== today) {
        localStorage.setItem('bw.session.ping', today);
        track('session_daily_ping', { date: today });
      }

      // Retention markers (install date based)
      const install = localStorage.getItem('bw.install.date') || today;
      localStorage.setItem('bw.install.date', install);
      const daysSince = Math.floor(
        (new Date(today).getTime() - new Date(install).getTime()) / 86400000
      );
      if (daysSince === 1) track('day1_return');
      if (daysSince === 7) track('day7_return');
    } catch {}
  }, []);

  // If no verified session but passkey hint exists, route to quick unlock on auth screens
  useEffect(() => {
    try {
      const hasSession = !!sessionStorage.getItem('bw.session.phoneVerified');
      const hasPasskey = localStorage.getItem('bw:hasPasskey') === 'true';
      const lastPhone = localStorage.getItem('bw:lastUserPhone') || localStorage.getItem('bw.lastPhone');
      const path = location.pathname;
      const onAuthScreens =
        path === '/' ||
        path.startsWith('/onboarding') ||
        path.startsWith('/auth') ||
        path === '/unlock';
      if (!hasSession && hasPasskey && lastPhone && onAuthScreens) {
        nav('/quick-unlock', { replace: true });
      }
    } catch {}
  }, [location.pathname, nav]);

  // Eagerly boot Firebase so downstream callers (analytics/auth) always have a default app
  useEffect(() => {
    ensureFirebaseBoot().catch(() => {});
  }, []);

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

  // Listen for SW update notifications and offer a one-click reload
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data: any = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'SW_UPDATED') {
        toast.push('BiteWise just updated');
        try {
          navigator.serviceWorker
            .getRegistration()
            .then((reg) => {
              reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
              window.setTimeout(() => window.location.reload(), 150);
            })
            .catch(() => window.location.reload());
        } catch {
          window.location.reload();
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  const hasActiveSession = () => {
    try { return !!sessionStorage.getItem('bw.session.phone'); } catch { return false; }
  };
  const isVerifiedAuth = () => {
    try { return sessionStorage.getItem('bw.auth.verified') === '1'; } catch { return false; }
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

  /* Ensure Firebase is warmed up for onboarding/auth routes */
  useEffect(() => {
    const path = location.pathname;
    const needsImmediate =
      path.startsWith('/onboarding') ||
      path.startsWith('/auth') ||
      path === '/unlock';
    if (needsImmediate || hasActiveSession()) {
      ensureFirebaseBoot().catch(() => {});
    }
  }, [location.pathname]);

  /* Redirect on auth change ONLY from Unlock (not during onboarding) */
  useEffect(() => {
    const handleAuth = async () => {
      try {
        // Hydrate session phone from persisted local storage on cold start so returning users don't hit Unlock.
        try {
          const existingSession = sessionStorage.getItem('bw.session.phone');
          const persisted = localStorage.getItem('bw.active.phone');
          if (!existingSession && persisted) {
            sessionStorage.setItem('bw.session.phone', persisted);
          }
        } catch {}

        const { getAuth } = await loadAuth();
        const authedUser = getAuth().currentUser;
        const sessionPhone = sessionStorage.getItem('bw.session.phone');
        const verified = isVerifiedAuth();

        // Only redirect when both a confirmed user and a session phone are present (prevents jumping to Home before OTP is done).
        const isFullyAuthed = !!authedUser?.phoneNumber && !!sessionPhone && verified;
        if (!isFullyAuthed) return;

        const path = location.pathname;
        const fromUnlock = path === '/unlock';
        const inOnboarding = path.startsWith('/onboarding');
        if (!fromUnlock || inOnboarding) return;

        // ✅ ensure push is “registered” locally when we successfully unlock
        try {
          const notify = await lazyNotify();
          await notify.initOrRefreshPushOnAuth(getActivePhone() || undefined);
        } catch {}

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
      const { getAuth } = await loadAuth();
      const authed = !!getAuth().currentUser;
      if (authed && hasActiveSession() && getActivePhone()) {
        const cloud = await lazyCloud();
        await cloud.hydrateActiveFromCloud();
        await cloud.pushActiveToCloud();
        const tokens = await lazyTokens();
        await tokens.syncTokensFromCloud();
        try {
          const tasksMod = await import('../lib/tasks');
          if (typeof tasksMod.syncMissionsWithCloud === 'function') {
            await tasksMod.syncMissionsWithCloud();
          }
        } catch (err) {
          console.warn('[missions] sync skipped', err);
        }
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
          const notify = await lazyNotify();
          await notify.initOrRefreshPushOnAuth(getActivePhone() || undefined);
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
    let stop: (() => void) | null = null;
    let cancelled = false;
    let idleHandle: ReturnType<typeof setTimeout> | ReturnType<typeof window.setTimeout> | null = null;

    const boot = async () => {
      try {
        const mod = await lazyReturn();
        if (cancelled) return;
        stop = mod.initReturnListener();
      } catch (err) {
        console.error('Return listener failed', err);
      }
    };

    if ('requestIdleCallback' in window) {
      idleHandle = (window as any).requestIdleCallback(
        () => {
          idleHandle = null;
          boot();
        },
        { timeout: 2000 }
      );
    } else {
      idleHandle = setTimeout(() => {
        idleHandle = null;
        boot();
      }, 1200);
    }

    return () => {
      cancelled = true;
      if (idleHandle != null) {
        if ('cancelIdleCallback' in window && typeof (window as any).cancelIdleCallback === 'function') {
          (window as any).cancelIdleCallback(idleHandle);
        } else {
          window.clearTimeout(idleHandle);
        }
      }
      stop?.();
    };
  }, []);

  /* Cloud hydrate/push */
  useEffect(() => {
    const run = async () => {
      try {
        if (hasActiveSession() && getActivePhone()) {
          const cloud = await lazyCloud();
          await cloud.hydrateActiveFromCloud();
          await cloud.pushActiveToCloud();
        }
      } catch {}
    };
    run();
    const off = on('bw:auth:changed', run);
    return () => off();
  }, []);

  /* Idle logout */
  useEffect(() => {
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
      timerRef.current = setTimeout(async () => {
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
      const { getAuth, signOut } = await loadAuth();
      await signOut(getAuth());
    } catch {
      // ignore network / already-signed-out errors
    }

    // 3. clear in-tab auth hints
    try {
      sessionStorage.removeItem('bw.session.phone');
      sessionStorage.removeItem('bw.auth.verified');
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

  /* Offline/online detection with toasts */
  useEffect(() => {
        const handle = () => {
          const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
          setOffline(isOffline);
          if (isOffline) {
            toast.error('You are offline. We will retry when back online.');
          } else {
            toast.success('Back online');
          }
        };
    window.addEventListener('online', handle);
    window.addEventListener('offline', handle);
    handle();
    return () => {
      window.removeEventListener('online', handle);
      window.removeEventListener('offline', handle);
    };
  }, []);

  /* Tasks engine */
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let cancelled = false;

    const boot = async () => {
      try {
        const mod = await import('../lib/TaskEngine');
        if (cancelled) return;
        cleanup = mod.startTaskEngine();
      } catch (err) {
        console.error('Task engine failed to start', err);
      }
    };

    let idleId: ReturnType<typeof setTimeout> | ReturnType<typeof window.setTimeout> | null = null;
    const idleCb = () => {
      idleId = null;
      boot();
    };

    if ('requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(idleCb, { timeout: 2000 });
    } else {
      idleId = setTimeout(idleCb, 1200);
    }

    return () => {
      cancelled = true;
      if (idleId != null) {
        if ('cancelIdleCallback' in window && typeof (window as any).cancelIdleCallback === 'function') {
          (window as any).cancelIdleCallback(idleId);
        } else {
          window.clearTimeout(idleId);
        }
      }
      cleanup?.();
    };
  }, []);

  /* Passive live pings */
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | ReturnType<typeof window.setTimeout> | null = null;

    const boot = async () => {
      try {
        const mod = await import('../lib/location');
        if (cancelled) return;
        stop = mod.startLiveLocationWatcher(20000);
      } catch (err) {
        console.error('Live location watcher failed to start', err);
      }
    };

    timer = setTimeout(boot, 1500);

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
      stop?.();
    };
  }, []);

  /* Auto-start guided tour once */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const path = location.pathname;
      const inAuthFlow =
        path.startsWith('/onboarding') ||
        path.startsWith('/auth') ||
        path === '/unlock';
      if (inAuthFlow) return;
      if (!hasActiveSession()) return;

      const tourState = useTour.getState();
      if (tourState.active || tourState.steps.length > 0) return;
      if (!shouldAutoStartTour()) return;

      tourState.setSteps([
        { id: 'addr', selector: '#nav-address', title: 'Your address', body: 'Quickly confirm or change your delivery address here.' },
        { id: 'mic', selector: '#nav-mic', title: 'Voice search', body: 'Tap the mic to search by voice.' },
        { id: 'cart', selector: '#nav-cart', title: 'Cart', body: 'View your items and checkout.' },
        { id: 'bot', selector: '#yummibot-trigger', title: 'YummiBot', body: 'Chat for trending picks, favorites, and quick suggestions.' },
        { id: 'menu', selector: '#nav-menu', title: 'Settings & more', body: 'Open settings, passkeys, notifications, referrals, and BiteCoins.' },
      ]);
      tourState.start();
    } catch {
      // fail-safe: do nothing if tour cannot start
    }
  }, [location.pathname]);

  return (
    <MissionStatsProvider>
      <div className="app-shell">
        <OfflineBanner offline={offline} />
        <div className="app-shell__aurora" aria-hidden="true" />
        <div className="app-shell__noise" aria-hidden="true" />
        <main className="app-shell__content">
          <Outlet />
          <AppFooter />
        </main>
        <ConfettiBurst />
        <RewardHost />
        <ToastHost />
        <TourOverlay />
        <OfflineTooltip offline={offline} />
        <Suspense fallback={null}>
          <BannerHost />
        </Suspense>
      </div>
    </MissionStatsProvider>
  );
}
