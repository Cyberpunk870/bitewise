import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function HomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10.5V20h14v-9.5" />
    </svg>
  );
}

export default function HomeFab() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const isHome = pathname === '/home' || pathname === '/';

  if (isHome) return null;

  return (
    <button
      type="button"
      onClick={() => nav('/home', { replace: true })}
      className="fixed right-3 bottom-20 h-10 w-10 grid place-items-center rounded-xl border bg-white/90 shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
      aria-label="Go home"
      title="Go home"
    >
      <HomeIcon />
    </button>
  );
}
