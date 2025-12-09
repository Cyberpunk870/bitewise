// src/router/RequireOnboarded.tsx
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { decidePerm } from '../lib/permPrefs';

/** did we mark that the app should force a permission re-check? */
function wantRecheck() {
  try {
    return sessionStorage.getItem('bw.requirePermRecheck') === '1';
  } catch {
    return false;
  }
}

/** find the first permission that still needs asking, or null if we're good */
function firstPendingPerm(): string | null {
  try {
    if (decidePerm('location') === 'ask') return '/onboarding/perm/location';
    if (decidePerm('notifications') === 'ask') return '/onboarding/perm/notifications';
  if (decidePerm('microphone') === 'ask') return '/onboarding/perm/mic';
  } catch {
    // fail soft: if anything blows up here, don't block the user
  }
  return null;
}

export default function RequireOnboarded() {
  const { pathname } = useLocation();

  // If you're literally inside onboarding flow already, allow nested routes.
  if (pathname.startsWith('/onboarding')) {
    return <Outlet />;
  }

  // If we flagged we need to re-check permissions (like after idle unlock),
  // bounce them to the first missing permission step.
  if (wantRecheck()) {
    const first = firstPendingPerm();
    if (first) {
      return <Navigate to={first} replace />;
    }
  }

  // Otherwise let them through.
  return <Outlet />;
}
