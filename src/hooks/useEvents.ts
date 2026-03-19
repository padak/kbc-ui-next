// file: src/hooks/useEvents.ts
// TanStack Query hooks for events. Supports polling for live updates.
// Per-job events filtered by runId query. Global/table/bucket events.
// Used by: EventsPage, JobDetailPage, TableDetailPage.
// Polling: refetchInterval when enabled, auto-prepends new events.

import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '@/api/events';
import { useConnectionStore } from '@/stores/connection';

export function useEvents(params?: { q?: string; component?: string; limit?: number }) {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'events', params],
    queryFn: () => eventsApi.listEvents(params),
    enabled: isConnected,
    refetchInterval: 10_000,
  });
}

export function useJobEvents(jobId: string | undefined, runId: string | undefined) {
  const { isConnected, activeProjectId } = useConnectionStore();
  // Orchestrator-spawned jobs: runId is the parent orchestrator's runId, not the jobId.
  // Storage events use the child job's ID as runId.
  // Search for both to catch all events.
  const searchQuery = runId && runId !== jobId
    ? `runId:${jobId} OR runId:${runId}`
    : `runId:${jobId}`;

  return useQuery({
    queryKey: [activeProjectId, 'events', 'job', jobId, runId],
    queryFn: () => eventsApi.listEvents({ q: searchQuery, limit: 200 }),
    enabled: isConnected && !!jobId,
    refetchInterval: 5_000,
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
