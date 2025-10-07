import { gateNotifications } from './permGate';

/** Ensure notifications are permitted; otherwise route to the Notifications step. */
export async function ensureNotifPermissionOrRoute(
  nav: (path: string, opts?: any) => void
): Promise<boolean> {
  const g = gateNotifications();
  if (!g.ok) {
    if (g.reason === 'ask')    nav('/onboarding/perm/notifications', { replace: true });
    else if (g.reason === 'denied') {
      alert('Notifications are off for this app. You can change it in the Notifications step.');
      nav('/onboarding/perm/notifications', { replace: true });
    } else {
      alert('Notifications not supported in this browser.');
    }
    return false;
  }
  return true;
}

/** Use this instead of new Notification(...) */
export async function notifyUser(
  nav: (path: string, opts?: any) => void,
  title: string,
  body?: string
) {
  const ok = await ensureNotifPermissionOrRoute(nav);
  if (!ok) return;
  try { new Notification(title, { body }); } catch {}
}
