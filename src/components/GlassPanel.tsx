// src/components/GlassPanel.tsx
import React from 'react';

type Tone = 'dark' | 'light';

type Props = {
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
  padding?: string;
};

/**
 * Shared glassy card wrapper for consistent rounded/border/backdrop styling.
 */
export default function GlassPanel({
  children,
  className = '',
  tone = 'dark',
  padding = 'p-4',
}: Props) {
  const tones: Record<Tone, string> = {
    dark: 'bg-white/10 border-white/15 text-white',
    light: 'bg-white/90 border-white/40 text-slate-900',
  };
  return (
    <div
      className={[
        'rounded-2xl backdrop-blur-xl shadow-lg shadow-black/20',
        'border',
        tones[tone],
        padding,
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
