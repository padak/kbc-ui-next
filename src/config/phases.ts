// file: src/config/phases.ts
// Configuration constants for job phase detection and display.
// Defines phase names, labels, colors, and event patterns used for detection.
// Used by: lib/jobPhases.ts, components/PhaseTimeline.tsx.
// All phase-related constants live here — never hardcode elsewhere.

export const PHASE_NAMES = ['preparation', 'input', 'execution', 'output', 'termination'] as const;

export type PhaseName = (typeof PHASE_NAMES)[number];

export const PHASE_CONFIG: Record<PhaseName, { label: string; bgClass: string; textClass: string }> = {
  preparation: { label: 'Preparation', bgClass: 'bg-neutral-300', textClass: 'text-neutral-700' },
  input: { label: 'Input', bgClass: 'bg-blue-400', textClass: 'text-blue-900' },
  execution: { label: 'Execution', bgClass: 'bg-green-500', textClass: 'text-green-900' },
  output: { label: 'Output', bgClass: 'bg-orange-400', textClass: 'text-orange-900' },
  termination: { label: 'Termination', bgClass: 'bg-neutral-300', textClass: 'text-neutral-700' },
} as const;

/** Minimum percentage width for a phase segment to be visible in the bar */
export const PHASE_MIN_PERCENT = 2;

/** Event.event values used for phase boundary detection */
export const PHASE_EVENTS = {
  WORKSPACE_CREATED: 'storage.workspaceCreated',
  WORKSPACE_TABLE_CLONED: 'storage.workspaceTableCloned',
  TABLE_IMPORT_STARTED: 'storage.tableImportStarted',
  TABLE_IMPORT_DONE: 'storage.tableImportDone',
  WORKSPACE_DELETED: 'storage.workspaceDeleted',
  EXT_PREFIX: 'ext.',
} as const;

/** Event.message substrings used for phase boundary detection */
export const PHASE_MESSAGES = {
  ALL_TABLES_FETCHED: 'All tables were fetched',
  RUNNING_QUERY: 'Running query',
  LOADING_TABLE: 'Loading table',
  OUTPUT_MAPPING_DONE: 'Output mapping done',
} as const;

/** Job statuses that indicate a completed job (phases can be fully computed) */
export const COMPLETED_JOB_STATUSES = new Set([
  'success',
  'error',
  'warning',
  'terminated',
]);
