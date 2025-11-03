// server/lib/response.ts
import { APIResponse } from '../types';

export function ok<T>(data: T): APIResponse<T> {
  return { ok: true, data };
}

export function fail(msg: string): APIResponse<null> {
  return { ok: false, error: msg };
}
