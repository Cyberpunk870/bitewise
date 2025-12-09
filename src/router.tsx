// src/router.tsx
import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import AppShell from './shell/AppShell';

const Welcome = lazy(() => import('./screens/onboarding/Welcome'));
const Name = lazy(() => import('./screens/onboarding/Name'));
const Dob = lazy(() => import('./screens/onboarding/Dob'));
const AddressPick = lazy(() => import('./screens/onboarding/AddressPick'));
const AddressLabel = lazy(() => import('./screens/onboarding/AddressLabel'));
const Phone = lazy(() => import('./screens/onboarding/Phone'));
const Otp = lazy(() => import('./screens/onboarding/Otp'));
const PermLocation = lazy(() => import('./screens/onboarding/PermLocation'));
const PermNotifications = lazy(() => import('./screens/onboarding/PermNotifications'));
const PermMic = lazy(() => import('./screens/onboarding/PermMic'));
const SetPasskey = lazy(() => import('./screens/onboarding/SetPasskey'));
const Finish = lazy(() => import('./screens/onboarding/Finish'));

const Unlock = lazy(() => import('./screens/auth/Unlock'));
const QuickUnlock = lazy(() => import('./screens/auth/QuickUnlock'));

const Home = lazy(() => import('./screens/home/Home'));
const Compare = lazy(() => import('./screens/compare/Compare'));
const Cart = lazy(() => import('./screens/cart/Cart'));
const Availability = lazy(() => import('./screens/availability/Availability'));

const Inbox = lazy(() => import('./screens/notifications/Inbox'));
const Tasks = lazy(() => import('./screens/tasks/Tasks'));
const Leaderboard = lazy(() => import('./screens/leaderboard/Leaderboard'));
const History = lazy(() => import('./screens/orders/History'));
const Settings = lazy(() => import('./screens/settings/Settings'));
const Achievements = lazy(() => import('./screens/achievements/Achievements'));
const Feedback = lazy(() => import('./screens/feedback/Feedback'));
const AdminAnalytics = lazy(() => import('./screens/admin/Analytics'));
const AdminThemes = lazy(() => import('./screens/admin/Themes'));
const Offers = lazy(() => import('./screens/offers/Offers'));
const Terms = lazy(() => import('./screens/legal/Terms'));
const Privacy = lazy(() => import('./screens/legal/Privacy'));
const RewardsPolicy = lazy(() => import('./screens/legal/RewardsPolicy'));
const AccountDeletion = lazy(() => import('./screens/legal/AccountDeletion'));

const SUSPENSE_FALLBACK = (
  <div className="min-h-dvh grid place-items-center text-white/70">
    Loading…
  </div>
);

const withSuspense = (node: React.ReactElement) => (
  <Suspense fallback={SUSPENSE_FALLBACK}>{node}</Suspense>
);

/* ---------- Guards ---------- */
function RequireAuthedOutlet() {
  const hasVerified = !!(sessionStorage.getItem('bw.session.phoneVerified') || '');
  if (hasVerified) return <Outlet />;
  return <Navigate to="/onboarding/auth/phone" replace />;
}

function RequireVisitorOutlet() {
  const hasVerified = !!(sessionStorage.getItem('bw.session.phoneVerified') || '');
  const loc = useLocation();
  const path = loc.pathname;

  // If already logged in and hitting root/onboarding root, send to home
  if (hasVerified && (path === '/' || path === '/onboarding')) {
    return <Navigate to="/home" replace />;
  }

  // Allow onboarding/auth screens even if logged in (to avoid skipping OTP)
  return <Outlet />;
}

/* ---------- Reset route helper ---------- */
function Reset() {
  try {
    localStorage.clear();
    sessionStorage.clear();
    // broadcast auth/perm changes so UIs react instantly
    try { window.dispatchEvent(new Event('bw:auth:changed')); } catch {}
    try { window.dispatchEvent(new Event('bw:perm:changed')); } catch {}
  } catch {}
  return <Navigate to="/" replace />;
}

/* -------------------------------- Router ------------------------------- */
const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: withSuspense(<Welcome />) },
      { path: '/legal/terms', element: withSuspense(<Terms />) },
      { path: '/legal/privacy', element: withSuspense(<Privacy />) },
      { path: '/legal/rewards', element: withSuspense(<RewardsPolicy />) },
      { path: '/legal/delete-account', element: withSuspense(<AccountDeletion />) },

      // Handy reset route
      { path: '/reset', element: <Reset /> },

      // Onboarding (ALWAYS start at phone)
      {
        element: <RequireVisitorOutlet />,
        children: [
          { path: '/onboarding',                    element: <Navigate to="/onboarding/auth/phone" replace /> },
          { path: '/onboarding/name',               element: withSuspense(<Name />) },
          { path: '/onboarding/dob',                element: withSuspense(<Dob />) },
          { path: '/onboarding/address/pick',       element: withSuspense(<AddressPick />) },
          { path: '/onboarding/address/label',      element: withSuspense(<AddressLabel />) },
          { path: '/onboarding/auth/phone',         element: withSuspense(<Phone />) },
          { path: '/onboarding/auth/otp',           element: withSuspense(<Otp />) },
          { path: '/onboarding/perm/location',      element: withSuspense(<PermLocation />) },
          { path: '/onboarding/perm/notifications', element: withSuspense(<PermNotifications />) },
          { path: '/onboarding/perm/mic',           element: withSuspense(<PermMic />) },
          { path: '/onboarding/setpasskey',         element: withSuspense(<SetPasskey />) },
          { path: '/onboarding/finish',             element: withSuspense(<Finish />) },
        ]
      },

      // Returning users
      { path: '/unlock', element: withSuspense(<Unlock />) },
      { path: '/quick-unlock', element: withSuspense(<QuickUnlock />) },

      // 🔁 DEPRECATED LEGACY ROUTE
      // Instead of rendering PasskeyLogin (which fakes auth by just setting bw.session.phone),
      // send everyone to /unlock. This keeps the "one true unlock path".
      { path: '/auth/passkey', element: <Navigate to="/unlock" replace /> },

      // Protected app section
      {
        element: <RequireAuthedOutlet />,
        children: [
          { path: '/home',           element: withSuspense(<Home />) },
          { path: '/compare/:id',    element: withSuspense(<Compare />) },
          { path: '/cart',           element: withSuspense(<Cart />) },
          { path: '/availability',   element: withSuspense(<Availability />) },

          // Hamburger routes (real screens)
          { path: '/notifications',  element: withSuspense(<Inbox />) },
          { path: '/tasks',          element: withSuspense(<Tasks />) },
          { path: '/leaderboard',    element: withSuspense(<Leaderboard />) },
          { path: '/orders/history', element: withSuspense(<History />) },
          { path: '/settings',       element: withSuspense(<Settings />) },
          { path: '/achievements',   element: withSuspense(<Achievements />) },
          { path: '/feedback',       element: withSuspense(<Feedback />) },
          { path: '/admin/analytics', element: withSuspense(<AdminAnalytics />) },
          { path: '/admin/themes', element: withSuspense(<AdminThemes />) },
          { path: '/offers',         element: withSuspense(<Offers />) },
        ],
      },

      // Fallbacks
      { path: '/compare', element: <Navigate to="/availability" replace /> },
      { path: '*',        element: <Navigate to="/" replace /> },  // safer default
    ],
  },
]);

export default router;
