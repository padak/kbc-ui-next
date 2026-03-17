// file: hooks/useAllProjectsJobs.ts
// Fetches recent jobs from ALL registered projects in parallel.
// Progressive: shows results as each project responds (no waiting for all).
// Used by: pages/jobs/AllJobsPage.tsx.
// Aggressive caching: staleTime 30s, results appear instantly on revisit.

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useConnectionStore } from '@/stores/connection';
import { jobsApi } from '@/api/jobs';
import type { Job } from '@/api/schemas';

export type MultiProjectJob = Job & {
  _projectId: string;
  _projectName: string;
};

export function useAllProjectsJobs(params?: { limit?: number }) {
  const projects = useConnectionStore((s) => s.projects);
  const limit = params?.limit ?? 20;

  const queries = useQueries({
    queries: projects.map((project) => ({
      queryKey: [project.id, 'all-jobs', { limit }],
      queryFn: () =>
        jobsApi.listJobsForProject(
          { stackUrl: project.stackUrl, token: project.token },
          { limit },
        ),
      staleTime: 30_000,
      refetchInterval: 30_000,
    })),
  });

  // Progressive: merge whatever data we have so far (not waiting for all)
  const allJobs = useMemo(() => {
    const merged: MultiProjectJob[] = [];
    queries.forEach((query, index) => {
      const project = projects[index];
      if (query.data && project) {
        for (const job of query.data) {
          merged.push({ ...job, _projectId: project.id, _projectName: project.projectName });
        }
      }
    });
    merged.sort((a, b) => b.createdTime.localeCompare(a.createdTime));
    return merged;
  }, [queries, projects]);

  const loadedCount = queries.filter((q) => q.data || q.error).length;
  const totalCount = projects.length;
  const isLoading = loadedCount === 0;
  const isPartial = loadedCount > 0 && loadedCount < totalCount;
  const failedCount = queries.filter((q) => q.error).length;

  return { data: allJobs, isLoading, isPartial, loadedCount, totalCount, failedCount };
}
