// src/lib/notifications.ts
import { emit } from './events';
import { getAuth } from 'firebase/auth';
import { getActivePhone } from './profileStore';

export type NoticeKind = 'price' | 'tasks' | 'savings' | 'milestone' | 'system';
export type Notice = {
  id: string;
  title: string;
  body?: string;
  ts: number;
  kind: NoticeKind;
  read?: boolean;
};

const LS_KEY = 'bw.notifications.inbox';
const BADGE_KEY = 'bw.badge.notifications';

export function getInbox(): Notice[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}

function setUnreadBadgeFromInbox(inbox: Notice[]) {
  try {
    const unread = inbox.filter(n => !n.read).length;
    localStorage.setItem(BADGE_KEY, String(unread));
  } catch {}
}

export function setInbox(list: Notice[]) {
  const trimmed = list.slice(0, 200);
  localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
  setUnreadBadgeFromInbox(trimmed);
  emit('bw:badges:update', null);
}

function canNotify(): boolean {
  try {
    if (sessionStorage.getItem('bw.session.phone')) return true;
  } catch {}
  try {
    if (getAuth().currentUser) return true;
  } catch {}
  try {
    if (getActivePhone()) return true;
  } catch {}
  return false;
}

export function addNotice(n: Omit<Notice, 'id'|'ts'> & Partial<Pick<Notice,'id'|'ts'>>) {
  if (!canNotify()) return undefined;
  const item: Notice = { id: n.id || crypto.randomUUID(), ts: n.ts || Date.now(), read: false, ...n };
  const list = [item, ...getInbox()];
  setInbox(list);

  // Single toast channel (ToastHost only listens to 'bw:toast')
  emit('bw:toast', { title: item.title, body: item.body });

  return item.id;
}

export function markAllRead() {
  const updated = getInbox().map(n => ({ ...n, read: true }));
  setInbox(updated);
}

export function clearAll() { setInbox([]); }

// Optional helper: let header refresh
export function bumpBadge(_key: 'notifications' | 'tasks' | 'leaderboard', _by = 1) {
  emit('bw:badges:update', null);
}
