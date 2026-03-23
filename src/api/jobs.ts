// file: api/jobs.ts
// Queue/Jobs API: list and manage jobs via /search/jobs endpoint.
// All responses validated through Zod schemas before reaching UI.
// Used by: hooks/useJobs.ts, pages/jobs/*.
// Queue URL derived from stack URL (connection.* -> queue.*).

import { z } from 'zod';
import { fetchQueueApi, fetchQueueApiForProject, type ProjectCredentials } from './client';
import { JobSchema, RunJobResponseSchema } from './schemas';

// Full search params supported by Queue API /search/jobs
export type JobSearchParams = {
  limit?: number;
  offset?: number;
  // Multi-value filters
  status?: string[];
  componentId?: string[];
  configId?: string[];
  tokenDescription?: string[];
  type?: string;
  // Time range
  createdTimeFrom?: string;
  createdTimeTo?: string;
  // Duration range
  durationSecondsFrom?: number;
  durationSecondsTo?: number;
  // Sorting
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  // ID search
  id?: string[];
  runId?: string[];
};

// Build URLSearchParams from JobSearchParams, handling array params correctly
function buildSearchParams(params?: JobSearchParams): string {
  if (!params) return '';

  const sp = new URLSearchParams();

  if (params.limit) sp.set('limit', String(params.limit));
  if (params.offset) sp.set('offset', String(params.offset));

  // Array params use param[]=val1&param[]=val2 format
  if (params.status?.length) {
    for (const v of params.status) sp.append('status[]', v);
  }
  if (params.componentId?.length) {
    for (const v of params.componentId) sp.append('componentId[]', v);
  }
  if (params.configId?.length) {
    for (const v of params.configId) sp.append('configId[]', v);
  }
  if (params.tokenDescription?.length) {
    for (const v of params.tokenDescription) sp.append('tokenDescription[]', v);
  }
  if (params.id?.length) {
    for (const v of params.id) sp.append('id[]', v);
  }
  if (params.runId?.length) {
    for (const v of params.runId) sp.append('runId[]', v);
  }

  // Scalar params
  if (params.type) sp.set('type', params.type);
  if (params.createdTimeFrom) sp.set('createdTimeFrom', params.createdTimeFrom);
  if (params.createdTimeTo) sp.set('createdTimeTo', params.createdTimeTo);
  if (params.durationSecondsFrom != null) sp.set('durationSecondsFrom', String(params.durationSecondsFrom));
  if (params.durationSecondsTo != null) sp.set('durationSecondsTo', String(params.durationSecondsTo));
  if (params.sortBy) sp.set('sortBy', params.sortBy);
  if (params.sortOrder) sp.set('sortOrder', params.sortOrder);

  return sp.toString();
}

export const jobsApi = {
  listJobs(params?: JobSearchParams) {
    const query = buildSearchParams(params);
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
