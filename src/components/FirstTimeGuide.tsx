// src/components/FirstTimeGuide.tsx
import React, { useEffect, useMemo, useState } from 'react';

type Step = {
  id: string;
  title: string;
  body: string;
  actionLabel: string;
  action: string;
};

const STEPS: Step[] = [
  {
    id: 'browse',
    title: 'Build your cart',
    body: 'Tap the + buttons on dishes you like. We pin them to your tray automatically.',
    actionLabel: 'Show me dishes',
    action: 'cart-focus',
  },
  {
    id: 'compare',
    title: 'Compare Swiggy & Zomato',
    body: 'Add 2+ dishes, then open “Check availability” to see price differences instantly.',
    actionLabel: 'Go to compare',
    action: 'compare',
  },
  {
    id: 'missions',
    title: 'Keep your streak alive',
    body: 'Finish missions to earn streak confetti, tokens, and leaderboard badges.',
    actionLabel: 'View missions',
    action: 'missions',
  },
];

type Props = {
  onDismiss: () => void;
  onAction?: (action: string) => void;
};

export default function FirstTimeGuide({ onDismiss, onAction }: Props) {
  const [index, setIndex] = useState(0);
  const step = useMemo(() => STEPS[index], [index]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setIndex((prev) => {
        if (prev >= STEPS.length - 1) {
          onDismiss();
          return prev;
        }
        return prev + 1;
      });
    }, 6500);
    return () => window.clearTimeout(id);
  }, [index, onDismiss]);

  const handleAction = () => {
    onAction?.(step.action);
  };

  const handleNext = () => {
    if (index >= STEPS.length - 1) {
      onDismiss();
      return;
    }
    setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  return (
    <aside className="fixed bottom-4 left-4 z-40 max-w-xs rounded-2xl border border-white/15 bg-[#0b1224]/90 p-4 text-white shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60 mb-1">Quick tour</p>
          <h3 className="text-lg font-semibold">{step.title}</h3>
        </div>
        <button
          type="button"
          aria-label="Skip tutorial"
          className="text-white/60 hover:text-white"
          onClick={onDismiss}
        >
          ×
        </button>
      </div>
      <p className="mt-2 text-sm text-white/80">{step.body}</p>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          className="flex-1 rounded-xl bg-white text-black text-sm font-semibold py-2 shadow"
          onClick={handleAction}
        >
          {step.actionLabel}
        </button>
        <button
          type="button"
          className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/80 hover:text-white"
          onClick={handleNext}
        >
          Next
        </button>
      </div>
      <div className="mt-3 flex gap-1">
        {STEPS.map((s, i) => (
          <span
            key={s.id}
            className={[
              'h-1.5 flex-1 rounded-full',
              i <= index ? 'bg-white' : 'bg-white/30',
            ].join(' ')}
          />
        ))}
      </div>
    </aside>
  );
}
