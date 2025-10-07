// src/shell/AppShell.tsx
import React, { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import ToastHost from '../components/ToastHost';
import RewardHost from '../components/RewardHost';
import { clearSessionPerms, decidePerm } from '../lib/permPrefs';
import { startTaskEngine } from '../lib/TaskEngine';
import { setLastRoute } from '../lib/profileStore';
import { emit, on } from '../lib/events';

const IDLE_MS = 60 * 1000;
const FEED_KIND = import.meta.env.VITE_FEED || 'dummy';

export default function AppShell() {
  const nav = useNavigate();
  const location = useLocation();
  const timerRef = useRef<number | null>(null);

  // Track last route (also mirror to sessionStorage for PasskeyLogin)
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

  // Helper: jump to first permission that is still "ask"
  function goToFirstPendingPermission() {
    // Only run on app pages, not already inside onboarding/auth
    const path = location.pathname;
    if (
      path.startsWith('/onboarding') ||
      path.startsWith('/auth') ||
      path === '/unlock'
    ) return;

    const order: Array<{key:'location'|'notifications'|'mic', route:string}> = [
      { key: 'location',      route: '/onboarding/perm/location' },
      { key: 'notifications', route: '/onboarding/perm/notifications' },
      { key: 'mic',           route: '/onboarding/perm/mic' },
    ];
    const next = order.find(o => decidePerm(o.key) === 'ask');
    if (next) {
      // latch to avoid loops if the user bounces back
      try { sessionStorage.setItem('bw.perm.flow.started', '1'); } catch {}
      nav(next.route, { replace: true });
    }
  }

  /* ------------------ PERMISSION RECHECK ------------------ */
  useEffect(() => {
    const doRecheck = () => {
      try {
        if (sessionStorage.getItem('bw.requirePermRecheck') === '1') {
          sessionStorage.removeItem('bw.requirePermRecheck');

          // Proactively show the first pending permission screen.
          goToFirstPendingPermission();

          // Also nudge the native prompts so the browser re-asks.
          // Location
          if (decidePerm('location') === 'ask') {
            import('../lib/location').then(m => {
              m.getCurrentPosition?.(4000).catch?.(() => {});
            }).catch(() => {});
          }

          // Notifications
          if (decidePerm('notifications') === 'ask' && 'Notification' in window) {
            setTimeout(() => {
              try { (Notification as any).requestPermission?.().catch?.(() => {}); } catch {}
            }, 150);
          }

          // Microphone
          if (
            decidePerm('mic') === 'ask' &&
            navigator.mediaDevices?.getUserMedia &&
            (location.protocol === 'https:' ||
              ['localhost','127.0.0.1'].includes(location.hostname))
          ) {
            setTimeout(() => {
              navigator.mediaDevices!.getUserMedia({ audio: true })
                .then(stream => stream.getTracks().forEach(t => t.stop()))
                .catch(() => {});
            }, 180);
          }

          // Let listeners update any UI
          setTimeout(() => emit('bw:perm:recheck', null), 0);
        }
      } catch {}
    };

    // Run once at mount (covers returning from /unlock)
    doRecheck();
    // Also listen for auth changes
    const off = on('bw:auth:changed', doRecheck);
    return () => off();
  }, [nav, location.pathname]);

  /* --------------- IDLE LOGOUT --------------- */
  useEffect(() => {
    const auth = getAuth();

    const clearTimer = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const scheduleLogout = () => {
      clearTimer();
      timerRef.current = window.setTimeout(async () => {
        try {
          sessionStorage.setItem('bw.logoutReason', 'idle');
          const lastPhone = sessionStorage.getItem('bw.session.phone') || '';
          if (lastPhone) localStorage.setItem('bw.lastPhone', lastPhone);

          try { await signOut(auth); } catch {}

          try {
            sessionStorage.removeItem('bw.session.phone');
            localStorage.removeItem('bw.idle.until');
          } catch {}

          // Clear “Only this time” and mark that we must re-ask after unlock
          try { clearSessionPerms(); } catch {}
          try { sessionStorage.setItem('bw.requirePermRecheck', '1'); } catch {}
          try { sessionStorage.removeItem('bw.perm.flow.started'); } catch {}

          try { window.dispatchEvent(new Event('bw:perm:changed')); } catch {}
          try { window.dispatchEvent(new Event('bw:auth:changed')); } catch {}
          try {
            window.dispatchEvent(
              new StorageEvent('storage', { key: 'bw.session.phone', newValue: null as any })
            );
          } catch {}
        } finally {
          setTimeout(() => nav('/unlock', { replace: true }), 0);
        }
      }, IDLE_MS);
    };

    const onActivity = () => {
      if (document.visibilityState === 'visible') scheduleLogout();
    };

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
    };
  }, [nav]);

  /* --------------- FEED STARTUP --------------- */
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

  // Start task engine once
  useEffect(() => {
    const stop = startTaskEngine();
    return () => stop?.();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 to-orange-400">
      <Outlet />
      <RewardHost />
      <ToastHost />
    </div>
  );
}
