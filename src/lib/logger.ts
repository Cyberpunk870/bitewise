// src/lib/logger.ts
import { addNotice } from './notifications';
import { captureError } from './sentry';

type LogLevel = 'info' | 'warn' | 'error';

export function log(
  level: LogLevel,
  message: string,
  ctx?: Record<string, unknown>,
  opts?: { toast?: boolean }
) {
  const payload = { message, ...ctx };
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[${level.toUpperCase()}] ${message}`, ctx ?? '');

  if (opts?.toast && level === 'error') {
    addNotice({
      kind: 'system',
      title: 'Something went wrong',
      body: message,
    });
  }

  if (level === 'error') {
    try { captureError(new Error(message), ctx); } catch {}
  }
}

export function logError(message: string, ctx?: Record<string, unknown>, opts?: { toast?: boolean }) {
  log('error', message, ctx, opts);
}
