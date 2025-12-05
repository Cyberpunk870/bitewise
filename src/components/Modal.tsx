// src/components/Modal.tsx
import React from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
};

export default function Modal({ open, onClose, children, title }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-[#0b1120]/95 text-white shadow-2xl shadow-black/40 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">{title || 'Details'}</h3>
          <button
            className="text-sm text-white/60 hover:text-white"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}
