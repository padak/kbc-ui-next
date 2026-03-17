// file: hooks/useStorage.ts
// TanStack Query hooks for Storage API (buckets, tables).
// Each hook = one API call with caching and auto-refetch.
// Used by: pages/storage/BucketsPage.tsx, TableDetailPage.tsx.
// Pattern: useQuery for reads. Query keys prefixed with activeProjectId.

import { useQuery } from '@tanstack/react-query';
import { storageApi } from '@/api/storage';
import { useConnectionStore } from '@/stores/connection';

export function useBuckets() {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'storage', 'buckets'],
    queryFn: () => storageApi.listBuckets(),
    enabled: isConnected,
  });
}

export function useBucket(bucketId: string) {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'storage', 'buckets', bucketId],
    queryFn: () => storageApi.getBucket(bucketId),
    enabled: isConnected && !!bucketId,
  });
}

export function useTables() {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'storage', 'tables'],
    queryFn: () => storageApi.listTables(),
    enabled: isConnected,
  });
}

export function useBucketTables(bucketId: string) {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'storage', 'buckets', bucketId, 'tables'],
    queryFn: () => storageApi.listBucketTables(bucketId),
    enabled: isConnected && !!bucketId,
  });
}

export function useTable(tableId: string) {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'storage', 'tables', tableId],
    queryFn: () => storageApi.getTable(tableId),
    enabled: isConnected && !!tableId,
  });
}

export function useTablePreview(tableId: string) {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'storage', 'tables', tableId, 'preview'],
    queryFn: () => storageApi.getTableDataPreview(tableId),
    enabled: isConnected && !!tableId,
  });
}
