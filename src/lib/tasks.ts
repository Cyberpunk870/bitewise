// src/lib/tasks.ts
import { emit, on } from './events';
import { addNotice } from './notifications';
import { getAuth } from 'firebase/auth';
import { addCoins as apiAddCoins } from './api';

/* -------------------------------------------------------------------------- */
/*                                Type system                                 */
/* -------------------------------------------------------------------------- */
export type TaskKind =
  | 'search' | 'voice_search'
  | 'search_filter' | 'search_sort' | 'search_suggestion_click'
  | 'browse' | 'view_restaurant' | 'image_zoom'
  | 'compare_open' | 'compare_done'
  | 'add_to_cart' | 'remove_from_cart' | 'change_qty'
  | 'apply_coupon' | 'checkout_start' | 'payment_success' | 'payment_fail'
  | 'open_tasks' | 'open_leaderboard' | 'open_cart' | 'open_settings'
  | 'change_location' | 'save_address' | 'label_address' | 'switch_profile'
  | 'enable_notifications' | 'deny_notifications' | 'notif_click'
  | 'enable_mic' | 'deny_mic' | 'use_mic'
  | 'pwa_install_prompt' | 'pwa_installed'
  | 'session_start' | 'session_end' | 'unlock_success' | 'idle_logout'
  | 'streak' | 'share_app' | 'invite_sent' | 'rate_app'
  | 'onboarding_complete' | 'passkey_set' | 'otp_verified'
  | 'fast_add' | 'return_visit' | 'long_session';

export type Task = {
  id: string;
  kind: TaskKind;
  title: string;
  target: number;
  progress: number;
  reward: number;  // Bites
  day: number;
  dueTs?: number;
  ready?: boolean;
  done?: boolean;
};

/* -------------------------------------------------------------------------- */
/*                             LocalStorage keys                              */
/* -------------------------------------------------------------------------- */
const LS_TASKS = 'bw.tasks.today.v3';
const LS_TOKENS = 'bw.tokens';
const LS_DAYKEY = 'bw.tasks.seed.day.v3';
const LS_CARRY = 'bw.tasks.carryover.v3';
const LS_LAST_ROTATE = 'bw.tasks.lastRotate.v3';

/* -------------------------------------------------------------------------- */
/*                             Token management                               */
/* -------------------------------------------------------------------------- */
export function getTokenBalance(): number {
  try { return Number(localStorage.getItem(LS_TOKENS) || '0'); } catch { return 0; }
}
export function setTokenBalance(n: number) {
  try { localStorage.setItem(LS_TOKENS, String(n)); } catch {}
  emit('bw:tokens:update', n);
}
export function addBites(delta: number) {
  const next = Math.max(0, getTokenBalance() + delta);
  setTokenBalance(next);
  emit('bw:reward', { amount: delta, balance: next });
  addNotice({ kind: 'milestone', title: `+${delta} Bites earned`, body: 'Great job completing a task!' });
}

/* -------------------------------------------------------------------------- */
/*                              Task persistence                              */
/* -------------------------------------------------------------------------- */
export function getTasks(): Task[] {
  try { return JSON.parse(sessionStorage.getItem(LS_TASKS) || '[]'); } catch { return []; }
}
export function setTasks(list: Task[]) {
  sessionStorage.setItem(LS_TASKS, JSON.stringify(list));
  emit('bw:tasks:changed', list);
}

/* -------------------------------------------------------------------------- */
/*                              Task generation                               */
/* -------------------------------------------------------------------------- */
function midnightTs() {
  const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime();
}
function todayBucket(): number {
  return ((new Date().getDate() - 1) % 30) + 1;
}
function pickUnique<T extends { id: string; kind: string; title: string }>(
  pool: T[], n: number
): T[] {
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  const picked: T[] = [];
  const usedIds = new Set(), usedTitles = new Set(), usedKinds = new Set();
  for (const t of shuffled) {
    if (picked.length >= n) break;
    if (usedIds.has(t.id) || usedTitles.has(t.title) || usedKinds.has(t.kind)) continue;
    picked.push(t);
    usedIds.add(t.id); usedTitles.add(t.title); usedKinds.add(t.kind);
  }
  return picked;
}

