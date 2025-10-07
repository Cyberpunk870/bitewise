// src/screens/settings/Settings.tsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPermPolicy, setPermPolicy, decidePerm } from '../../lib/permPrefs';

type Key = 'location' | 'mic' | 'notifications';
type Policy = 'always' | 'session' | 'never'; // match onboarding (3 options)

const KEYS: Key[] = ['location', 'mic', 'notifications'];
const LABEL: Record<Key, string> = {
  location: 'Location',
  mic: 'Microphone',
  notifications: 'Notifications',
};

export default function Settings() {
  const nav = useNavigate();
  const [local, setLocal] = useState<Record<Key, Policy>>(() => ({
    location: (getPermPolicy('location') as Policy) ?? 'session',
    mic: (getPermPolicy('mic') as Policy) ?? 'session',
    notifications: (getPermPolicy('notifications') as Policy) ?? 'session',
  }));
  const changed = useMemo(
    () => KEYS.some(k => local[k] !== (getPermPolicy(k) as Policy)),
    [local]
  );

  function apply() {
    KEYS.forEach(k => setPermPolicy(k, local[k] as any));
    try {
      window.dispatchEvent(new Event('bw:perm:changed'));
      window.dispatchEvent(new StorageEvent('storage', { key: 'bw.perm.changed', newValue: Date.now().toString() } as any));
    } catch {}
    nav(-1);
  }

  const OPTIONS: Policy[] = ['always', 'session', 'never'];

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-500 to-orange-400">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-4">
          <button className="px-3 py-1.5 text-sm rounded-full border bg-white/80" onClick={() => nav(-1)}>← Back</button>
          <h1 className="text-lg font-semibold text-white drop-shadow">Settings</h1>
          <div className="w-16" />
        </header>

        <div className="rounded-2xl bg-white shadow divide-y">
          {KEYS.map(k => {
            const selected = local[k];
            const effective = decidePerm(k); // 'allow' | 'deny' | 'ask'
            return (
              <div key={k} className="p-3">
                <div className="font-medium">{LABEL[k]}</div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {OPTIONS.map(opt => (
                    <button
                      key={opt}
                      className={`rounded-xl border px-3 py-2 text-sm ${selected === opt ? 'bg-black text-white' : ''}`}
                      onClick={() => setLocal(prev => ({ ...prev, [k]: opt }))}
                    >
                      {opt === 'always' ? 'Allow while using the app'
                        : opt === 'session' ? 'Only this time'
                        : "Don’t allow"}
                    </button>
                  ))}
                </div>
                <p className="text-xs opacity-70 mt-2">Current effective: <b>{effective}</b></p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <button className="px-3 py-1.5 rounded-xl border bg-white" onClick={() => nav(-1)}>Cancel</button>
          <button className="px-3 py-1.5 rounded-xl bg-black text-white disabled:opacity-50" disabled={!changed} onClick={apply}>
            Save
          </button>
        </div>
      </div>
    </main>
  );
}
