// file: hooks/useMutations.ts
// TanStack Query mutation hooks for all write operations.
// Handles cache invalidation after successful mutations.
// Used by: action components (RunButton, CreateConfigModal, etc.).
// Each mutation invalidates related queries on success.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '@/api/jobs';
import { componentsApi } from '@/api/components';
import { storageApi } from '@/api/storage';

export function useRunJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { component: string; config?: string; mode?: string }) =>
      jobsApi.createJob(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useCreateConfiguration(componentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      componentsApi.createConfiguration(componentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components', componentId, 'configs'] });
    },
  });
}

export function useUpdateConfiguration(componentId: string, configId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; description?: string; configuration?: Record<string, unknown>; isDisabled?: boolean; changeDescription?: string }) =>
      componentsApi.updateConfiguration(componentId, configId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components', componentId, 'configs'] });
      queryClient.invalidateQueries({ queryKey: ['components', componentId, 'configs', configId] });
    },
  });
}

export function useUpdateConfigurationRow(componentId: string, configId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { rowId: string; configuration?: Record<string, unknown>; changeDescription?: string }) =>
      componentsApi.updateConfigurationRow(componentId, configId, data.rowId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components', componentId, 'configs', configId] });
    },
  });
}

export function useDeleteBucket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bucketId: string) =>
      storageApi.deleteBucket(bucketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'buckets'] });
    },
  });
}

export function useCreateBucket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; stage: string; description?: string; backend?: string }) =>
      storageApi.createBucket(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage', 'buckets'] });
    },
  });
}
