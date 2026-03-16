// file: api/jobs.ts
// Queue/Jobs API: list and manage jobs via /search/jobs endpoint.
// All responses validated through Zod schemas before reaching UI.
// Used by: hooks/useJobs.ts, pages/jobs/*.
// Queue URL derived from stack URL (connection.* -> queue.*).

import { z } from 'zod';
import { fetchQueueApi } from './client';
import { JobSchema } from './schemas';

export const jobsApi = {
  listJobs(params?: { limit?: number; offset?: number; status?: string; componentId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    if (params?.status) searchParams.set('status', params.status);
    if (params?.componentId) searchParams.set('component', params.componentId);
    const query = searchParams.toString();
    return fetchQueueApi(`/search/jobs?${query}`, z.array(JobSchema));
  },

  getJob(jobId: string) {
    return fetchQueueApi(`/jobs/${jobId}`, JobSchema);
  },
};
