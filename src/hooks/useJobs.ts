// file: hooks/useJobs.ts
// TanStack Query hooks for Queue/Jobs API.
// Lists jobs with full filtering/sorting, shows job detail.
// Used by: pages/jobs/JobsPage.tsx, DashboardPage.tsx.
// Auto-refetches running jobs every 5 seconds.

import { useQuery } from '@tanstack/react-query';
import { jobsApi, type JobSearchParams } from '@/api/jobs';
import { useConnectionStore } from '@/stores/connection';

const RUNNING_STATUSES = new Set(['created', 'waiting', 'processing', 'terminating']);

export function useJobs(params?: JobSearchParams) {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'jobs', params ?? {}],
    queryFn: () => jobsApi.listJobs(params),
    enabled: isConnected,
    refetchInterval: 10_000,
  });
}

export function useJob(jobId: string) {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'jobs', jobId],
    queryFn: () => jobsApi.getJob(jobId),
    enabled: isConnected && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && RUNNING_STATUSES.has(status) ? 5_000 : false;
    },
  });
}
