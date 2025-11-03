// server/api/ingest.ts
import { insert } from '../lib/db';
import { ok, fail } from '../lib/response';
import type { EventPayload, APIResponse } from '../types';

export async function ingestEvents(events: EventPayload[]): Promise<APIResponse> {
  try {
    events.forEach((ev) => insert('events', ev));
    return ok({ count: events.length });
  } catch (err: any) {
    return fail(err?.message || 'Failed to ingest events');
  }
}

