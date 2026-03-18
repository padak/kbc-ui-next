// file: hooks/useMutations.ts
// TanStack Query mutation hooks for all write operations.
// Handles cache invalidation after successful mutations.
// Used by: action components (RunButton, CreateConfigModal, etc.).
// IMPORTANT: Query keys MUST include activeProjectId prefix to match useQuery keys.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '@/api/jobs';
import { componentsApi } from '@/api/components';
import { storageApi } from '@/api/storage';
import { useConnectionStore } from '@/stores/connection';

export function useRunJob() {
  const queryClient = useQueryClient();
  const { activeProjectId } = useConnectionStore();
  return useMutation({
    mutationFn: (params: { component: string; config?: string; mode?: string }) =>
      jobsApi.createJob(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeProjectId, 'jobs'] });
    },
  });
}

export function useCreateConfiguration(componentId: string) {
  const queryClient = useQueryClient();
  const { activeProjectId } = useConnectionStore();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      componentsApi.createConfiguration(componentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeProjectId, 'components', componentId, 'configs'] });
    },
  });
}

export function useUpdateConfiguration(componentId: string, configId: string) {
  const queryClient = useQueryClient();
  const { activeProjectId } = useConnectionStore();
  return useMutation({
    mutationFn: (data: { name?: string; description?: string; configuration?: Record<string, unknown>; isDisabled?: boolean; changeDescription?: string }) =>
      componentsApi.updateConfiguration(componentId, configId, data),
    onSuccess: (updatedConfig) => {
      // Immediately update cache with API response (no stale flash)
      queryClient.setQueryData([activeProjectId, 'components', componentId, 'configs', configId], updatedConfig);
      queryClient.invalidateQueries({ queryKey: [activeProjectId, 'components', componentId, 'configs'] });
    },
  });
}

export function useUpdateConfigurationRow(componentId: string, configId: string) {
  const queryClient = useQueryClient();
  const { activeProjectId } = useConnectionStore();
  return useMutation({
    mutationFn: (data: { rowId: string; name?: string; description?: string; configuration?: Record<string, unknown>; isDisabled?: boolean; changeDescription?: string }) =>
      componentsApi.updateConfigurationRow(componentId, configId, data.rowId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeProjectId, 'components', componentId, 'configs', configId] });
    },
  });
}

export function useCopyConfiguration(componentId: string) {
  const queryClient = useQueryClient();
  const { activeProjectId } = useConnectionStore();
  return useMutation({
    mutationFn: (data: { configId: string; newName: string }) =>
      componentsApi.copyConfiguration(componentId, data.configId, data.newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeProjectId, 'components', componentId, 'configs'] });
    },
  });
}

export function useDeleteBucket() {
  const queryClient = useQueryClient();
  const { activeProjectId } = useConnectionStore();
  return useMutation({
    mutationFn: (bucketId: string) =>
      storageApi.deleteBucket(bucketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeProjectId, 'storage', 'buckets'] });
    },
  });
}

export function useCreateBucket() {
  const queryClient = useQueryClient();
  const { activeProjectId } = useConnectionStore();
  return useMutation({
    mutationFn: (data: { name: string; stage: string; description?: string; backend?: string }) =>
      storageApi.createBucket(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeProjectId, 'storage', 'buckets'] });
    },
  });
}
