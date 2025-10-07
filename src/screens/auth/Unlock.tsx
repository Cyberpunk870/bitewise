// src/screens/auth/Unlock.tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Single-responsibility: forward all unlock traffic to /auth/passkey,
 * keeping any reason for analytics/UI copy.
 */
export default function Unlock() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const reason =
    params.get('reason') || sessionStorage.getItem('bw.logoutReason') || 'idle';

  useEffect(() => {
    nav(`/auth/passkey?reason=${encodeURIComponent(reason)}`, { replace: true });
  }, [nav, reason]);

  return null;
}
