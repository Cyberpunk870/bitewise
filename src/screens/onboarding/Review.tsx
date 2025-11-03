// src/screens/onboarding/Review.tsx
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAddress } from '../../store/address';
import { useTheme } from '../../store/theme';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toast';

function normalizeLabel(rawLabel: any): string {
  // your address store sometimes keeps label as string OR { custom: string } OR undefined
  if (typeof rawLabel === 'string' && rawLabel.trim()) {
    return rawLabel.trim();
  }
  if (rawLabel && typeof rawLabel === 'object' && typeof rawLabel.custom === 'string') {
    return rawLabel.custom.trim();
  }
  return '—';
}

export default function Review() {
  const nav = useNavigate();

  // from address store
  const { addressLine, label } = useAddress();

  // theme
  const { dark, setDark } = useTheme();

  // auth
  const { phone } = useAuth(); // we are NOT reading "verified" anymore because it's not in the store

  // local UI state
  const [name, setName] = useState<string>('');
  const [notifState, setNotifState] = useState<string>('unknown');

  // derive a clean string for label to keep TS & Row(props.value: string) happy
  const labelText = useMemo(() => normalizeLabel(label), [label]);

  useEffect(() => {
    setName(localStorage.getItem('bw_profile_name') || '');
    setNotifState(localStorage.getItem('bw_perm_notif') || 'unknown');
  }, []);

  function finish() {
    localStorage.setItem('bw_onboarded', '1');
    toast.success?.('Welcome to BiteWise!');
    nav('/home', { replace: true });
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Review</h1>

      <div className="rounded-2xl border divide-y">
        <Row label="Name" value={name || '—'} />
        <Row label="Phone" value={phone || '—'} />
        <Row label="Address" value={addressLine || '—'} />
        <Row label="Label" value={labelText} />
      </div>

      <div className="rounded-2xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Dark mode</div>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Switch theme for this device
            </div>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dark}
              onChange={(e) => setDark(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">{dark ? 'On' : 'Off'}</span>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Notifications</div>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Deals & updates
            </div>
          </div>
          <div className="text-sm">{notifState}</div>
        </div>
      </div>

      <button
        onClick={finish}
        className="w-full py-3 rounded-2xl bg-black text-white dark:bg-white dark:text-black"
      >
        Finish &amp; Go to Home
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 flex items-center justify-between">
      <div className="text-sm text-gray-600 dark:text-gray-300">{label}</div>
      <div
        className="font-medium text-right max-w-[60%] truncate"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}