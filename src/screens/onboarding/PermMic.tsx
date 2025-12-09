// src/screens/onboarding/PermMic.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gateMic } from '../../lib/permGate';
import {
  usePermDecision,
  setPermPolicy,
  allowForThisSession,
  type PermDecision,
} from '../../lib/permPrefs';
import { emit } from '../../lib/events';
import { track } from '../../lib/track';

export default function PermMic() {
  const nav = useNavigate();

  // Live, reactive decision: 'allow' | 'deny' | 'ask'
  const dec: PermDecision = usePermDecision('microphone');

  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<'always' | 'session' | 'never' | null>(null);

  // Treat explicit "unsupported" as unsupported (show info message)
  const unsupported = useMemo(() => {
    const g = gateMic();
    return !g.ok && g.reason === 'unsupported';
  }, []);

  // If already allowed (Always or Session), proceed like before
  useEffect(() => {
    if (dec === 'allow') {
      // Keep your existing onboarding flow behavior
      setTimeout(() => nav('/onboarding/setpasskey', { replace: true }), 0);
    }
  }, [dec, nav]);

  // Ask the native prompt (only under user gesture). Returns true if a stream was obtained.
  async function nudgeNativePrompt(): Promise<boolean> {
    const httpsOk =
      location.protocol === 'https:' ||
      ['localhost', '127.0.0.1'].includes(location.hostname);

    if (!httpsOk) {
      // We can’t prompt on insecure origins; just notify listeners to refresh UI
      try { emit('bw:toast', { title: 'Voice search requires HTTPS', body: 'Open the app over HTTPS (or localhost) to enable microphone.' } as any); } catch {}
      return false;
    }

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately stop tracks—we only needed the prompt
        stream.getTracks().forEach((t) => t.stop());
        return true;
      }
    } catch {
      // User may have cancelled or blocked; swallow here and let the UI reflect current decision.
    }
    return false;
  }

  async function chooseAlways() {
    if (unsupported || busy) return;
    setBusy(true);
    setPicked('always');
    try {
      setPermPolicy('microphone', 'always');
      const ok = await nudgeNativePrompt();
      // Regardless of ok/err, inform listeners so UI can update
      try { emit('bw:perm:changed', null); } catch {}
      track('perm_mic_allow', { mode: 'always', ok });
      // If ok, dec will become 'allow' via usePermDecision and the effect will route forward
      if (!ok) {
        // If user denied in the native sheet, keep the policy as-is but they’ll still be blocked by the browser.
        // Optionally toast for clarity:
        try { emit('bw:toast', { title: 'Microphone permission', body: 'If you blocked the mic in the browser prompt, enable it from site settings.' } as any); } catch {}
      }
    } finally {
      setBusy(false);
      setPicked(null);
    }
  }

  async function chooseSession() {
    if (unsupported || busy) return;
    setBusy(true);
    setPicked('session');
    try {
      allowForThisSession('microphone'); // mark session intent
      const ok = await nudgeNativePrompt();
      try { emit('bw:perm:changed', null); } catch {}
      track('perm_mic_allow', { mode: 'session', ok });
      if (!ok) {
        try { emit('bw:toast', { title: 'Microphone permission', body: 'If you blocked the mic in the browser prompt, enable it from site settings.' } as any); } catch {}
      }
    } finally {
      setBusy(false);
      setPicked(null);
    }
  }

  function chooseNever() {
    if (busy) return;
    setPicked('never');
    setPermPolicy('microphone', 'never');
    try { emit('bw:perm:changed', null); } catch {}
    track('perm_mic_deny');
    // Move forward so onboarding cannot stall on denial
    setTimeout(() => nav('/onboarding/setpasskey', { replace: true }), 120);
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <div className="glass-card w-full max-w-md p-6 space-y-5 text-white animate-fade-up">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Voice Search (Mic)</h1>
          <p className="text-sm text-white/70">
            Enable microphone to try voice search and quick actions.
          </p>
        </div>

        {unsupported && (
          <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white/80">
            Microphone / Media APIs aren’t supported in this browser or context (HTTPS required). You can continue without them.
          </div>
        )}

        {/* Show current decision for visibility */}
        <div className="text-xs text-white/60 text-center">
          Decision now: <span className="font-medium text-white">{dec}</span>
          {!unsupported ? null : <span className="ml-2">(unsupported)</span>}
        </div>
        {unsupported && (
          <div className="text-xs text-white/60 text-center">
            Voice search is unavailable here. You can keep using text search anytime.
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={chooseAlways}
            disabled={busy || unsupported}
            className={[
              'w-full rounded-xl py-3 font-semibold disabled:opacity-50 transition',
              picked === 'always'
                ? 'bg-gradient-to-r from-[#fde68a] via-[#f9a8d4] to-[#c084fc] text-[#0b1120]'
                : 'bg-gradient-to-r from-[#fde68a] via-[#f9a8d4] to-[#c084fc] text-[#0b1120]'
            ].join(' ')}
          >
            {picked === 'always' && busy ? 'Requesting…' : 'Always allow'}
          </button>

          <button
            onClick={chooseSession}
            disabled={busy || unsupported}
            className={[
              'w-full rounded-xl border border-white/20 py-3 text-white disabled:opacity-50',
              picked === 'session' ? 'bg-white/10' : 'bg-white/5'
            ].join(' ')}
          >
            {picked === 'session' && busy ? 'Requesting…' : 'Only this time'}
          </button>

          <button
            onClick={chooseNever}
            disabled={busy}
            className={[
              'w-full rounded-xl border border-white/20 py-3 text-white/80 disabled:opacity-50',
              picked === 'never' ? 'bg-white/5' : ''
            ].join(' ')}
          >
            Don’t allow
          </button>
        </div>

        <p className="text-xs text-center text-white/60">You can change this later in Settings.</p>
      </div>
    </div>
  );
}
