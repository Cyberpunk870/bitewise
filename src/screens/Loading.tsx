// src/screens/Loading.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Loading() {
  const nav = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => nav('/home', { replace: true }), 1000);
    return () => clearTimeout(t);
  }, [nav]);

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-4 border-gray-300 border-t-transparent animate-spin" />
        <p className="text-sm text-gray-600">Loading your experience…</p>
      </div>
    </div>
  );
}
