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
    <div className="fixed inset-x-0 top-0 z-40 px-3 pointer-events-none">
      <style>{`
        @keyframes savingsMarquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <div className="relative mx-auto max-w-5xl rounded-2xl shadow-xl shadow-emerald-500/25 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-300 text-slate-900 border border-white/60 overflow-hidden pointer-events-auto">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            Weekly savings
          </div>
          <div className="flex items-center gap-2 bg-white/15 rounded-full px-3 py-1">
            <div className="text-lg font-black tabular-nums text-white">
              ₹{Math.round(total7d)}
            </div>
            <div className="text-[11px] text-white/80">
              Last save {lastSavedAt ? timeAgo(lastSavedAt) : '—'}
            </div>
          </div>
          <button
            className="ml-auto text-sm font-semibold rounded-full bg-white text-emerald-700 px-3 py-1 hover:bg-white/90 transition"
            onClick={() => nav('/orders')}
          >
            See how we saved
          </button>
        </div>
        <div className="border-t border-white/40">
          <div
            className="whitespace-nowrap text-sm font-medium text-white/90 flex gap-8 px-4 py-1"
            style={{
              animation: 'savingsMarquee 16s linear infinite',
              width: '200%',
            }}
          >
            <span>Smart picks are saving you money—keep ordering smarter.</span>
            <span>Cheaper routes highlighted automatically when you compare.</span>
            <span>Return to the app and mark “I placed it” to track every save.</span>
            <span>Smart picks are saving you money—keep ordering smarter.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
