// src/components/ConfettiBurst.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { on } from '../lib/events';

type Piece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  width: number;
  rotate: number;
};

const COLORS = ['#fde68a', '#f472b6', '#a78bfa', '#7dd3fc', '#f87171', '#34d399'];

function createPieces(size = 36): Piece[] {
  const now = Date.now();
  return Array.from({ length: size }).map((_, idx) => ({
    id: now + idx,
    left: Math.random() * 100,
    delay: Math.random() * 150,
    duration: 1600 + Math.random() * 900,
    color: COLORS[idx % COLORS.length],
    width: 6 + Math.random() * 10,
    rotate: (Math.random() - 0.5) * 90,
  }));
}

export default function ConfettiBurst() {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const active = pieces.length > 0;
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const off = on<any>('bw:confetti', () => {
      setPieces(createPieces());
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setPieces([]);
        timeoutRef.current = null;
      }, 2400);
    });
    return () => {
      off();
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const styleTag = useMemo(
    () => (
      <style>
        {`@keyframes confettiFall{
            0%{top:-5%;opacity:1}
            100%{top:110%;opacity:0}
          }`}
      </style>
    ),
    []
  );

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[95] overflow-hidden">
      {styleTag}
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute block rounded-full"
          style={{
            left: `${p.left}%`,
            top: '-5%',
            width: `${p.width}px`,
            height: `${p.width * 0.35}px`,
            background: p.color,
            animation: `confettiFall ${p.duration}ms linear ${p.delay}ms forwards`,
            transform: `rotate(${p.rotate}deg)`,
            opacity: 0.9,
            boxShadow: '0 0 12px rgba(255,255,255,0.35)',
          }}
        />
      ))}
    </div>
  );
}
