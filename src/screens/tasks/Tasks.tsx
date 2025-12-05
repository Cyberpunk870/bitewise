// src/screens/tasks/Tasks.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTasks, ensureDailyTasks, claimTask, type Task, getMissionStats, type MissionStats } from '../../lib/tasks';
import { on } from '../../lib/events';
import StreakBadge from '../../components/StreakBadge';
import { ACHIEVEMENTS } from '../../data/achievements';
import { track } from '../../lib/track';

const midnightTs = () => { const d = new Date(); d.setHours(24,0,0,0); return d.getTime(); };
const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const two = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${two(hh)}:${two(mm)}:${two(ss)}`;
};

export default function MissionsScreen() {
  const nav = useNavigate();
  const [snapshot, setSnapshot] = useState<Task[]>(() => {
    ensureDailyTasks();
    return getTasks();
  });
  const [missionStats, setMissionStats] = useState<MissionStats>(() => getMissionStats());
  const [showRecap, setShowRecap] = useState(false);

  const [, setTick] = useState(0);
  useEffect(() => {
    const off1 = on('bw:tasks:changed', () => setSnapshot(getTasks()));
    const off2 = on('bw:tick', () => setTick((t) => t + 1));
    const offStats = on<MissionStats>('bw:missions:stats', (stats) => setMissionStats(stats));
    const vis = () => setSnapshot(getTasks());
    document.addEventListener('visibilitychange', vis);
    return () => {
      off1();
      off2();
      offStats();
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  const tasks = useMemo(() => getTasks().filter((t) => !t.done), [snapshot]);
  const total = snapshot.length || 3;
  const completedCount = Math.max(0, total - tasks.length);
  const allDone = tasks.length === 0;
  const until = midnightTs() - Date.now();
  const progressPct = total ? Math.min(100, (completedCount / total) * 100) : 0;
  const todayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date());
  const recapKey = `bw.recap.${new Date().toISOString().slice(0, 10)}`;
  const tokens = Number(localStorage.getItem('bw.tokens') || '0');
  const compares = Number(localStorage.getItem('bw.stats.compares') || '0');
  const unlockedAchievements = useMemo(() => {
    return ACHIEVEMENTS.filter((a) =>
      a.unlock({
        tokens,
        compares,
        missions: missionStats.totalCompleted,
        streakCurrent: missionStats.streak.current,
        streakBest: missionStats.streak.best,
      })
    );
  }, [tokens, compares, missionStats]);

  useEffect(() => {
    track('tasks_view');
    if (allDone && !sessionStorage.getItem(recapKey)) {
      setShowRecap(true);
      sessionStorage.setItem(recapKey, '1');
    }
  }, [allDone, recapKey]);

  const closeRecap = () => setShowRecap(false);

  const onClaim = (t: Task) => {
    if (!t.ready || t.done) return;
    claimTask(t.id);
    track('task_complete', { id: t.id, points: t.points });
  };

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
          <div>
            <h1 className="text-lg font-semibold text-white drop-shadow">Daily Missions</h1>
            <p className="text-xs text-white/70 text-center">{todayLabel}</p>
          </div>
          <div className="text-sm text-white/70">Refreshes in {fmt(until)}</div>
        </header>

        <section className="glass-card p-5 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-[0.3em] text-white/60">Daily progress</div>
            <div className="text-3xl font-bold mt-1">{completedCount}/{total || 3}</div>
            <div className="text-xs text-white/60 mt-1">Complete all three missions to keep your streak alive.</div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-white/60 mb-1">
                <span>Missions complete</span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#fde68a] via-[#f9a8d4] to-[#c084fc] transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
          <StreakBadge value={missionStats.streak.current} best={missionStats.streak.best} />
        </section>

        {allDone ? (
          <div className="glass-card p-5 border border-white/10 space-y-3">
            <div className="text-lg font-semibold">You crushed today’s missions! 🎉</div>
            <p className="text-sm text-white/70">
              Keep the streak alive and unlock new badges. Come back tomorrow for fresh quests.
            </p>
            <button
              className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
              onClick={() => setShowRecap(true)}
            >
              View today’s recap
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((t) => {
              const left = typeof t.dueTs === 'number' ? Math.max(0, t.dueTs - Date.now()) : 0;
              const progressRaw = t.target ? Math.min(1, t.progress / t.target) : 0;
              return (
                <div key={t.id} className="glass-card p-4 border border-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{t.title}</div>
                      <div className="text-xs text-white/60 mt-1">
                        Reward {t.reward} Bites · Progress {Math.min(t.progress, t.target)}/{t.target}
                      </div>
                    </div>
                    {t.ready ? (
                      <span className="text-xs rounded-full px-2 py-0.5 bg-emerald-500/20 text-emerald-200">
                        Ready
                      </span>
                    ) : (
                      <span className="text-xs text-white/50">In progress</span>
                    )}
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-3">
                    <div
                      className="h-full bg-gradient-to-r from-[#fef08a] via-[#f472b6] to-[#a78bfa]"
                      style={{ width: `${progressRaw * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/60 mt-2">
                    <span>⏱ {left > 0 ? fmt(left) : 'Expired soon'}</span>
                    <span>+{t.reward} Bites</span>
                  </div>
                  <div className="flex justify-end mt-3">
                    <button
                      disabled={!t.ready}
                      onClick={() => onClaim(t)}
                      className={[
                        'rounded-xl px-4 py-2 text-sm font-semibold transition',
                        t.ready
                          ? 'bg-white text-black shadow-lg shadow-rose-400/30'
                          : 'border border-white/15 text-white/60 cursor-not-allowed',
                      ].join(' ')}
                    >
                      {t.ready ? 'Claim reward' : 'Keep going'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-white/60">
          Missions auto-progress as you use BiteWise—search for dishes, compare restaurants, and add to cart to watch them fill up.
        </p>
      </div>
      {showRecap && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm px-4 py-6 flex items-center justify-center">
          <div className="glass-card border border-white/15 max-w-lg w-full p-6 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">Daily recap</p>
              <h2 className="text-2xl font-semibold mt-1">All missions complete ✅</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-3">
                <div className="text-xs text-white/60">Streak</div>
                <div className="text-xl font-bold">{missionStats.streak.current} days</div>
                <div className="text-[11px] text-white/60">Best {missionStats.streak.best}d</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-3">
                <div className="text-xs text-white/60">Total missions</div>
                <div className="text-xl font-bold">{missionStats.totalCompleted}</div>
                <div className="text-[11px] text-white/60">+{completedCount} today</div>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-2">Badge spotlight</p>
              <div className="flex gap-3 flex-wrap">
                {unlockedAchievements.slice(-3).map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 flex items-center gap-2 text-sm"
                  >
                    <span className="text-lg">{a.icon ?? '🏅'}</span>
                    <span>{a.title}</span>
                  </div>
                ))}
                {unlockedAchievements.length === 0 && (
                  <div className="text-xs text-white/60">
                    Keep playing to unlock your first badge!
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                onClick={() => {
                  closeRecap();
                  nav('/achievements');
                }}
              >
                View achievements
              </button>
              <button
                className="rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold"
                onClick={closeRecap}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
