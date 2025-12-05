// src/components/StreakBadge.tsx
import React from 'react';
import { getMissionStats, type MissionStats } from '../lib/tasks';
import { on } from '../lib/events';

type Props = {
  value: number;
  best: number;
};

const TIERS = [
  { min: 7, label: 'Inferno', colors: 'from-[#f87171] via-[#fb923c] to-[#fde047]', icon: '🔥' },
  { min: 3, label: 'Blaze', colors: 'from-[#fb923c] via-[#facc15] to-[#34d399]', icon: '⚡' },
  { min: 1, label: 'Spark', colors: 'from-[#34d399] via-[#4ade80] to-[#a5b4fc]', icon: '✨' },
];

const streakCtx = React.createContext<MissionStats>({
  streak: { current: 0, best: 0, lastDay: null },
  totalCompleted: 0,
});

export function useMissionStats() {
  return React.useContext(streakCtx);
}

export const MissionStatsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stats, setStats] = React.useState<MissionStats>(getMissionStats());

  React.useEffect(() => {
    const off = on<MissionStats>('bw:missions:stats', (detail) => setStats(detail));
    return () => off();
  }, []);

  return <streakCtx.Provider value={stats}>{children}</streakCtx.Provider>;
};

export default function StreakBadge({ value, best }: Props) {
  const tier = TIERS.find((t) => value >= t.min) ?? TIERS[TIERS.length - 1];

  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4 shadow-lg shadow-black/30 min-w-[160px]">
      <div className="text-xs uppercase tracking-[0.2em] text-white/60 mb-1 flex items-center gap-1">
        {tier.icon} {tier.label}
      </div>
      <div className="text-3xl font-bold flex items-end gap-2">
        <span>{value || 0}d</span>
        <span className="text-xs uppercase tracking-widest text-white/50">streak</span>
      </div>
      <div className="h-2 w-full rounded-full bg-white/10 mt-3 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${tier.colors}`}
          style={{
            width: `${Math.min(100, Math.max(10, (value / (tier.min || 1)) * 100))}%`,
          }}
        />
      </div>
      <div className="text-[11px] text-white/60 mt-2">Best: {best || 0}d</div>
    </div>
  );
}
