// src/components/FirstTimeGuide.tsx
import React, { useLayoutEffect, useMemo, useState } from 'react';

type StepConfig = {
  id: string;
  selector: string;
  title: string;
  body: string;
  actionLabel?: string;
  action?: string;
};

type Props = {
  steps: StepConfig[];
  onDismiss: () => void;
  onAction?: (action: string) => void;
};

const PADDING = 14;
const CARD_WIDTH = 320;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function FirstTimeGuide({ steps, onDismiss, onAction }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[index];

  useLayoutEffect(() => {
    if (!step?.selector) {
      setRect(null);
      return;
    }
    const node = document.querySelector(step.selector) as HTMLElement | null;
    if (!node) {
      setRect(null);
      return;
    }
    const update = () => {
      const r = node.getBoundingClientRect();
      setRect(r);
    };
    update();
    const resize = () => update();
    const obs = new MutationObserver(() => update());
    obs.observe(node, { attributes: true, childList: false, subtree: false });
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', resize, true);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', resize, true);
    };
  }, [step?.selector, index]);

  const highlightStyle = useMemo(() => {
    if (!rect) return null;
    const top = clamp(rect.top - PADDING, 10, window.innerHeight - 40);
    const left = clamp(rect.left - PADDING, 10, window.innerWidth - 40);
    return {
      top,
      left,
      width: rect.width + PADDING * 2,
      height: rect.height + PADDING * 2,
    };
  }, [rect]);

  if (!step) return null;

  const cardTop = rect
    ? clamp(rect.bottom + 18, 20, window.innerHeight - 200)
    : window.innerHeight / 2 - 120;
  const cardLeft = rect
    ? clamp(rect.left, 16, window.innerWidth - CARD_WIDTH - 16)
    : (window.innerWidth - CARD_WIDTH) / 2;

  const goNext = () => {
    if (index >= steps.length - 1) {
      onDismiss();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] text-white">
      <div className="absolute inset-0 bg-[rgba(5,9,20,0.78)] backdrop-blur-[1px]" />

      {highlightStyle && (
        <div
          className="absolute pointer-events-none rounded-2xl border-2 border-orange-400/80 shadow-[0_0_0_9999px_rgba(5,9,20,0.78)] transition-all duration-200"
          style={highlightStyle as React.CSSProperties}
        />
      )}

      <button
        type="button"
        className="absolute top-4 right-4 rounded-full border border-white/40 bg-white/10 px-4 py-1 text-sm text-white/80 hover:text-white transition"
        onClick={onDismiss}
      >
        Skip
      </button>

      <div
        className="absolute w-[min(92vw,320px)] rounded-2xl border border-white/15 bg-[#0b1224]/90 p-4 shadow-2xl pointer-events-auto"
        style={{ top: cardTop, left: cardLeft }}
      >
        <p className="text-xs uppercase tracking-[0.25em] text-white/60 mb-2">
          Step {index + 1} / {steps.length}
        </p>
        <h3 className="text-lg font-semibold">{step.title}</h3>
        <p className="text-sm text-white/80 mt-2">{step.body}</p>
        <div className="mt-4 flex items-center gap-2">
          {step.actionLabel && (
            <button
              type="button"
              className="flex-1 rounded-xl bg-white text-black text-sm font-semibold py-2 shadow"
              onClick={() => step.action && onAction?.(step.action!)}
            >
              {step.actionLabel}
            </button>
          )}
          <button
            type="button"
            className="rounded-xl border border-white/30 px-4 py-2 text-sm text-white/80 hover:text-white"
            onClick={goNext}
          >
            {index >= steps.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
