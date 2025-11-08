// server/api/ingest.ts
import { insert } from '../../backend-lib/lib/db';
import { ok, fail } from '../../backend-lib/lib/response';
import type { EventPayload, APIResponse } from '../../backend-lib/types';

export async function ingestEvents(events: EventPayload[]): Promise<APIResponse> {
  try {
    events.forEach((ev) => insert('events', ev));
    return ok({ count: events.length });
  } catch (err: any) {
    return fail(err?.message || 'Failed to ingest events');
  }
}

