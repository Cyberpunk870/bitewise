// src/screens/achievements/Achievements.tsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACHIEVEMENTS, type Achievement } from '../../data/achievements';
import { getMissionStats } from '../../lib/tasks';
import { track } from '../../lib/track';

function ctx() {
  const tokens = Number(localStorage.getItem('bw.tokens') || '0');
  const compares = Number(localStorage.getItem('bw.stats.compares') || '0');
  const missions = getMissionStats();
  return {
    tokens,
    compares,
    missions: missions.totalCompleted,
    streakCurrent: missions.streak.current,
    streakBest: missions.streak.best,
  };
}

export default function Achievements() {
  const nav = useNavigate();
  React.useEffect(() => { track('achievements_view'); }, []);
  const state = ctx();
  const list = useMemo(
    () =>
      (ACHIEVEMENTS as Achievement[]).map((a) => ({
        ...a,
        unlocked: a.unlock(state),
      })),
    [state]
  );
  const unlockedCount = list.filter((a) => a.unlocked).length;

  return (
    <main className="min-h-screen px-4 py-6 text-white">
      <div className="max-w-5xl mx-auto space-y-5">
        <header className="flex items-center justify-between">
          <button
            className="px-3 py-1.5 text-sm rounded-full border border-white/20 bg-white/10 hover:bg-white/15 transition"
            onClick={() => nav(-1)}
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold">Achievements & Badges</h1>
          <div className="text-sm text-white/70">
            {unlockedCount}/{list.length} unlocked
          </div>
        </header>

        <section className="glass-card p-5 grid gap-2 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-white/60">Mission streak</div>
            <div className="text-3xl font-bold mt-1">{state.streakCurrent} days</div>
            <div className="text-xs text-white/60 mt-1">Best streak {state.streakBest}d</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-white/60">Total missions</div>
            <div className="text-3xl font-bold mt-1">{state.missions}</div>
            <div className="text-xs text-white/60 mt-1">Keep finishing daily missions to unlock more badges.</div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => (
            <div
              key={a.id}
              className={[
                'glass-card p-4 border transition',
                a.unlocked ? 'border-white/30 shadow-2xl shadow-amber-500/20' : 'opacity-60',
              ].join(' ')}
            >
              <div className="text-3xl mb-2">{a.icon ?? '🏅'}</div>
              <div className="font-semibold">{a.title}</div>
              <div className="text-xs text-white/70 mt-1">{a.hint}</div>
              <div className="mt-3 text-xs font-semibold">
                {a.unlocked ? (
                  <span className="text-lime-200">Unlocked</span>
                ) : (
                  <span className="text-white/40">Locked</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
