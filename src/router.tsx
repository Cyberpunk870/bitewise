// src/router.tsx
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import AppShell from './shell/AppShell';

/* Onboarding screens */
import Welcome            from './screens/onboarding/Welcome';
import Name               from './screens/onboarding/Name';
import Dob                from './screens/onboarding/Dob';
import AddressPick        from './screens/onboarding/AddressPick';
import AddressLabel       from './screens/onboarding/AddressLabel';
import Phone              from './screens/onboarding/Phone';
import Otp                from './screens/onboarding/Otp';
import PermLocation       from './screens/onboarding/PermLocation';
import PermNotifications  from './screens/onboarding/PermNotifications';
import PermMic            from './screens/onboarding/PermMic';
import SetPasskey         from './screens/onboarding/SetPasskey';
import Finish             from './screens/onboarding/Finish';

/* Auth (returning users) */
import Unlock             from './screens/auth/Unlock';
// ❌ We will NOT import PasskeyLogin for runtime use anymore
// import PasskeyLogin    from './screens/auth/PasskeyLogin';

/* App screens */
import Home               from './screens/home/Home';
import Compare            from './screens/compare/Compare';
import Cart               from './screens/cart/Cart';
import Availability       from './screens/availability/Availability';

/* Real hamburger targets */
import Inbox              from './screens/notifications/Inbox';
import Tasks              from './screens/tasks/Tasks';
import Leaderboard        from './screens/leaderboard/Leaderboard';
import History            from './screens/orders/History';
import Settings           from './screens/settings/Settings';
import Achievements       from './screens/achievements/Achievements';

/* ---------- Guards ---------- */
function RequireAuthedOutlet() {
  const hasPhone = !!(sessionStorage.getItem('bw.session.phone') || '');
  if (hasPhone) return <Outlet />;

  const reason = sessionStorage.getItem('bw.logoutReason') || '';
  if (reason === 'idle') return <Navigate to="/unlock" replace />;

  return <Navigate to="/" replace />; // go to Welcome
}

function RequireVisitorOutlet() {
  // Block onboarding for already authed users
  const hasPhone = !!(sessionStorage.getItem('bw.session.phone') || '');
  const loc = useLocation();
  const path = loc.pathname;
  const isAuthScreens = path.startsWith('/onboarding/auth/');

  if (hasPhone && isAuthScreens) {
    return <Navigate to="/home" replace />;
  }
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
      { path: '/', element: <Welcome /> },

      // Handy reset route
      { path: '/reset', element: <Reset /> },

      // Onboarding (ALWAYS start at phone)
      {
        element: <RequireVisitorOutlet />,
        children: [
          { path: '/onboarding',                    element: <Navigate to="/onboarding/auth/phone" replace /> },
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
        ]
      },

      // Returning users
      { path: '/unlock', element: <Unlock /> },

      // 🔁 DEPRECATED LEGACY ROUTE
      // Instead of rendering PasskeyLogin (which fakes auth by just setting bw.session.phone),
      // send everyone to /unlock. This keeps the "one true unlock path".
      { path: '/auth/passkey', element: <Navigate to="/unlock" replace /> },

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
      { path: '*',        element: <Navigate to="/" replace /> },  // safer default
    ],
  },
]);

export default router;