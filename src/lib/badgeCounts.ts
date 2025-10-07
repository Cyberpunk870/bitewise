// src/lib/badgeCounts.ts
import { getInbox } from './notifications';

export function getBadgeCounts() {
  const notif = (() => {
    try { return getInbox().filter(n => !n.read).length; } catch { return 0; }
  })();

  const tasks = (() => {
    try {
      const list = JSON.parse(sessionStorage.getItem('bw.tasks.today') || '[]');
      return list.filter((t: any) => !t.done).length;
    } catch { return 0; }
  })();

  // Leaderboard: 1-dot badge if rank dropped (until server exists)
  const prev = Number(localStorage.getItem('bw.leader.rank.prev') || 1);
  const curr = Number(localStorage.getItem('bw.leader.rank.curr') || 1);
  const leaderboard = curr > prev ? 1 : 0;

  return { notif, tasks, leaderboard };
}
