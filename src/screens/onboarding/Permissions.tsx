import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardFrame from '../../components/OnboardFrame';
import { useOnboarding, type PermStatus } from '../../store/onboarding';

function StatusPill({ s }: { s: PermStatus }) {
  const map: Record<PermStatus, string> = {
    unknown: 'bg-gray-100 text-gray-600',
    granted: 'bg-green-100 text-green-700',
    denied: 'bg-red-100 text-red-700',
    unavailable: 'bg-yellow-100 text-yellow-800',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs ${map[s]}`}>{s}</span>;
}

export default function Permissions() {
  const nav = useNavigate();
  const { perm, setPerm, markComplete } = useOnboarding();
  const [busy, setBusy] = useState<{ [k in 'location'|'notifications'|'mic']?: boolean }>({});

  // Decide current location permission (WHY: sets expectations before asking).
  useEffect(() => {
    (navigator as any).permissions?.query?.({ name: 'geolocation' as PermissionName })
      .then((p) => setPerm('location', p.state === 'granted' ? 'granted' : p.state === 'denied' ? 'denied' : 'unknown'))
      .catch(() => {});
  }, [setPerm]);

  async function askLocation() {
    if (!navigator.geolocation) {
      setPerm('location', 'unavailable');
      return;
    }
    setBusy({ k: 'location' } as any);
    navigator.geolocation.getCurrentPosition(
      () => { setPerm('location', 'granted'); setBusy({} as any); },
      () => { setPerm('location', 'denied'); setBusy({} as any); },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  async function askNotifications() {
    if (!('Notification' in window)) {
      setPerm('notifications', 'unavailable');
      return;
    }
    setBusy({ k: 'notifications' } as any);
    try {
      const res = await Notification.requestPermission();
      setPerm('notifications', res === 'granted' ? 'granted' : res === 'denied' ? 'denied' : 'unknown');
    } finally {
      setBusy({} as any);
    }
  }

  async function askMic() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPerm('mic', 'unavailable');
      return;
    }
    setBusy({ k: 'mic' } as any);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPerm('mic', 'granted');
    } catch {
      setPerm('mic', 'denied');
    } finally {
      setBusy({} as any);
    }
  }

  const decided = (s: PermStatus) => s !== 'unknown';
  const canContinue = decided(perm.location) && decided(perm.notifications);

  return (
    <OnboardFrame title="Permissions" subtitle="Allow a few things to personalise your experience. You can change them later.">
      <div className="space-y-4">
        <div className="flex items-center justify-between border rounded-xl p-3">
          <div>
            <div className="font-medium">Location</div>
            <div className="text-sm text-gray-500">To show nearby options & delivery distance.</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill s={perm.location} />
            <button
              className="px-3 py-1.5 rounded-xl border"
              disabled={busy['location']}
              onClick={askLocation}
            >
              Allow
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border rounded-xl p-3">
          <div>
            <div className="font-medium">Notifications</div>
            <div className="text-sm text-gray-500">Order updates.</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill s={perm.notifications} />
            <button
              className="px-3 py-1.5 rounded-xl border"
              disabled={busy['notifications']}
              onClick={askNotifications}
            >
              Allow
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border rounded-xl p-3">
          <div>
            <div className="font-medium">Microphone (optional)</div>
            <div className="text-sm text-gray-500">Voice search (future).</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill s={perm.mic} />
            <button
              className="px-3 py-1.5 rounded-xl border"
              disabled={busy['mic']}
              onClick={askMic}
            >
              Allow
            </button>
          </div>
        </div>
      </div>

      <button
        className={`mt-6 w-full px-4 py-2 rounded-xl ${canContinue ? 'bg-black text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
        disabled={!canContinue}
        onClick={() => {
          markComplete();
          // brief "loading experience" screen could be shown here; go straight to home for now
          nav('/home', { replace: true });
        }}
      >
        Continue
      </button>
    </OnboardFrame>
  );
}
