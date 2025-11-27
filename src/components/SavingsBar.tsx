// src/components/SavingsBar.tsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSavings } from '../store/savings';
import { timeAgo } from '../lib/dataSync';

export default function SavingsBar() {
  const nav = useNavigate();
  const { total7d, lastSavedAt } = useSavings();

  const visible = useMemo(() => {
    return typeof total7d === 'number' && total7d > 0;
  }, [total7d]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 right-3 z-40 max-w-xs">
      <div className="rounded-2xl shadow-xl shadow-emerald-500/20 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-200 text-slate-900 p-3 border border-white/70">
        <div className="text-xs font-semibold uppercase tracking-wide opacity-80">
          Weekly savings
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="text-2xl font-black tabular-nums">
            ₹{Math.round(total7d)}
          </div>
          <button
            className="text-xs px-2 py-1 rounded-full bg-black/10 hover:bg-black/20 transition font-semibold"
            onClick={() => nav('/orders')}
          >
            View
          </button>
        </div>
        <div className="text-[11px] text-slate-800/80 mt-1">
          Last save {lastSavedAt ? timeAgo(lastSavedAt) : '—'}
        </div>
      </div>
    </div>
  );
}
