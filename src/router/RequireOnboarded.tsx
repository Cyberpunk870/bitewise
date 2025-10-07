// src/router/RequireOnboarded.tsx
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

function wantRecheck() {
  try { return sessionStorage.getItem('bw.requirePermRecheck') === '1'; } catch { return false; }
}
function firstPendingPerm(): string | null {
  try {
    const { decidePerm } = require('../lib/permPrefs');
    if (decidePerm('location') === 'ask') return '/onboarding/perm/location';
    if (decidePerm('notifications') === 'ask') return '/onboarding/perm/notifications';
    if (decidePerm('mic') === 'ask') return '/onboarding/perm/mic';
  } catch {}
  return null;
}

export default function RequireOnboarded() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/onboarding')) return <Outlet />;
  if (wantRecheck()) {
    const first = firstPendingPerm();
    if (first) return <Navigate to={first} replace />;
  }
  return <Outlet />;
}