/* -------------------------------------------------------------------------- */
/*                           100 Task Definitions                             */
/* -------------------------------------------------------------------------- */
const TASKS_100: Omit<Task, 'progress' | 'ready' | 'done' | 'dueTs'>[] = [
  { id:'t1-search', kind:'search', title:'Make your first search', target:1, reward:10, day:1 },
  { id:'t2-browse', kind:'browse', title:'Browse 5 dishes', target:5, reward:12, day:1 },
  { id:'t3-compare', kind:'compare_done', title:'Compare prices once', target:1, reward:15, day:1 },
  { id:'t4-add', kind:'add_to_cart', title:'Add 3 items to cart', target:3, reward:10, day:1 },
  { id:'t5-order', kind:'payment_success', title:'Complete your first order', target:1, reward:25, day:2 },
  { id:'t6-leader', kind:'open_leaderboard', title:'Open the leaderboard', target:1, reward:8, day:2 },
  { id:'t7-tasks', kind:'open_tasks', title:'Open the tasks tab', target:1, reward:5, day:2 },
  { id:'t8-location', kind:'change_location', title:'Update your location', target:1, reward:10, day:3 },
  { id:'t9-enable-notif', kind:'enable_notifications', title:'Enable notifications', target:1, reward:10, day:3 },
  { id:'t10-return', kind:'return_visit', title:'Return tomorrow', target:1, reward:15, day:4 },
  { id:'t11-fastadd', kind:'fast_add', title:'Add to cart within 15s of viewing', target:1, reward:15, day:4 },
  { id:'t12-streak', kind:'streak', title:'Maintain a 3-day streak', target:3, reward:20, day:5 },
  { id:'t13-voice', kind:'voice_search', title:'Try a voice search', target:1, reward:10, day:5 },
  { id:'t14-pwa', kind:'pwa_installed', title:'Install the app on your home screen', target:1, reward:20, day:6 },
  { id:'t15-share', kind:'share_app', title:'Share the app with a friend', target:1, reward:10, day:6 },
  { id:'t16-rate', kind:'rate_app', title:'Rate us on the store', target:1, reward:15, day:7 },
  // (rest will be diversified below)
];
while (TASKS_100.length < 100) {
  const base = TASKS_100[TASKS_100.length % 15];
  TASKS_100.push({
    ...base,
    id: base.id + '-x' + (TASKS_100.length + 1),
    reward: base.reward + ((TASKS_100.length % 5) ? 0 : 5),
    day: ((TASKS_100.length % 30) + 1),
  });
}

/* -------------------------------------------------------------------------- */
/*                          Task Rotation / Daily Set                         */
/* -------------------------------------------------------------------------- */
function seedToday(): Task[] {
  const todayKey = new Date().toDateString();
  if (localStorage.getItem(LS_DAYKEY) === todayKey) return getTasks();
  const bucket = todayBucket();
  const due = midnightTs();
  const pool = TASKS_100.filter(t => t.day === bucket);
  const fresh = pickUnique(pool, 3).map(t => ({
    ...t, progress:0, ready:false, done:false, dueTs:due,
  }));
  setTasks(fresh);
  localStorage.setItem(LS_DAYKEY, todayKey);
  localStorage.setItem(LS_LAST_ROTATE, String(Date.now()));
  return fresh;
}

export function ensureDailyTasks(): Task[] {
  return seedToday();
}

/* -------------------------------------------------------------------------- */
/*                     Expiry & midnight helpers (exported)                   */
/* -------------------------------------------------------------------------- */
export function expirePastDue(now = Date.now()) {
  const list = getTasks();
  let changed = false;
  const kept = list.map(t => {
    if (t.done || !t.dueTs) return t;
    if (t.dueTs < now) { changed = true; return { ...t, dueTs: undefined }; }
    return t;
  });
  if (changed) setTasks(kept);
}

/* -------------------------------------------------------------------------- */
/*                            Progress Management                             */
/* -------------------------------------------------------------------------- */
function updateProgress(kind: TaskKind, by = 1) {
  const list = getTasks();
  let changed = false;
  const next = list.map(t => {
    if (t.kind !== kind || t.done) return t;
    const p = Math.min(t.target, t.progress + by);
    if (p !== t.progress) changed = true;
    const ready = p >= t.target ? true : t.ready;
    return { ...t, progress: p, ready };
  });
  if (changed) {
    setTasks(next);
    const anyReady = next.some(t => t.ready && !t.done);
    const allDone = next.every(t => t.done || t.ready);
    if (anyReady) addNotice({ kind:'milestone', title:'Task ready to claim 🎯', body:'Open Tasks to claim your reward.' });
    if (allDone) addNotice({ kind:'system', title:'All tasks completed 🎉', body:'New tasks arrive at midnight.' });
  }
}

export async function claimTask(id: string):
Promise<void> { 
  const list = getTasks();
  const idx = list.findIndex(t => t.id === id);
  if (idx < 0) return;
  const t = list[idx];
  if (!t.ready || t.done) return;
  const updated = list.filter(x => x.id !== id);
  setTasks(updated);

  addBites(t.reward);
  addNotice({ kind:'milestone', title:'Task complete ✅', body:`${t.title} (+${t.reward} Bites)` });
  try {
    const uid = getAuth().currentUser?.uid;
    if (uid) {
      await apiAddCoins( t.reward, `task:${t.id}`);
    }
  } catch{}
}


