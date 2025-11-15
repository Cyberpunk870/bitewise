// src/screens/tasks/Tasks.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTasks, ensureDailyTasks, claimTask, type Task } from '../../lib/tasks';
import { on } from '../../lib/events';

const midnightTs = () => { const d = new Date(); d.setHours(24,0,0,0); return d.getTime(); };
const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const two = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${two(hh)}:${two(mm)}:${two(ss)}`;
};

export default function TasksScreen() {
  const nav = useNavigate();
  const [snapshot, setSnapshot] = useState<Task[]>(() => { ensureDailyTasks(); return getTasks(); });

  // 🔁 force re-render every second (hooked up to TaskEngine/Tasks wiring)
  const [, setTick] = useState(0);
  useEffect(() => {
    const off1 = on('bw:tasks:changed', () => setSnapshot(getTasks()));
    const off2 = on('bw:tick', () => setTick(t => t + 1)); // live countdowns
    const vis = () => setSnapshot(getTasks());
    document.addEventListener('visibilitychange', vis);
    return () => { off1(); off2(); document.removeEventListener('visibilitychange', vis); };
  }, []);

  // only pending tasks
  const tasks = useMemo(() => getTasks().filter(t => !t.done), [snapshot]);
  const allDone = tasks.length === 0;
  const until = midnightTs() - Date.now();

  const onClaim = (t: Task) => {
    if (!t.ready || t.done) return;
    claimTask(t.id);
    setTimeout(() => setSnapshot(getTasks()), 0);
  };

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-4">
          <button className="px-3 py-1.5 text-sm rounded-full border bg-white/80" onClick={() => nav(-1)}>← Back</button>
          <h1 className="text-lg font-semibold text-white drop-shadow">Tasks</h1>
          <div className="w-20" />
        </header>

        {allDone ? (
          <div className="rounded-xl bg-white/95 shadow p-4">
            <div className="text-sm font-medium">You finished today’s tasks 🎉</div>
            <div className="text-sm opacity-70 mt-1">
              New tasks will be assigned in <b className="tabular-nums">{fmt(until)}</b>.
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-white shadow divide-y">
            {tasks.map((t) => {
              const left = typeof t.dueTs === 'number' ? Math.max(0, t.dueTs - Date.now()) : 0;
              const progress = `${Math.min(t.progress, t.target)}/${t.target}`;
              return (
                <div key={t.id} className="p-3 flex items-start gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-xs opacity-70 mt-1 flex items-center gap-3">
                      <span>Progress: {progress}</span>
                      <span>Reward: {t.reward} Bites</span>
                      {left > 0 && <span>⏱ {fmt(left)}</span>}
                    </div>
                  </div>
                  <button
                    disabled={!t.ready}
                    onClick={() => onClaim(t)}
                    className={[
                      'rounded-lg px-2 py-1 text-xs',
                      t.ready ? 'bg-black text-white' : 'bg.black/10 text-black/60 cursor-not-allowed'
                    ].join(' ').replace('bg.black','bg-black')}
                    aria-label={t.ready ? `Claim ${t.reward} Bites` : `Earn ${t.reward} Bites`}
                  >
                    {t.ready ? 'Claim' : `Earn ${t.reward}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-[11px] text-white/90 mt-3">
          Tasks auto-progress as you use BiteWise (search, compare, browse, etc.).
        </div>
      </div>
    </main>
  );
}
