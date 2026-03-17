// file: hooks/useComponentLookup.ts
// Builds lookup maps from components data: ID -> name for jobs display.
// Resolves component IDs and config IDs to human-readable names.
// Used by: JobsPage, DashboardPage, anywhere jobs are displayed.
// Data source: useComponents() hook (already cached by TanStack Query).

import { useMemo } from 'react';
import { useComponents } from './useComponents';

type ComponentInfo = {
  name: string;
  type: string;
  ico32?: string | null;
};

type ConfigInfo = {
  name: string;
  componentName: string;
  componentType: string;
};

export function useComponentLookup() {
  const { data: components } = useComponents();

  const lookup = useMemo(() => {
    const componentMap = new Map<string, ComponentInfo>();
    const configMap = new Map<string, ConfigInfo>();

    if (!components) return { componentMap, configMap };

    for (const comp of components) {
      componentMap.set(comp.id, {
        name: comp.name,
        type: comp.type,
        ico32: comp.ico32,
      });

      const configs = (comp as Record<string, unknown>).configurations as Array<{ id: string; name: string }> | undefined;
      if (configs) {
        for (const cfg of configs) {
          configMap.set(`${comp.id}:${cfg.id}`, {
            name: cfg.name,
            componentName: comp.name,
            componentType: comp.type,
          });
        }
      }
    }

    return { componentMap, configMap };
  }, [components]);

  function getComponentName(componentId: string): string {
    return lookup.componentMap.get(componentId)?.name ?? componentId;
  }

  function getComponentType(componentId: string): string {
    return lookup.componentMap.get(componentId)?.type ?? '';
  }

  function getComponentIcon(componentId: string): string | null {
    return lookup.componentMap.get(componentId)?.ico32 ?? null;
  }

  function getConfigName(componentId: string, configId: string): string {
    return lookup.configMap.get(`${componentId}:${configId}`)?.name ?? configId;
  }

  return { getComponentName, getComponentType, getComponentIcon, getConfigName };
}
