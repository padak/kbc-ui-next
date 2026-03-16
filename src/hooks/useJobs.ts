// file: hooks/useJobs.ts
// TanStack Query hooks for Queue/Jobs API.
// Lists jobs with filtering, shows job detail.
// Used by: pages/jobs/JobsPage.tsx, DashboardPage.tsx.
// Auto-refetches running jobs every 5 seconds.

import { useQuery } from '@tanstack/react-query';
import { jobsApi } from '@/api/jobs';
import { useConnectionStore } from '@/stores/connection';

const RUNNING_STATUSES = new Set(['created', 'waiting', 'processing', 'terminating']);

export function useJobs(params?: { limit?: number; status?: string; componentId?: string }) {
  const isConnected = useConnectionStore((s) => s.isConnected);
  const limit = params?.limit ?? 50;

  return useQuery({
    queryKey: ['jobs', { limit, status: params?.status, componentId: params?.componentId }],
    queryFn: () => jobsApi.listJobs({ limit, status: params?.status, componentId: params?.componentId }),
    enabled: isConnected,
    refetchInterval: 10_000,
  });
}

export function useJob(jobId: number) {
  const isConnected = useConnectionStore((s) => s.isConnected);

  return useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => jobsApi.getJob(jobId),
    enabled: isConnected && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && RUNNING_STATUSES.has(status) ? 5_000 : false;
    },
  });
}
