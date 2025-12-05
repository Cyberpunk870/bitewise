// src/components/CoinIcon.tsx
import React from 'react';
export default function CoinIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
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
  );
}
