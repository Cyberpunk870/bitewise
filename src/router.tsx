// src/router.tsx
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import AppShell from './shell/AppShell';


/* Onboarding screens */
import Welcome           from './screens/onboarding/Welcome';
import Name              from './screens/onboarding/Name';
import Dob               from './screens/onboarding/Dob';
import AddressPick       from './screens/onboarding/AddressPick';
import AddressLabel      from './screens/onboarding/AddressLabel';
import Phone             from './screens/onboarding/Phone';
import Otp               from './screens/onboarding/Otp';
import PermLocation      from './screens/onboarding/PermLocation';
import PermNotifications from './screens/onboarding/PermNotifications';
import PermMic           from './screens/onboarding/PermMic';
import SetPasskey        from './screens/onboarding/SetPasskey';
import Finish            from './screens/onboarding/Finish';

/* Auth (returning users) */
import Unlock           from './screens/auth/Unlock';
import PasskeyLogin     from './screens/auth/PasskeyLogin';

/* App screens */
import Home             from './screens/home/Home';
import Compare          from './screens/compare/Compare';
import Cart             from './screens/cart/Cart';
import Availability     from './screens/availability/Availability';

/* Real hamburger targets */
import Inbox            from './screens/notifications/Inbox';
import Tasks            from './screens/tasks/Tasks';
import Leaderboard      from './screens/leaderboard/Leaderboard';
import History          from './screens/History';
import Settings         from './screens/settings/Settings';
import Achievements     from './screens/achievements/Achievements';

/* ---------------- Guard: require active session for app section -------- */
function RequireAuthedOutlet() {
  const hasPhone = !!(sessionStorage.getItem('bw.session.phone') || '');
  if (hasPhone) return <Outlet />;

  const reason = sessionStorage.getItem('bw.logoutReason') || '';
  if (reason === 'idle') return <Navigate to="/unlock" replace />;
  return <Navigate to="/onboarding/auth/phone?mode=login" replace />;
}

/* -------------------------------- Router ------------------------------- */
const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Welcome /> },

      // Onboarding alias
      { path: '/onboarding', element: <Navigate to="/onboarding/auth/phone?mode=login" replace /> },

      // Onboarding flow
      { path: '/onboarding/name',               element: <Name /> },
      { path: '/onboarding/dob',                element: <Dob /> },
      { path: '/onboarding/address/pick',       element: <AddressPick /> },
      { path: '/onboarding/address/label',      element: <AddressLabel /> },
      { path: '/onboarding/auth/phone',         element: <Phone /> },
      { path: '/onboarding/auth/otp',           element: <Otp /> },
      { path: '/onboarding/perm/location',      element: <PermLocation /> },
      { path: '/onboarding/perm/notifications', element: <PermNotifications /> },
      { path: '/onboarding/perm/mic',           element: <PermMic /> },
      { path: '/onboarding/setpasskey',         element: <SetPasskey /> },
      { path: '/onboarding/finish',             element: <Finish /> },

      // Returning users
      { path: '/unlock',       element: <Unlock /> },
      { path: '/auth/passkey', element: <PasskeyLogin /> },

      // Protected app section
      {
        element: <RequireAuthedOutlet />,
        children: [
          { path: '/home',           element: <Home /> },
          { path: '/compare/:id',    element: <Compare /> },
          { path: '/cart',           element: <Cart /> },
          { path: '/availability',   element: <Availability /> },

          // Hamburger routes (real screens)
          { path: '/notifications',  element: <Inbox /> },
          { path: '/tasks',          element: <Tasks /> },
          { path: '/leaderboard',    element: <Leaderboard /> },
          { path: '/orders/history', element: <History /> },
          { path: '/settings',       element: <Settings /> },
          { path: '/achievements',   element: <Achievements /> },
        ],
      },

      // Fallbacks
      { path: '/compare', element: <Navigate to="/availability" replace /> },
      { path: '*',        element: <Navigate to="/home" replace /> },
    ],
  },
]);

export default router;
