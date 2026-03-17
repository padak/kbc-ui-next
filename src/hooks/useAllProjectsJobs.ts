// file: hooks/useAllProjectsJobs.ts
// Fetches recent jobs from ALL registered projects in parallel.
// Merges results sorted by createdTime for the multi-project jobs view.
// Used by: pages/jobs/AllJobsPage.tsx.
// Uses useQueries for parallel per-project fetching.

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
      refetchInterval: 15_000,
    })),
  });

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

  const isLoading = queries.some((q) => q.isLoading);

  return { data: allJobs, isLoading };
}
