// src/components/ToastHost.tsx
import React, { useEffect, useRef, useState } from 'react';
import { on } from '../lib/events';

type Toast = { title: string; body?: string };

export default function ToastHost() {
  const [active, setActive] = useState<Toast | null>(null);
  const queueRef = useRef<Toast[]>([]);
  const openRef = useRef(false);

  // de-dup window
  const lastKeyRef = useRef<string>('');
  const lastAtRef = useRef<number>(0);

  const push = (t: Toast) => {
    const key = `${t.title}|${t.body || ''}`;
    const now = Date.now();
    if (key === lastKeyRef.current && now - lastAtRef.current < 1000) return; // 1s de-dup
    lastKeyRef.current = key;
    lastAtRef.current = now;
    queueRef.current.push(t);
    tick();
  };

  const tick = () => {
    if (openRef.current || active || queueRef.current.length === 0) return;
    setActive(queueRef.current.shift()!);
  };

  useEffect(() => {
    // IMPORTANT: Only listen to bw:toast (no bw:notifications:new here)
    const off = on<Toast>('bw:toast', (t) => push(t));
    return () => off();
  }, []);

  // show + auto-close
  useEffect(() => {
    if (!active) return;
    openRef.current = true;
    const t = setTimeout(() => {
      openRef.current = false;
      setActive(null);
      setTimeout(() => tick(), 40);
    }, 2600);
    return () => clearTimeout(t);
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed left-1/2 top-4 -translate-x-1/2 z-[120] pointer-events-none" aria-live="polite">
      <div className="pointer-events-auto rounded-xl border border-slate-200 bg-white/95 text-slate-900 shadow px-4 py-3 w-[min(92vw,380px)]
                      transition-all duration-300 animate-[toastIn_300ms_ease]">
        <div className="text-sm font-semibold">{active.title}</div>
        {active.body && <div className="text-xs text-slate-600 mt-0.5">{active.body}</div>}
      </div>
      <style>{`
        @keyframes toastIn { from { opacity:0; transform: translateY(-6px) } to { opacity:1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}
