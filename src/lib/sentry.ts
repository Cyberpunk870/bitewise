import * as Sentry from "@sentry/react";

let enabled = false;

function parseNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  const tracesSampleRate = parseNumber(import.meta.env.VITE_SENTRY_SAMPLE_RATE as string, 0.05);
  const replaySessionRate = parseNumber(import.meta.env.VITE_SENTRY_REPLAY_RATE as string, 0.0);
  const replayErrorRate = parseNumber(
    import.meta.env.VITE_SENTRY_REPLAY_ERROR_RATE as string,
    0.5
  );

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release:
      (import.meta.env.VITE_COMMIT_SHA as string | undefined) ||
      (import.meta.env.VITE_GIT_SHA as string | undefined),
    integrations: [
      Sentry.browserTracingIntegration(),
      // Record a small sample of sessions for replay; bump only if needed.
      Sentry.replayIntegration({
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate,
    replaysSessionSampleRate: replaySessionRate,
    replaysOnErrorSampleRate: replayErrorRate,
  });
  enabled = true;
}

export function setSentryUser(phone?: string | null) {
  if (!enabled) return;
  if (!phone) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: phone, username: phone });
}

export function captureError(err: unknown, context?: Record<string, unknown>) {
  if (!enabled) return;
  Sentry.captureException(err, { extra: context });
}

export { Sentry };
