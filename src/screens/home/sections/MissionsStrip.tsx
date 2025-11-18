// src/screens/home/sections/MissionsStrip.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import StreakBadge, { useMissionStats } from '../../../components/StreakBadge';

export default function MissionsStrip() {
  const stats = useMissionStats();
  const goal = 5;
  const completedToday = stats.totalCompleted % goal;
  const pct = Math.min(100, Math.round((completedToday / goal) * 100));
  const remaining = Math.max(0, goal - completedToday);

  return (
    <section className="rounded-[32px] border border-white/10 bg-gradient-to-r from-[#0f172a]/80 via-[#111827]/80 to-[#0f172a]/70 p-6 shadow-xl shadow-black/30 flex flex-col gap-6 lg:flex-row lg:items-center">
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-[0.4em] text-white/60">Daily missions</p>
        <h3 className="text-2xl font-semibold text-white mt-2">Keep the streak alive</h3>
        <p className="text-sm text-white/70 mt-1">
          {remaining === 0
            ? 'You’ve cleared today’s missions. Coins are on the way!'
            : `Complete ${remaining} more mission${remaining === 1 ? '' : 's'} to trigger the bonus.`}
        </p>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-white/40">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10 mt-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#fde68a] via-[#f9a8d4] to-[#c084fc]"
              style={{ width: `${Math.max(12, pct)}%` }}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/tasks"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 transition"
          >
            Open missions
          </Link>
          <Link
            to="/achievements"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition"
          >
            View achievements
          </Link>
        </div>
      </div>
      <div className="lg:max-w-[220px]">
        <StreakBadge value={stats.streak.current} best={stats.streak.best} />
      </div>
    </section>
  );
}
