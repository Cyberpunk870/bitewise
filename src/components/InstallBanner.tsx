import React, { useEffect, useState } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { openNativeApp } from '../lib/deepLinks';

const DISMISS_KEY = 'bw.install.dismissed';

export default function InstallBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { supported, promptInstall, resetPrompt } = useInstallPrompt({ enabled: !dismissed });

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    } catch {}
  }, []);

  useEffect(() => {
    if (dismissed) resetPrompt();
  }, [dismissed, resetPrompt]);

  if (!supported || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {}
    resetPrompt();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
      <div className="glass-card border border-white/15 px-4 py-3 flex items-center gap-3 text-sm text-white">
        <div className="flex-1">
          <p className="font-semibold">Install BiteWise</p>
          <p className="text-xs text-white/70">One-tap access, faster compare flow, and seasonal themes.</p>
        </div>
        <button
          className="rounded-lg bg-white text-black px-3 py-2 text-xs font-semibold"
          onClick={async () => {
            const ok = await promptInstall();
            if (ok) dismiss();
          }}
        >
          Install
        </button>
        <button
          className="text-xs text-white/70 hover:text-white"
          onClick={() => {
            openNativeApp();
            dismiss();
          }}
        >
          Open app
        </button>
        <button className="text-white/50 text-xs" onClick={dismiss} aria-label="Dismiss install banner">
          ×
        </button>
      </div>
    </div>
  );
}
