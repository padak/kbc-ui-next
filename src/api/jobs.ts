// file: api/jobs.ts
// Queue/Jobs API: list and manage jobs.
// Note: Jobs use the Queue API, not Storage API. URL differs.
// Used by: hooks/useJobs.ts, pages/jobs/*.
// TODO: Queue API base URL comes from stack services discovery.

import { useConnectionStore } from '@/stores/connection';
import { HTTP_HEADERS } from '@/lib/constants';
import { KeboolaApiError } from './client';
import type { Job } from './types';

async function fetchQueueApi<T>(path: string): Promise<T> {
  const { stackUrl, token } = useConnectionStore.getState();
  if (!stackUrl || !token) {
    throw new KeboolaApiError('Not connected', 401, 'NOT_CONNECTED');
  }

  // Queue API URL is derived from stack URL
  // e.g., https://connection.north-europe.azure.keboola.com -> https://queue.north-europe.azure.keboola.com
  const queueUrl = stackUrl.replace('connection.', 'queue.');

  const response = await fetch(`${queueUrl}${path}`, {
    headers: {
      [HTTP_HEADERS.STORAGE_API_TOKEN]: token,
      [HTTP_HEADERS.CONTENT_TYPE]: 'application/json',
    },
  });

  if (!response.ok) {
    let body: { message?: string; code?: string } = {};
    try { body = await response.json(); } catch { /* not json */ }
    throw new KeboolaApiError(
      body.message ?? `Queue API error: ${response.status}`,
      response.status,
      body.code ?? 'UNKNOWN',
    );
  }

  return response.json() as Promise<T>;
}

export const jobsApi = {
  listJobs(params?: { limit?: number; offset?: number; status?: string; componentId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    if (params?.status) searchParams.set('status', params.status);
    if (params?.componentId) searchParams.set('component', params.componentId);
    const query = searchParams.toString();
    return fetchQueueApi<Job[]>(`/jobs?${query}`);
  },

  getJob(jobId: number) {
    return fetchQueueApi<Job>(`/jobs/${jobId}`);
  },
};
