console.log("VITE_API_BASE=",import.meta.env.VITE_API_BASE);
// ---- hard-disable Firestore streaming *before* any Firebase import ----
;(globalThis as any)._FIREBASE_FIRESTORE_FORCE_LONG_POLLING = true;
;(globalThis as any)._FIREBASE_FIRESTORE_USE_FETCH_STREAMS = false;
// -----------------------------------------------------------------------
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import router from './router';
import './index.css';
import './lib/firebase';

import { getAuth } from "firebase/auth";
(window as any).getAuth = getAuth;

ReactDOM.createRoot(document.getElementById('root')!).render(
    <RouterProvider router={router} />
);
