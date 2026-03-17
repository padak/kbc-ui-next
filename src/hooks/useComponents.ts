// file: hooks/useComponents.ts
// TanStack Query hooks for Components API.
// Lists components, configurations, and config rows.
// Used by: pages/components/*.tsx, Sidebar component counts.
// Provides filtered views: extractors, writers, apps, transformations.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { componentsApi } from '@/api/components';
import { useConnectionStore } from '@/stores/connection';
import type { Component } from '@/api/schemas';

export function useComponents() {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'components'],
    queryFn: () => componentsApi.listComponents(),
    enabled: isConnected,
  });
}

export function useComponentsByType(type: Component['type']) {
  const { data: components, ...rest } = useComponents();

  return {
    ...rest,
    data: components?.filter((c) => c.type === type),
  };
}

export function useComponent(componentId: string) {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'components', componentId],
    queryFn: () => componentsApi.getComponent(componentId),
    enabled: isConnected && !!componentId,
  });
}

export function useConfigurations(componentId: string) {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'components', componentId, 'configs'],
    queryFn: () => componentsApi.listConfigurations(componentId),
    enabled: isConnected && !!componentId,
  });
}

export function useConfiguration(componentId: string, configId: string) {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'components', componentId, 'configs', configId],
    queryFn: () => componentsApi.getConfiguration(componentId, configId),
    enabled: isConnected && !!componentId && !!configId,
  });
}

export function useDeleteConfiguration(componentId: string) {
  const queryClient = useQueryClient();
  const activeProjectId = useConnectionStore((s) => s.activeProjectId);

  return useMutation({
    mutationFn: (configId: string) => componentsApi.deleteConfiguration(componentId, configId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activeProjectId, 'components', componentId, 'configs'] });
    },
  });
}
