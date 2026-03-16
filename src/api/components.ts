// file: api/components.ts
// Components API: list components, CRUD configurations and rows.
// All responses validated through Zod schemas before reaching UI.
// Used by: hooks/useComponents.ts, pages/components/*.
// Reference: GET /v2/storage/components, /components/{id}/configs.

import { z } from 'zod';
import { fetchApi } from './client';
import { ComponentSchema, ConfigurationSchema } from './schemas';

export const componentsApi = {
  listComponents() {
    return fetchApi('/components', z.array(ComponentSchema));
  },

  getComponent(componentId: string) {
    return fetchApi(`/components/${componentId}`, ComponentSchema);
  },

  listConfigurations(componentId: string) {
    return fetchApi(`/components/${componentId}/configs`, z.array(ConfigurationSchema));
  },

  getConfiguration(componentId: string, configId: string) {
    return fetchApi(`/components/${componentId}/configs/${configId}`, ConfigurationSchema);
  },

  createConfiguration(componentId: string, data: { name: string; description?: string; configuration?: Record<string, unknown> }) {
    return fetchApi(`/components/${componentId}/configs`, ConfigurationSchema, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateConfiguration(componentId: string, configId: string, data: { name?: string; description?: string; configuration?: Record<string, unknown>; changeDescription?: string }) {
    return fetchApi(`/components/${componentId}/configs/${configId}`, ConfigurationSchema, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteConfiguration(componentId: string, configId: string) {
    return fetchApi(`/components/${componentId}/configs/${configId}`, z.unknown(), {
      method: 'DELETE',
    });
  },

  listConfigurationRows(componentId: string, configId: string) {
    return fetchApi(
      `/components/${componentId}/configs/${configId}/rows`,
      z.array(z.record(z.string(), z.unknown())),
    );
  },
};
