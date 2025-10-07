// src/components/HamburgerMenu.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HamburgerMenu({
  notifCount = 0,
  taskCount = 0,
}: {
  notifCount?: number;
  taskCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (open && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  const go = (to: string) => {
    setOpen(false);
    nav(to);
  };

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Open menu"
        className="rounded-xl bg-white/80 px-3 py-2 shadow"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {/* simple hamburger icon */}
        <span className="block w-5 h-[2px] bg-black mb-1" />
        <span className="block w-5 h-[2px] bg-black mb-1" />
        <span className="block w-5 h-[2px] bg-black" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white p-2 shadow-lg z-50">
          <MenuItem label="Notifications" onClick={() => go('/notifications')} badge={notifCount} />
          <MenuItem label="Tasks" onClick={() => go('/tasks')} badge={taskCount} />
          <MenuItem label="Leaderboard" onClick={() => go('/leaderboard')} />
          <MenuItem label="Order history" onClick={() => go('/orders')} />

          <div className="my-2 h-px bg-black/10" />

          {/* Optional: your filter screen/availability */}
          <MenuItem label="Filter" onClick={() => go('/availability')} prefix="▶" />

          <button
            className="mt-2 w-full rounded-xl bg-black px-4 py-3 text-white"
            onClick={() => {
              setOpen(false);
              // fire your existing logout logic (AppShell listens for this)
              window.dispatchEvent(new Event('bw:logout'));
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  badge,
  prefix,
}: {
  label: string;
  onClick: () => void;
  badge?: number;
  prefix?: string;
}) {
  return (
    <button
      type="button"
      className="w-full rounded-xl px-3 py-2 text-left hover:bg-black/5 flex items-center justify-between"
      onClick={onClick}
    >
      <span className="flex items-center gap-2">
        {prefix ? <span className="opacity-70">{prefix}</span> : null}
        <span>{label}</span>
      </span>
      {badge && badge > 0 ? (
        <span className="ml-3 inline-flex min-w-[20px] h-[20px] items-center justify-center text-[11px] rounded-full bg-black text-white px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  );
}
