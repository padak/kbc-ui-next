// file: config/jobFilters.ts
// Constants for job search/filter UI: status options, time presets, duration ranges, job types.
// All filter-related magic values live here — never hardcode in components.
// Used by: pages/jobs/JobsPage.tsx, components/FilterDropdown.tsx.
// Update when Queue API adds new statuses or job types.

export const JOB_STATUS_OPTIONS = [
  { value: 'processing', label: 'Processing', color: 'blue' },
  { value: 'success', label: 'Success', color: 'green' },
  { value: 'error', label: 'Error', color: 'red' },
  { value: 'warning', label: 'Warning', color: 'orange' },
  { value: 'waiting', label: 'Waiting', color: 'gray' },
  { value: 'created', label: 'Created', color: 'gray' },
  { value: 'terminated', label: 'Terminated', color: 'gray' },
  { value: 'cancelled', label: 'Cancelled', color: 'gray' },
] as const;

export const TIME_RANGE_PRESETS = [
  { label: '1 hour', value: '1h', hours: 1 },
  { label: '24 hours', value: '24h', hours: 24 },
  { label: '7 days', value: '7d', hours: 168 },
  { label: '30 days', value: '30d', hours: 720 },
  { label: '90 days', value: '90d', hours: 2160 },
] as const;

export const DURATION_PRESETS = [
  { label: '0-2 min', value: '0-120', from: 0, to: 120 },
  { label: '2-10 min', value: '120-600', from: 120, to: 600 },
  { label: '10-30 min', value: '600-1800', from: 600, to: 1800 },
  { label: '30-60 min', value: '1800-3600', from: 1800, to: 3600 },
  { label: '> 1 hour', value: '3600-', from: 3600, to: undefined },
] as const;

export const JOB_TYPE_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'orchestrationContainer', label: 'Flow' },
  { value: 'phaseContainer', label: 'Phase' },
  { value: 'container', label: 'Container' },
] as const;

// Component type grouping labels for the component filter dropdown
export const COMPONENT_TYPE_LABELS: Record<string, string> = {
  extractor: 'Data Sources',
  writer: 'Data Destinations',
  transformation: 'Transformations',
  application: 'Applications',
  other: 'Other',
};

// Status color mapping for pill-style toggle buttons (Tailwind classes)
export const STATUS_PILL_COLORS: Record<string, { active: string; inactive: string }> = {
  processing: {
    active: 'bg-blue-100 text-blue-700 ring-1 ring-blue-300',
    inactive: 'bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600',
  },
  success: {
    active: 'bg-green-100 text-green-700 ring-1 ring-green-300',
    inactive: 'bg-gray-50 text-gray-500 hover:bg-green-50 hover:text-green-600',
  },
  error: {
    active: 'bg-red-100 text-red-700 ring-1 ring-red-300',
    inactive: 'bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600',
  },
  warning: {
    active: 'bg-orange-100 text-orange-700 ring-1 ring-orange-300',
    inactive: 'bg-gray-50 text-gray-500 hover:bg-orange-50 hover:text-orange-600',
  },
  waiting: {
    active: 'bg-gray-200 text-gray-700 ring-1 ring-gray-300',
    inactive: 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-600',
  },
  created: {
    active: 'bg-gray-200 text-gray-700 ring-1 ring-gray-300',
    inactive: 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-600',
  },
  terminated: {
    active: 'bg-gray-200 text-gray-700 ring-1 ring-gray-300',
    inactive: 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-600',
  },
  cancelled: {
    active: 'bg-gray-200 text-gray-700 ring-1 ring-gray-300',
    inactive: 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-600',
  },
};

// Default job list page size
export const JOBS_PAGE_SIZE = 100;

// Sortable columns and their corresponding API field names
export const SORTABLE_COLUMNS = {
  createdTime: 'createdTime',
  durationSeconds: 'durationSeconds',
} as const;

export type SortableColumn = keyof typeof SORTABLE_COLUMNS;
