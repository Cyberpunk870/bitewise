# BiteWise Web + API

Single repo for the BiteWise React frontend (Vite) and the Firebase-backed Express API that powers it. The frontend and backend run in the same Vercel project so that `https://<app>/api/*` always resolves to the serverless bundle generated from `backend-lib`.

## Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- Firebase project with:
  - Web config (API key, sender id, etc.)
  - Service-account credentials (JSON)
  - Firestore + Cloud Messaging enabled

## Environment Variables

Copy `.env.example` to `.env.local` for local development. The same keys must be added to your Vercel project (Production + Preview environments).

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_*` | Frontend Firebase SDK config (keep prod + local in sync). |
| `VITE_GOOGLE_MAPS_API_KEY` | Required for Maps SDK features. |
| `VITE_USE_FIRESTORE` | `1` to enable profile syncing. |
| `VITE_API_BASE` | Use `/api` in prod (defaults to `/api` automatically). |
| `VITE_FCM_VAPID_KEY` | Web push key from Firebase console (Project Settings → Cloud Messaging). |
| `CLIENT_ORIGINS` | Comma-separated list of web origins allowed to hit the backend (include localhost, preview, and prod domains). |
| `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON` | Backend credentials so Firebase Admin can mint/verify tokens & write to Firestore. |

### Vercel env tips

```
vercel env add VITE_FIREBASE_API_KEY production
vercel env add VITE_FIREBASE_API_KEY preview
...repeat for the rest...
```

Set `VITE_API_BASE` to `/api` (or leave unset), and set `CLIENT_ORIGINS` to the full HTTPS origins of your preview/prod deployments. The backend also auto-allows `https://${VERCEL_URL}`.

## Local Development

```bash
npm install
cp .env.example .env.local   # fill in real credentials
npm run dev:server           # terminal A – Express + Firebase Admin on http://localhost:3000
npm run dev                  # terminal B – Vite dev server on http://localhost:5173
```

The frontend automatically talks to `http://localhost:3000/api` in dev and `/api` in production builds.

## Building & Testing

```bash
npm run build:server   # emits dist/backend-lib/*
npm run build          # builds server + frontend bundle (used by Vercel/@vercel/static-build)
npm run preview        # serves the built frontend locally
```

## Deployment (Vercel)

1. Push your code or run `vercel --prod`.
2. Ensure `vercel.json` routes are untouched (API requests are rewritten to `api/[...all].ts`).
3. Confirm the Production env vars cover every key listed in `.env.example`.
4. Hit `https://<app>/api/ready` after deploy to verify Firebase Admin boots with your service-account.

With the envs configured, the deployed frontend and backend share the same Firebase project, Firestore writes persist, and push notifications can register in production (provided the VAPID key is set).
