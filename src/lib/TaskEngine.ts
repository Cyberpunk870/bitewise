// src/lib/TaskEngine.ts
import { emit } from './events';
import {
  ensureDailyTasks,
  expirePastDue,
  startTaskAutoTracking,
} from './tasks';

/**
 * Boot the Tasks engine once (e.g., in AppShell).
 * - Seeds today's 3 tasks (with carryover)
 * - Wires app events → task progress
 * - Ticks countdowns and notifies listeners
 */
export function startTaskEngine() {
  // Seed today's tasks (3 + carryover)
  ensureDailyTasks();

  // Wire automatic tracking for all app events (search, browse, compare, etc.)
  startTaskAutoTracking();

  // 1-second heartbeat for countdowns / expiry + UI timers
  const id = window.setInterval(() => {
    expirePastDue(Date.now());
    emit('bw:tick', Date.now());
  }, 1000);

  return () => {
    window.clearInterval(id);
  };
}
