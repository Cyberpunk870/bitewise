// src/components/RewardHost.tsx
import React, { useEffect, useState } from 'react';
import { on } from '../lib/events';
import CoinShower from './CoinShower';

type Reward = { amount: number; balance: number };

export default function RewardHost() {
  // Keep your existing reward modal behavior (listens to bw:reward)
  const [open, setOpen] = useState(false);
  const [reward, setReward] = useState<Reward | null>(null);
  const [anim, setAnim] = useState<{ from: number; to: number; val: number }>({ from: 0, to: 0, val: 0 });

  useEffect(() => {
    return on<Reward>('bw:reward', (r) => {
      setReward(r);
      setAnim({ from: r.balance - r.amount, to: r.balance, val: r.balance - r.amount });
      setOpen(true);
    });
  }, []);

  // number animation for your modal
  useEffect(() => {
    if (!open || !reward) return;
    const start = performance.now();
    const DUR = 900;
    let raf = 0;
    const loop = (t: number) => {
      const p = Math.min(1, (t - start) / DUR);
      const v = anim.from + (anim.to - anim.from) * (1 - Math.cos(p * Math.PI)) / 2;
      setAnim((a) => ({ ...a, val: Math.round(v) }));
      if (p < 1) raf = requestAnimationFrame(loop);
      else setTimeout(() => setOpen(false), 800);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open, reward, anim.from, anim.to]);

  return (
    <>
      {/* NEW: coin shower overlay (listens to bw:tokens:gain internally) */}
      <CoinShower />

      {/* Your existing reward popup (unchanged behavior) */}
      {open && reward && (
        <div className="fixed inset-0 z-[100] grid place-items-center pointer-events-none">
          <div className="pointer-events-auto w-[320px] rounded-2xl border border-white/10 bg-gradient-to-br from-[#facc15]/10 via-[#f472b6]/10 to-[#a855f7]/10 backdrop-blur-2xl p-5 text-white shadow-[0_25px_80px_rgba(5,10,25,0.65)] animate-[pop_220ms_ease]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/60">Bits added</p>
                <p className="text-3xl font-bold text-amber-200">+{reward.amount}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-white/10 grid place-items-center">
                <svg viewBox="0 0 32 32" className="h-7 w-7 text-amber-200">
                  <circle cx="16" cy="16" r="14" fill="currentColor" opacity="0.35" />
                  <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                  <text x="16" y="20" textAnchor="middle" fontSize="10" fill="#fff" fontWeight="600">B</text>
                </svg>
              </div>
            </div>
            <div className="mt-3 text-sm text-white/70">
              New balance <span className="font-semibold text-white">{anim.val}</span>
            </div>
            <div className="mt-4 h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#fde047] via-[#fb7185] to-[#c084fc] animate-[rewardBar_900ms_ease]" />
            </div>
          </div>
          <style>{`@keyframes pop{0%{transform:scale(.92);opacity:.4}100%{transform:scale(1);opacity:1}}@keyframes rewardBar{0%{transform:translateX(-100%)}100%{transform:translateX(0)}}`}</style>
        </div>
      )}
    </>
  );
}
