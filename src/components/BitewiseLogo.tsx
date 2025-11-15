// src/components/BitewiseLogo.tsx
import React from "react";

export default function BitewiseLogo({ size = 42 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2 select-none">
      <div
        className="relative rounded-2xl shadow-lg shadow-orange-500/20"
        style={{
          width: size,
          height: size,
          background:
            "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), transparent 55%), linear-gradient(135deg, #ff9770 0%, #ff6f91 50%, #845ef7 100%)",
        }}
      >
        <svg
          viewBox="0 0 64 64"
          className="absolute inset-0"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M32 8c13.255 0 24 10.745 24 24 0 9.343-5.417 17.41-13.255 21.197a4 4 0 0 1-5.671-4.134c.582-4.624-1.453-9.438-5.83-12.318-4.378-2.88-9.821-2.88-14.2 0a4 4 0 0 1-4.9-.492C9.015 32.672 8 29.426 8 32 8 18.745 18.745 8 32 8Z"
            fill="url(#bitewise-logo-grad)"
            opacity={0.9}
          />
          <defs>
            <linearGradient
              id="bitewise-logo-grad"
              x1="8"
              y1="8"
              x2="56"
              y2="56"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#fff5d6" stopOpacity="0.95" />
              <stop offset="1" stopColor="#ffd4f0" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <path
            d="M39 21c3.314 0 6 2.686 6 6"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-white/80" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-lg font-semibold tracking-tight text-white">
          Bite
          <span className="bg-gradient-to-r from-orange-300 to-pink-200 bg-clip-text text-transparent">
            Wise
          </span>
        </span>
        <span className="text-xs uppercase tracking-[0.3em] text-white/60">
          Eat • Save • Repeat
        </span>
      </div>
    </div>
  );
}
