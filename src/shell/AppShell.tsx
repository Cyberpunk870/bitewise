// src/shell/AppShell.tsx
import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import ToastHost from '../components/ToastHost';
import { clearSessionPerms, decidePerm } from '../lib/permPrefs';
import { emit } from '../lib/events';
import { getCurrentPosition } from '../lib/location';
import { startTaskEngine } from '../lib/TaskEngine';
import { startTaskAutoTracking } from '../lib/tasks';

const IDLE_MS = 60 * 1000; // adjust

export default function AppShell() {
  const nav = useNavigate();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const stop = startTaskEngine();
    return () => stop?.();

  }, []);

  useEffect(() => { startTaskAutoTracking(); }, []);

  // ✅ One-shot: after unlock, if we set flags, trigger native prompts once
  useEffect(() => {
    const justUnlocked = sessionStorage.getItem('bw.justUnlocked') === '1';
    const needsRecheck = sessionStorage.getItem('bw.requirePermRecheck') === '1';

    if (justUnlocked || needsRecheck) {
      // clear flags so it only runs once
      try { sessionStorage.removeItem('bw.justUnlocked'); } catch {}
      try { sessionStorage.removeItem('bw.requirePermRecheck'); } catch {}

      // Fire a generic recheck signal for any UI listening
      try { emit('bw:perm:recheck', null); } catch {}

      // Location (HTTPS not strictly required for geolocation prompt)
      if (decidePerm('location') === 'ask') {
        getCurrentPosition(4000).catch(() => {});
      }

      // Notifications
      if (decidePerm('notifications') === 'ask' && 'Notification' in window) {
        setTimeout(() => {
          try { Notification.requestPermission().catch(() => {}); } catch {}
        }, 150);
      }

      // Microphone (requires HTTPS or localhost)
      if (
        decidePerm('mic') === 'ask' &&
        navigator.mediaDevices?.getUserMedia &&
        (location.protocol === 'https:' ||
          ['localhost','127.0.0.1'].includes(location.hostname))
      ) {
        setTimeout(() => {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => stream.getTracks().forEach(t => t.stop()))
            .catch(() => {});
        }, 180);
      }
    }
  }, []);

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

          try { clearSessionPerms(); } catch {}

          // Mark that we must re-prompt after the next unlock
          try { sessionStorage.setItem('bw.requirePermRecheck', '1'); } catch {}

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 to-orange-400">
      <Outlet />
      <ToastHost />
    </div>
  );
}
