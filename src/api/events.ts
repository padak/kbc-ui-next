// file: src/api/events.ts
// Events API: list, search, and stream storage events.
// Supports global, per-table, per-bucket, and per-job (runId) events.
// Used by: hooks/useEvents.ts, pages/events/.
// Cursor-based pagination via sinceId/maxId (UUIDs, not offsets).

import { z } from 'zod';
import { fetchApi } from './client';

export const EventSchema = z.object({
  id: z.string().optional(),
  uuid: z.string().optional(),
  event: z.string(),
  component: z.string().default(''),
  type: z.enum(['info', 'error', 'warn', 'success']).default('info'),
  message: z.string().default(''),
  description: z.string().default(''),
  created: z.string(),
  runId: z.string().nullable().optional(),
  params: z.record(z.string(), z.unknown()).default({}),
  results: z.record(z.string(), z.unknown()).default({}),
  performance: z.record(z.string(), z.unknown()).optional(),
  token: z.object({ name: z.string() }).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export type KeboolaEvent = z.infer<typeof EventSchema>;

type EventsQuery = {
  limit?: number;
  sinceId?: string;
  maxId?: string;
  q?: string;
  component?: string;
};

function buildQueryString(params: EventsQuery): string {
  const parts: string[] = [];
  if (params.limit) parts.push(`limit=${params.limit}`);
  if (params.sinceId) parts.push(`sinceId=${params.sinceId}`);
  if (params.maxId) parts.push(`maxId=${params.maxId}`);
  if (params.q) parts.push(`q=${encodeURIComponent(params.q)}`);
  if (params.component) parts.push(`component=${encodeURIComponent(params.component)}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export const eventsApi = {
  listEvents(params: EventsQuery = {}) {
    const qs = buildQueryString({ limit: 50, ...params });
    return fetchApi(`/events${qs}`, z.array(EventSchema));
  },

  getEvent(eventId: string) {
    return fetchApi(`/events/${eventId}`, EventSchema);
  },

  listTableEvents(tableId: string, params: EventsQuery = {}) {
    const qs = buildQueryString({ limit: 50, ...params });
    return fetchApi(`/tables/${tableId}/events${qs}`, z.array(EventSchema));
  },

  listBucketEvents(bucketId: string, params: EventsQuery = {}) {
    const qs = buildQueryString({ limit: 50, ...params });
    return fetchApi(`/buckets/${bucketId}/events${qs}`, z.array(EventSchema));
  },
};
