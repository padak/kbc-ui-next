// file: api/components.ts
// Components API: list components, CRUD configurations and rows.
// Covers extractors, writers, applications, transformations.
// Used by: hooks/useComponents.ts, pages/components/*.
// Reference: GET /v2/storage/components, /components/{id}/configs.

import { fetchApi } from './client';
import type { Component, Configuration } from './types';

export const componentsApi = {
  listComponents() {
    return fetchApi<Component[]>('/components');
  },

  getComponent(componentId: string) {
    return fetchApi<Component>(`/components/${componentId}`);
  },

  listConfigurations(componentId: string) {
    return fetchApi<Configuration[]>(`/components/${componentId}/configs`);
  },

  getConfiguration(componentId: string, configId: string) {
    return fetchApi<Configuration>(`/components/${componentId}/configs/${configId}`);
  },

  createConfiguration(componentId: string, data: { name: string; description?: string; configuration?: Record<string, unknown> }) {
    return fetchApi<Configuration>(`/components/${componentId}/configs`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateConfiguration(componentId: string, configId: string, data: { name?: string; description?: string; configuration?: Record<string, unknown>; changeDescription?: string }) {
    return fetchApi<Configuration>(`/components/${componentId}/configs/${configId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteConfiguration(componentId: string, configId: string) {
    return fetchApi<void>(`/components/${componentId}/configs/${configId}`, {
      method: 'DELETE',
    });
  },

  listConfigurationRows(componentId: string, configId: string) {
    return fetchApi<Configuration['rows']>(`/components/${componentId}/configs/${configId}/rows`);
  },
};
