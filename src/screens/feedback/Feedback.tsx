import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { submitFeedback } from '../../lib/api';
import { toast } from '../../store/toast';
import { track } from '../../lib/track';

const SUPPORT_EMAIL = 'kg11041963@gmail.com';
const SUBJECT = encodeURIComponent('BiteWise feedback');

function buildMailto(body = '') {
  return `mailto:${SUPPORT_EMAIL}?subject=${SUBJECT}${body ? `&body=${encodeURIComponent(body)}` : ''}`;
}

function collectDeviceInfo() {
  try {
    const ua = navigator.userAgent;
    const plat = navigator.platform;
    const lang = navigator.language;
    const screen = `${window.screen.width}x${window.screen.height}`;
    return `Device info:
- User agent: ${ua}
- Platform: ${plat}
- Language: ${lang}
- Screen: ${screen}`;
  } catch {
    return 'Device info: unavailable';
  }
}

export default function Feedback() {
  const [message, setMessage] = useState('');
  const [steps, setSteps] = useState('');
  const [category, setCategory] = useState('bug');
  const [severity, setSeverity] = useState('medium');
  const [busy, setBusy] = useState(false);
  const deviceInfo = useMemo(() => collectDeviceInfo(), []);

  const handleCopy = async () => {
    const info = deviceInfo;
    try {
      await navigator.clipboard.writeText(info);
      alert('Device info copied. Paste it in your feedback email.');
    } catch {
      alert(info);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error('Please describe the issue or feedback.');
      return;
    }
    setBusy(true);
    try {
      await submitFeedback({
        message: trimmed,
        steps: steps.trim() || undefined,
        category,
        severity,
        deviceInfo,
        screen: window.location.pathname,
      });
      setMessage('');
      setSteps('');
      track('feedback_submit', { category, severity });
      toast.success('Feedback sent. Thank you!');
    } catch (err: any) {
      const msg = err?.message || 'Could not send feedback. We queued it to retry when online.';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh bg-gradient-to-b from-[#030712] to-[#0f172a] text-white px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Feedback</p>
          <h1 className="text-3xl font-semibold">Help us improve BiteWise</h1>
          <p className="text-sm text-white/70">
            Closed testers can share bugs, navigation issues, or feature requests. Screenshots welcome.
          </p>
        </header>

        <section className="rounded-2xl border border-white/15 bg-white/10 p-4 space-y-4">
          <div className="flex flex-col gap-1">
            <div className="text-base font-semibold">Send feedback</div>
            <p className="text-sm text-white/75">
              This form sends your report to our team (stored securely in Firestore).
            </p>
          </div>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm space-y-1">
                <span className="text-white/80">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white"
                >
                  <option value="bug">Bug</option>
                  <option value="ux">Navigation/UX</option>
                  <option value="feature">Feature request</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-sm space-y-1">
                <span className="text-white/80">Severity</span>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>

            <label className="text-sm space-y-1 w-full">
              <span className="text-white/80">What happened?</span>
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder:text-white/40"
                placeholder="Describe the issue or idea…"
              />
            </label>

            <label className="text-sm space-y-1 w-full">
              <span className="text-white/80">Steps to reproduce (optional)</span>
              <textarea
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                rows={3}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-white placeholder:text-white/40"
                placeholder="1) Open … 2) Tap … 3) Expected …"
              />
            </label>

            <div className="flex flex-wrap gap-3 items-center">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-black hover:bg-emerald-400 disabled:opacity-60 transition"
              >
                {busy ? 'Sending…' : 'Submit feedback'}
              </button>
              <a
                href={buildMailto()}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/20 transition"
              >
                Email instead
              </a>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 transition"
              >
                Copy device info
              </button>
            </div>

            <div className="text-[11px] text-white/60">
              Device info included automatically: {deviceInfo}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-2 text-sm">
          <div className="font-semibold">Common things to share</div>
          <ul className="list-disc pl-5 space-y-1 text-white/70">
            <li>What you tapped or searched just before the issue.</li>
            <li>Your current city and whether location/notifications/mic were granted.</li>
            <li>Screenshots or screen recordings if something looks off.</li>
          </ul>
        </section>

        <footer className="text-xs text-white/60">
          Need account help? Visit <Link to="/settings" className="text-emerald-300 underline">Settings</Link> or email{' '}
          <a href={buildMailto()} className="text-emerald-300 underline">{SUPPORT_EMAIL}</a>.
        </footer>
      </div>
    </main>
  );
}
