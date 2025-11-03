// src/screens/onboarding/Permissions.tsx
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
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${map[s]}`}>
      {s}
    </span>
  );
}

type BusyMap = {
  location?: boolean;
  notifications?: boolean;
  mic?: boolean;
};

export default function Permissions() {
  const nav = useNavigate();
  const { perm, setPerm, markComplete } = useOnboarding();

  const [busy, setBusy] = useState<BusyMap>({});

  // Decide current location permission (sets expectations before asking).
  useEffect(() => {
    (navigator as any).permissions
      ?.query?.({ name: 'geolocation' as PermissionName })
      .then((p: PermissionStatus) => {
        const nextStatus: PermStatus =
          p.state === 'granted'
            ? 'granted'
            : p.state === 'denied'
            ? 'denied'
            : 'unknown';
        setPerm('location', nextStatus);
      })
      .catch(() => {});
  }, [setPerm]);

  async function askLocation() {
    if (!navigator.geolocation) {
      setPerm('location', 'unavailable');
      return;
    }
    setBusy((b) => ({ ...b, location: true }));
    navigator.geolocation.getCurrentPosition(
      () => {
        setPerm('location', 'granted');
        setBusy((b) => ({ ...b, location: false }));
      },
      () => {
        setPerm('location', 'denied');
        setBusy((b) => ({ ...b, location: false }));
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  async function askNotifications() {
    if (!('Notification' in window)) {
      setPerm('notifications', 'unavailable');
      return;
    }
    setBusy((b) => ({ ...b, notifications: true }));
    try {
      const res = await Notification.requestPermission();
      const nextStatus: PermStatus =
        res === 'granted'
          ? 'granted'
          : res === 'denied'
          ? 'denied'
          : 'unknown';
      setPerm('notifications', nextStatus);
    } finally {
      setBusy((b) => ({ ...b, notifications: false }));
    }
  }

  async function askMic() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPerm('mic', 'unavailable');
      return;
    }
    setBusy((b) => ({ ...b, mic: true }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      // Immediately stop tracks — we only need the permission grant.
      stream.getTracks().forEach((t) => t.stop());
      setPerm('mic', 'granted');
    } catch {
      setPerm('mic', 'denied');
    } finally {
      setBusy((b) => ({ ...b, mic: false }));
    }
  }

  const decided = (s: PermStatus) => s !== 'unknown';
  const canContinue =
    decided(perm.location) && decided(perm.notifications);

  return (
    <OnboardFrame
      title="Permissions"
      subtitle="Allow a few things to personalise your experience. You can change them later."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between border rounded-xl p-3">
          <div>
            <div className="font-medium">Location</div>
            <div className="text-sm text-gray-500">
              To show nearby options & delivery distance.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill s={perm.location} />
            <button
              className="px-3 py-1.5 rounded-xl border"
              disabled={busy.location}
              onClick={askLocation}
            >
              Allow
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border rounded-xl p-3">
          <div>
            <div className="font-medium">Notifications</div>
            <div className="text-sm text-gray-500">
              Order updates.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill s={perm.notifications} />
            <button
              className="px-3 py-1.5 rounded-xl border"
              disabled={busy.notifications}
              onClick={askNotifications}
            >
              Allow
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border rounded-xl p-3">
          <div>
            <div className="font-medium">Microphone (optional)</div>
            <div className="text-sm text-gray-500">
              Enables voice search.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill s={perm.mic} />
            <button
              className="px-3 py-1.5 rounded-xl border"
              disabled={busy.mic}
              onClick={askMic}
            >
              Allow
            </button>
          </div>
        </div>
      </div>

      <button
        className={`mt-6 w-full px-4 py-2 rounded-xl ${
          canContinue
            ? 'bg-black text-white'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
        }`}
        disabled={!canContinue}
        onClick={() => {
          markComplete();
          // In dev this screen can drop you into the app.
          nav('/home', { replace: true });
        }}
      >
        Continue
      </button>
    </OnboardFrame>
  );
}