/* -------------------------------------------------------------------------- */
/*                          Ground Truth Behaviors                            */
/* -------------------------------------------------------------------------- */
const GROUND_TRUTH: Record<string, TaskKind> = {
  // search / discovery
  'bw:keyword:search':'search',
  'bw:voice:search':'voice_search',
  'bw:search:filter':'search_filter',
  'bw:search:sort':'search_sort',
  'bw:search:suggestion':'search_suggestion_click',

  // browse
  'bw:dish:browse':'browse',
  'bw:view:restaurant':'view_restaurant',
  'bw:image:zoom':'image_zoom',

  // compare
  'bw:compare:opened':'compare_open',
  'bw:compare:done':'compare_done',

  // cart
  'bw:dish:add':'add_to_cart',
  'bw:dish:remove':'remove_from_cart',
  'bw:dish:qty':'change_qty',

  // checkout/payment
  'bw:checkout:start':'checkout_start',
  'bw:coupon:apply':'apply_coupon',
  'bw:payment:success':'payment_success',
  'bw:payment:fail':'payment_fail',

  // UI opens
  'bw:open:tasks':'open_tasks',
  'bw:open:leaderboard':'open_leaderboard',
  'bw:open:cart':'open_cart',
  'bw:open:settings':'open_settings',

  // profile/location
  'bw:location:changed':'change_location',
  'bw:address:save':'save_address',
  'bw:address:label':'label_address',
  'bw:profile:switch':'switch_profile',

  // notifications / mic
  'bw:perm:notifications:enabled':'enable_notifications',
  'bw:perm:notifications:denied':'deny_notifications',
  'bw:notif:click':'notif_click',
  'bw:perm:mic:enabled':'enable_mic',
  'bw:perm:mic:denied':'deny_mic',
  'bw:mic:used':'use_mic',

  // install / pwa
  'bw:pwa:prompt':'pwa_install_prompt',
  'bw:pwa:installed':'pwa_installed',

  // session
  'bw:session:start':'session_start',
  'bw:session:end':'session_end',
  'bw:unlock:success':'unlock_success',
  'bw:idle:logout':'idle_logout',

  // social / growth
  'bw:share:app':'share_app',
  'bw:invite:sent':'invite_sent',
  'bw:rate:app':'rate_app',

  // onboarding
  'bw:onboarding:complete':'onboarding_complete',
  'bw:passkey:set':'passkey_set',
  'bw:otp:verified':'otp_verified',

  // derived
  'bw:derived:fast_add':'fast_add',
  'bw:derived:return_visit':'return_visit',
  'bw:derived:long_session':'long_session',
};

/* -------------------------------------------------------------------------- */
/*                         Event → Progress wiring                            */
/* -------------------------------------------------------------------------- */
let wired = false;
const lastHit: Partial<Record<TaskKind, number>> = {};
const THROTTLE_MS: Partial<Record<TaskKind, number>> = {
  browse:250, add_to_cart:150, search:300,
};

export function startTaskAutoTracking() {
  if (wired) return; wired = true;

  // map all events to progress
  (Object.entries(GROUND_TRUTH) as Array<[string,
    TaskKind]>).forEach(
    ([evt, kind]) => {
    on(evt, () => {
      const now = Date.now();
      const min = THROTTLE_MS[kind] || 0;
      if (min && now - (lastHit[kind] || 0) < min) return;
      lastHit[kind] = now;
      updateProgress(kind, 1);
    });
  });
}

  // derived: fast_add (within 15s of first browse)
  const firstSeen: Record<string, number> = {};
  on<{ id:string }>('bw:dish:browse', d => {
    if (d?.id) firstSeen[d.id] = firstSeen[d.id] || Date.now();
  });
  on<{ id:string }>('bw:dish:add', d => {
    if (!d?.id) return;
    const t0 = firstSeen[d.id];
    if (t0 && Date.now() - t0 <= 15000) updateProgress('fast_add', 1);
  });

  // derived: session length
  let sessionStart = Date.now();
on('bw:session:start', () => { sessionStart = Date.now(); });
on('bw:session:end', () => {
  if (Date.now() - sessionStart >= 10 * 60 * 1000) updateProgress('long_session', 1);
});

// derived: return visit
try {
  const last = Number(localStorage.getItem('bw.return.last') || '0'); // ← note the dot key, not underscore
  if (Date.now() - last >= 24 * 60 * 60 * 1000) {
    localStorage.setItem('bw.return.last', String(Date.now()));
    emit('bw:derived:return_visit', null);
  }
} catch {}