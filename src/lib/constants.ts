// file: lib/constants.ts
// Application-wide constants and configuration values.
// Includes HTTP headers, navigation items, and route paths.
// Used by: api/client.ts, components/Sidebar.tsx, App.tsx.
// All magic strings live here - never hardcode elsewhere.

export const HTTP_HEADERS = {
  STORAGE_API_TOKEN: 'X-StorageApi-Token',
  CONTENT_TYPE: 'Content-Type',
} as const;

export const STORAGE_KEY = {
  STACK_URL: 'kbc_stack_url',
  TOKEN: 'kbc_storage_token',
  PROJECTS: 'kbc_projects',
  ACTIVE_PROJECT_ID: 'kbc_active_project_id',
} as const;

export const ROUTES = {
  CONNECT: '/',
  DASHBOARD: '/dashboard',
  STORAGE: '/storage',
  STORAGE_TABLE: '/storage/:bucketId/:tableId',
  COMPONENTS: '/components',
  COMPONENT_CONFIGS: '/components/:componentId',
  CONFIGURATION: '/components/:componentId/:configId',
  FLOWS: '/flows',
  TRANSFORMATIONS: '/transformations',
  JOBS: '/jobs',
  JOB_DETAIL: '/jobs/:jobId',
  SETTINGS: '/settings',
} as const;

export const NAV_ITEMS = [
  { label: 'Dashboard', path: ROUTES.DASHBOARD, icon: 'home' },
  { label: 'Storage', path: ROUTES.STORAGE, icon: 'database' },
  { label: 'Components', path: ROUTES.COMPONENTS, icon: 'puzzle' },
  { label: 'Flows', path: ROUTES.FLOWS, icon: 'workflow' },
  { label: 'Transformations', path: ROUTES.TRANSFORMATIONS, icon: 'code' },
  { label: 'Jobs', path: ROUTES.JOBS, icon: 'play' },
  { label: 'Settings', path: ROUTES.SETTINGS, icon: 'settings' },
] as const;
