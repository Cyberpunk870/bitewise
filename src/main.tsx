console.log("VITE_API_BASE=", import.meta.env.VITE_API_BASE);
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import router from './router';
import { Sentry, initSentry } from './lib/sentry';
// Ensure Firebase is initialized before any feature (auth/api/missions) calls getAuth().
import './lib/firebase';
import './index.css';

initSentry();

const ErrorFallback = () => (
  <div className="min-h-dvh grid place-items-center bg-[#020617] text-white px-4">
    <div className="max-w-md text-center space-y-3">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-white/70">
        We hit an unexpected error. Please reload to continue.
      </p>
      <button
        className="mt-2 rounded-xl bg-white text-black px-4 py-2 font-semibold"
        onClick={() => window.location.reload()}
      >
        Reload
      </button>
    </div>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
    <RouterProvider router={router} />
  </Sentry.ErrorBoundary>
);
