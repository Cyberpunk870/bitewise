// src/components/CoinShower.tsx
import React, { useEffect, useState } from 'react';

type GainDetail = { amount?: number; delta?: number; total?: number };

export default function CoinShower() {
  const [shots, setShots] = useState<{ id: string; amount: number }[]>([]);
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const onGain = (e: Event) => {
      const d = (e as CustomEvent<GainDetail>).detail || {};
      const amount = Math.max(1, Number(d.amount ?? d.delta ?? 1));
      const id = crypto.randomUUID();
      setShots((s) => [...s, { id, amount }].slice(-4));
      setTimeout(() => setShots((s) => s.filter((x) => x.id !== id)), prefersReduced ? 600 : 1400);
    };
    window.addEventListener('bw:tokens:gain' as any, onGain as any);
    return () => window.removeEventListener('bw:tokens:gain' as any, onGain as any);
  }, [prefersReduced]);

  if (!shots.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-start justify-center">
      {shots.map(({ id, amount }, i) => (
        <Burst key={id} amount={amount} delay={i * 60} reduced={prefersReduced} />
      ))}
    </div>
  );
}

function Burst({ amount, delay, reduced }: { amount: number; delay: number; reduced: boolean }) {
  const n = reduced ? 6 : Math.min(24, 8 + Math.floor(amount / 5));
  const coins = Array.from({ length: n }).map((_, i) => i);

  return (
    <div className="relative mt-8" style={{ animationDelay: `${delay}ms` }}>
      {!reduced && (
        <div className="mx-auto text-white font-semibold text-sm text-center mb-2 drop-shadow">
          +{amount} Bits
        </div>
      )}
      <div className="relative w-[200px] h-[240px]">
        {coins.map((i) => {
          const left = Math.random() * 180;
          const dur = 700 + Math.random() * 600;
          const rot = (Math.random() * 120 - 60) | 0;
          const scale = 0.8 + Math.random() * 0.6;
          return (
            <span
              key={i}
              className="absolute inline-block"
              style={{
                left,
                top: -20,
                transform: `scale(${scale})`,
                animation: reduced ? undefined : `coinFall ${dur}ms ease-in forwards`,
                animationDelay: `${delay + Math.random() * 120}ms`,
              }}
            >
              <svg viewBox="0 0 64 64" width="20" height="20" style={{ transform: `rotate(${rot}deg)` }}>
                <defs>
                  <radialGradient id="g" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#ffe680"/><stop offset="60%" stopColor="#ffc400"/>
                    <stop offset="100%" stopColor="#c99000"/>
                  </radialGradient>
                </defs>
                <circle cx="32" cy="32" r="28" fill="url(#g)" stroke="#9b6b00" strokeWidth="2"/>
                <circle cx="32" cy="32" r="20" fill="none" stroke="#9b6b00" strokeWidth="2" opacity=".6"/>
                <path d="M32 18l3.6 7.4 8.2 1.2-5.9 5.7 1.4 8.1L32 37.5 26.7 40.4l1.4-8.1-5.9-5.7 8.2-1.2z"
                      fill="#fff6bf" stroke="#9b6b00" strokeWidth="1"/>
              </svg>
            </span>
          );
        })}
      </div>
      <style>{`
        @keyframes coinFall {
          0%   { transform: translateY(-20px) scale(1); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translateY(260px) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
