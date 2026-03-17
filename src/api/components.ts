// file: api/components.ts
// Components API: list components, CRUD configurations and rows.
// All responses validated through Zod schemas before reaching UI.
// Used by: hooks/useComponents.ts, pages/components/*.
// Reference: GET /v2/storage/components, /components/{id}/configs.

import { z } from 'zod';
import { fetchApi } from './client';
import { ComponentSchema, ConfigurationSchema, ConfigurationRowSchema } from './schemas';

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
    const body = new URLSearchParams();
    body.set('name', data.name);
    if (data.description) body.set('description', data.description);
    if (data.configuration) body.set('configuration', JSON.stringify(data.configuration));
    return fetchApi(`/components/${componentId}/configs`, ConfigurationSchema, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  },

  updateConfiguration(componentId: string, configId: string, data: { name?: string; description?: string; configuration?: Record<string, unknown>; changeDescription?: string; isDisabled?: boolean }) {
    const body = new URLSearchParams();
    if (data.name !== undefined) body.set('name', data.name);
    if (data.description !== undefined) body.set('description', data.description);
    if (data.configuration) body.set('configuration', JSON.stringify(data.configuration));
    if (data.changeDescription) body.set('changeDescription', data.changeDescription);
    if (data.isDisabled !== undefined) body.set('isDisabled', String(data.isDisabled));
    return fetchApi(`/components/${componentId}/configs/${configId}`, ConfigurationSchema, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
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

  updateConfigurationRow(componentId: string, configId: string, rowId: string, data: { configuration?: Record<string, unknown>; changeDescription?: string }) {
    const body = new URLSearchParams();
    if (data.configuration) body.set('configuration', JSON.stringify(data.configuration));
    if (data.changeDescription) body.set('changeDescription', data.changeDescription);
    return fetchApi(`/components/${componentId}/configs/${configId}/rows/${rowId}`, ConfigurationRowSchema, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  },
};
