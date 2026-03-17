// file: api/jobs.ts
// Queue/Jobs API: list and manage jobs via /search/jobs endpoint.
// All responses validated through Zod schemas before reaching UI.
// Used by: hooks/useJobs.ts, pages/jobs/*.
// Queue URL derived from stack URL (connection.* -> queue.*).

import { z } from 'zod';
import { fetchQueueApi, fetchQueueApiForProject, type ProjectCredentials } from './client';
import { JobSchema, RunJobResponseSchema } from './schemas';

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

  createJob(params: { component: string; config?: string; mode?: string; configRowIds?: string[] }) {
    return fetchQueueApi('/jobs', RunJobResponseSchema, {
      method: 'POST',
      body: JSON.stringify({
        component: params.component,
        config: params.config,
        mode: params.mode ?? 'run',
        ...(params.configRowIds?.length ? { configRowIds: params.configRowIds } : {}),
      }),
    });
  },

  listJobsForProject(creds: ProjectCredentials, params?: { limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return fetchQueueApiForProject(creds, `/search/jobs?${query}`, z.array(JobSchema));
  },

  // Get last job per config in one API call. Chunks configIds into batches of 20.
  async getLatestJobsPerConfig(componentIds: string[], configIds: string[]): Promise<Record<string, z.infer<typeof JobSchema>>> {
    if (configIds.length === 0) return {};

    const result: Record<string, z.infer<typeof JobSchema>> = {};
    const chunks: string[][] = [];
    for (let i = 0; i < configIds.length; i += 20) {
      chunks.push(configIds.slice(i, i + 20));
    }

    const GroupedJobsSchema = z.array(z.object({
      group: z.object({
        configId: z.string(),
      }).passthrough(),
      jobs: z.array(JobSchema),
    }).passthrough());

    for (const chunk of chunks) {
      const params = new URLSearchParams();
      params.append('jobsPerGroup', '1');
      for (const gk of ['projectId', 'branchId', 'componentId', 'configId']) {
        params.append('groupBy[]', gk);
      }
      for (const cid of componentIds) {
        params.append('component', cid);
      }
      for (const cfgId of chunk) {
        params.append('config[]', cfgId);
      }

      try {
        const groups = await fetchQueueApi(`/search/grouped-jobs?${params.toString()}`, GroupedJobsSchema);
        for (const g of groups) {
          if (g.jobs[0]) {
            result[g.group.configId] = g.jobs[0];
          }
        }
      } catch {
        // Continue on failure
      }
    }

    return result;
  },
};
