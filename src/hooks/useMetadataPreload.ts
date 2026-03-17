// file: hooks/useMetadataPreload.ts
// Preloads buckets and components from all registered projects into TanStack Query cache.
// Runs once on mount, non-blocking. Feeds the global search (Cmd+K).
// Used by: AppLayout.tsx after authentication.
// Uses prefetchQuery so it doesn't trigger re-renders.

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConnectionStore } from '@/stores/connection';
import { storageApi } from '@/api/storage';
import { componentsApi } from '@/api/components';

export function useMetadataPreload() {
  const queryClient = useQueryClient();
  const projects = useConnectionStore((s) => s.projects);
  const [status, setStatus] = useState({ isPreloading: false, done: 0, total: 0 });

  useEffect(() => {
    if (projects.length <= 1) return; // Skip for single project - normal hooks handle it

    setStatus({ isPreloading: true, done: 0, total: projects.length });

    const preload = async () => {
      let done = 0;
      await Promise.allSettled(
        projects.map(async (project) => {
          const creds = { stackUrl: project.stackUrl, token: project.token };
          try {
            await queryClient.prefetchQuery({
              queryKey: [project.id, 'storage', 'buckets'],
              queryFn: () => storageApi.listBucketsForProject(creds),
              staleTime: 60_000,
            });
            await queryClient.prefetchQuery({
              queryKey: [project.id, 'components'],
              queryFn: () => componentsApi.listComponentsForProject(creds),
              staleTime: 60_000,
            });
          } catch {
            // Continue on failure
          }
          done++;
          setStatus((s) => ({ ...s, done }));
        }),
      );
      setStatus({ isPreloading: false, done: projects.length, total: projects.length });
    };

    preload();
  }, [projects, queryClient]);

  return status;
}
