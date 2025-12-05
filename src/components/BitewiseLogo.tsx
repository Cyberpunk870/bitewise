// src/components/BitewiseLogo.tsx
import React from "react";

type Props = {
  size?: number;
  showTagline?: boolean;
  showMark?: boolean;
};

export default function BitewiseLogo({ size = 42, showTagline = false, showMark = true }: Props) {
  return (
    <div className="flex items-center gap-3 select-none text-white">
      {showMark ? (
        <div
          className="relative rounded-[1.15rem] shadow-lg shadow-[#a855f7]/20 overflow-hidden border border-white/20"
          style={{
            width: size,
            height: size,
            background:
              "radial-gradient(circle at 25% 25%, rgba(255,255,255,0.4), transparent 55%), linear-gradient(145deg, #0f172a 0%, #312e81 55%, #5b21b6 100%)",
          }}
        >
          <svg
            viewBox="0 0 80 80"
            className="absolute inset-0"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="bitewise-glow" x1="10" y1="10" x2="70" y2="70">
                <stop stopColor="#fce7f3" stopOpacity="0.95" />
                <stop offset="0.45" stopColor="#fde68a" stopOpacity="0.85" />
                <stop offset="1" stopColor="#a5f3fc" stopOpacity="0.7" />
              </linearGradient>
            </defs>
            <path
              d="M20 28c6-12 18-18 32-16 10 2 18 8 22 18 4 10 2 21-4 30-6 9-16 14-26 14s-20-5-27-13c-7-8-10-19-7-30"
              stroke="url(#bitewise-glow)"
              strokeWidth="7"
              strokeLinecap="round"
              opacity="0.95"
            />
            <circle cx="54" cy="24" r="5" fill="rgba(255,255,255,0.95)" />
          </svg>
          <div className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 rounded-full bg-white/90 shadow-lg shadow-orange-200/50" />
        </div>
      ) : null}
      <div className="flex flex-col leading-tight">
        <span className="text-lg font-semibold tracking-tight">
          Bite
          <span className="ml-1 bg-gradient-to-r from-[#fbbf24] via-[#fb7185] to-[#a78bfa] bg-clip-text text-transparent">
            Wise
          </span>
        </span>
        {showTagline ? (
          <span className="text-[11px] uppercase tracking-[0.25em] text-white/70">
            Eat Save Repeat
          </span>
        ) : null}
      </div>
    </div>
  );
}
