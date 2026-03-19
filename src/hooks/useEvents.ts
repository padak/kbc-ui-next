// file: src/hooks/useEvents.ts
// TanStack Query hooks for events. Supports polling for live updates.
// Per-job events use useInfiniteQuery for cursor-based pagination (maxId).
// Used by: EventsPage, JobDetailPage, TableDetailPage.
// Polling: refetchInterval when enabled, auto-prepends new events.

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { eventsApi } from '@/api/events';
import { useConnectionStore } from '@/stores/connection';
import {
  EVENTS_PAGE_SIZE,
  EVENTS_POLL_INTERVAL_JOB,
  EVENTS_POLL_INTERVAL_GLOBAL,
} from '@/config/events';

export function useEvents(params?: { q?: string; component?: string; limit?: number }) {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'events', params],
    queryFn: () => eventsApi.listEvents(params),
    enabled: isConnected,
    refetchInterval: EVENTS_POLL_INTERVAL_GLOBAL,
  });
}

export function useJobEvents(
  jobId: string | undefined,
  _runId: string | undefined,
  options?: { polling?: boolean },
) {
  const { isConnected, activeProjectId } = useConnectionStore();
  // Legacy UI uses job.id as the runId parameter (not job.runId).
  // The API's runId query param is a dedicated filter, not a Lucene query.

  const polling = options?.polling !== false;

  return useInfiniteQuery({
    queryKey: [activeProjectId, 'events', 'job', jobId],
    queryFn: ({ pageParam }) =>
      eventsApi.listEvents({
        runId: jobId,
        limit: EVENTS_PAGE_SIZE,
        ...(pageParam ? { maxId: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < EVENTS_PAGE_SIZE) return undefined;
      const oldest = lastPage.at(-1);
      return oldest?.uuid ?? oldest?.id ?? undefined;
    },
    enabled: isConnected && !!jobId,
    refetchInterval: polling ? EVENTS_POLL_INTERVAL_JOB : false,
  });
}

export function useTableEvents(tableId: string) {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'events', 'table', tableId],
    queryFn: () => eventsApi.listTableEvents(tableId),
    enabled: isConnected && !!tableId,
  });
}

export function useBucketEvents(bucketId: string) {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'events', 'bucket', bucketId],
    queryFn: () => eventsApi.listBucketEvents(bucketId),
    enabled: isConnected && !!bucketId,
  });
}
