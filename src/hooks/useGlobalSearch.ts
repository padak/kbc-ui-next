// file: hooks/useGlobalSearch.ts
// Builds searchable index from all cached project metadata.
// Reads TanStack Query cache for buckets, components across all projects.
// Used by: CommandPalette.tsx for cross-project search results.
// Returns filtered results with navigation targets.

import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConnectionStore } from '@/stores/connection';
import type { Bucket, Component } from '@/api/schemas';

export type SearchResult = {
  projectId: string;
  projectName: string;
  type: 'bucket' | 'component' | 'configuration';
  id: string;
  name: string;
  detail: string;
  navigateTo: string;
};

export function useGlobalSearch(query: string) {
  const projects = useConnectionStore((s) => s.projects);
  const queryClient = useQueryClient();

  return useMemo(() => {
    if (!query || query.length < 2) return [];

    const q = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const project of projects) {
      // Search buckets
      const buckets = queryClient.getQueryData<Bucket[]>([project.id, 'storage', 'buckets']);
      if (buckets) {
        for (const bucket of buckets) {
          const name = bucket.displayName || bucket.name;
          if (name.toLowerCase().includes(q) || bucket.id.toLowerCase().includes(q)) {
            results.push({
              projectId: project.id,
              projectName: project.projectName,
              type: 'bucket',
              id: bucket.id,
              name,
              detail: `${bucket.stage} bucket`,
              navigateTo: `/storage/${encodeURIComponent(bucket.id)}`,
            });
          }
        }
      }

      // Search components and their inline configurations
      const components = queryClient.getQueryData<Component[]>([project.id, 'components']);
      if (components) {
        for (const comp of components) {
          if (comp.name.toLowerCase().includes(q) || comp.id.toLowerCase().includes(q)) {
            results.push({
              projectId: project.id,
              projectName: project.projectName,
              type: 'component',
              id: comp.id,
              name: comp.name,
              detail: comp.type,
              navigateTo: `/components/${encodeURIComponent(comp.id)}`,
            });
          }

          // Search configurations (embedded in component response)
          const configs = (comp as Record<string, unknown>).configurations as
            | Array<{ id: string; name: string; description?: string }>
            | undefined;
          if (configs) {
            for (const cfg of configs) {
              if (cfg.name.toLowerCase().includes(q) || cfg.id.includes(q)) {
                results.push({
                  projectId: project.id,
                  projectName: project.projectName,
                  type: 'configuration',
                  id: cfg.id,
                  name: cfg.name,
                  detail: `${comp.name} config`,
                  navigateTo: `/components/${encodeURIComponent(comp.id)}/${cfg.id}`,
                });
              }
            }
          }
        }
      }
    }

    // Limit results
    return results.slice(0, 50);
  }, [query, projects, queryClient]);
}
