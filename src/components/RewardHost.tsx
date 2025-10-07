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
          <div className="pointer-events-auto rounded-2xl bg-white/95 border shadow-xl p-5 w-[320px] text-center animate-[pop_200ms_ease]">
            <div className="text-sm opacity-70">Bits/Bites updated</div>
            <div className="text-3xl font-bold my-2">+{reward.amount}</div>
            <div className="text-sm">Balance: <b>{anim.val}</b></div>
          </div>
          <style>{`@keyframes pop{0%{transform:scale(.92);opacity:.4}100%{transform:scale(1);opacity:1}}`}</style>
        </div>
      )}
    </>
  );
}
