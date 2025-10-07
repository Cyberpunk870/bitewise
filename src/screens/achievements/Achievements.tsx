// src/screens/achievements/Achievements.tsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACHIEVEMENTS } from '../../data/achievements';

function ctx() {
  const tokens = Number(localStorage.getItem('bw.tokens') || '0');
  const compares = Number(localStorage.getItem('bw.stats.compares') || '0');
  const tasks = JSON.parse(localStorage.getItem('bw.tasks.today') || '[]') as Array<{doneTs?:number}>;
  const tasksDone = tasks.filter(t => t.doneTs).length;
  return { tokens, compares, tasksDone };
}

export default function Achievements() {
  const nav = useNavigate();
  const state = ctx();
  const list = useMemo(() => ACHIEVEMENTS.map(a => ({ ...a, unlocked: a.unlock(state) })), [state]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-500 to-orange-400">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-4">
          <button className="px-3 py-1.5 text-sm rounded-full border bg-white/80" onClick={() => nav(-1)}>← Back</button>
          <h1 className="text-lg font-semibold text-white drop-shadow">Achievements</h1>
          <div className="w-16" />
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {list.map(a => (
            <div key={a.id}
                 className={`rounded-xl p-3 shadow bg-white ${a.unlocked ? '' : 'opacity-60'} border`}>
              <div className="text-2xl mb-2">{a.icon ?? '🏅'}</div>
              <div className="font-medium">{a.title}</div>
              <div className="text-xs opacity-70">{a.hint}</div>
              {a.unlocked && <div className="mt-1 text-xs text-green-700 font-semibold">Unlocked</div>}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
