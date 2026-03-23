// file: src/lib/jobPhases.ts
// Detects job execution phases from events for timeline visualization.
// Parses event boundaries for preparation, input, execution, output, termination.
// Used by: components/PhaseTimeline.tsx.
// Events arrive newest-first from API — reversed before processing.

import type { Job } from '@/api/schemas';
import type { KeboolaEvent } from '@/api/events';
import type { PhaseName } from '@/config/phases';
import { PHASE_CONFIG, PHASE_EVENTS, PHASE_MESSAGES } from '@/config/phases';

export type TableMetric = {
  name: string;
  rowsCount?: number;
  sizeBytes?: number;
  durationSeconds?: number;
};

export type JobPhase = {
  name: PhaseName;
  label: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  bgClass: string;
  tables?: TableMetric[];
};

/** Summary metrics aggregated across all phases */
export type PhaseMetrics = {
  totalTables: number;
  totalRows: number;
  totalBytes: number;
};

// -- Helpers --

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

function durationMs(start: string, end: string): number {
  return Math.max(0, toMs(end) - toMs(start));
}

function makePhase(name: PhaseName, startTime: string, endTime: string, tables?: TableMetric[]): JobPhase {
  const config = PHASE_CONFIG[name];
  return {
    name,
    label: config.label,
    startTime,
    endTime,
    durationMs: durationMs(startTime, endTime),
    bgClass: config.bgClass,
    ...(tables && tables.length > 0 ? { tables } : {}),
  };
}

function hasMessage(event: KeboolaEvent, substring: string): boolean {
  return event.message.includes(substring);
}

function extractTableMetrics(events: KeboolaEvent[]): TableMetric[] {
  return events
    .filter((e) => e.event === PHASE_EVENTS.TABLE_IMPORT_DONE)
    .map((e) => ({
      name: (e.params?.tableId as string) ?? (e.results?.tableId as string) ?? '',
      rowsCount: (e.results?.rowsCount as number) ?? undefined,
      sizeBytes: (e.results?.sizeBytes as number) ?? undefined,
      durationSeconds: (e.performance?.importDuration as number) ?? undefined,
    }))
    .filter((t) => t.name !== '');
}

/**
 * Determines if a job is a transformation (uses workspaces).
 * Transformation jobs have storage.workspaceCreated events.
 */
function isTransformationJob(events: KeboolaEvent[]): boolean {
  return events.some((e) => e.event === PHASE_EVENTS.WORKSPACE_CREATED);
}

// -- Phase detection for extractors (no workspace events) --

function detectExtractorPhases(job: Job, events: KeboolaEvent[]): JobPhase[] {
  const phases: JobPhase[] = [];
  const jobCreated = job.createdTime;
  // startTime = when the container actually started running (after queue wait + boot)
  const jobStart = job.startTime ?? job.createdTime;
  const jobEnd = job.endTime ?? job.startTime ?? job.createdTime;

  // Find key boundaries from events
  const firstImportStarted = events.find((e) => e.event === PHASE_EVENTS.TABLE_IMPORT_STARTED);
  const outputMappingDone = events.find((e) => hasMessage(e, PHASE_MESSAGES.OUTPUT_MAPPING_DONE));
  const importDoneEvents = events.filter((e) => e.event === PHASE_EVENTS.TABLE_IMPORT_DONE);
  const lastImportDone = importDoneEvents.length > 0 ? importDoneEvents[importDoneEvents.length - 1] : undefined;

  // Preparation: createdTime -> startTime (queue wait + container boot)
  if (toMs(jobStart) > toMs(jobCreated)) {
    phases.push(makePhase('preparation', jobCreated, jobStart));
  }

  // Execution: startTime -> first tableImportStarted (component doing its work: API calls, data extraction)
  const execEnd = firstImportStarted?.created ?? outputMappingDone?.created ?? jobEnd;
  if (toMs(execEnd) > toMs(jobStart)) {
    phases.push(makePhase('execution', jobStart, execEnd));
  }

  // Output: first tableImportStarted -> last tableImportDone
  if (firstImportStarted && lastImportDone) {
    const tableMetrics = extractTableMetrics(events);
    phases.push(makePhase('output', firstImportStarted.created, lastImportDone.created, tableMetrics));
  }

  // Termination: after last output event -> jobEnd
  const termStart = lastImportDone?.created ?? outputMappingDone?.created ?? execEnd;
  if (toMs(jobEnd) > toMs(termStart)) {
    phases.push(makePhase('termination', termStart, jobEnd));
  }

  return phases;
}

// -- Phase detection for transformations (has workspace events) --

function detectTransformationPhases(job: Job, events: KeboolaEvent[]): JobPhase[] {
  const phases: JobPhase[] = [];
  const jobCreated = job.createdTime;
  const jobStart = job.startTime ?? job.createdTime;
  const jobEnd = job.endTime ?? job.startTime ?? job.createdTime;

  // Find key boundaries
  const cloneEvents = events.filter((e) => e.event === PHASE_EVENTS.WORKSPACE_TABLE_CLONED);
  const firstClone = cloneEvents.length > 0 ? cloneEvents[0] : undefined;
  const lastClone = cloneEvents.length > 0 ? cloneEvents[cloneEvents.length - 1] : undefined;
  const allTablesFetched = events.find((e) => hasMessage(e, PHASE_MESSAGES.ALL_TABLES_FETCHED));
  const runningQueryEvents = events.filter((e) => hasMessage(e, PHASE_MESSAGES.RUNNING_QUERY));
  const firstRunningQuery = runningQueryEvents.length > 0 ? runningQueryEvents[0] : undefined;
  const lastRunningQuery = runningQueryEvents.length > 0 ? runningQueryEvents[runningQueryEvents.length - 1] : undefined;
  const loadingTableEvent = events.find((e) => hasMessage(e, PHASE_MESSAGES.LOADING_TABLE));
  const firstImportStarted = events.find((e) => e.event === PHASE_EVENTS.TABLE_IMPORT_STARTED);
  const importDoneEvents = events.filter((e) => e.event === PHASE_EVENTS.TABLE_IMPORT_DONE);
  const lastImportDone = importDoneEvents.length > 0 ? importDoneEvents[importDoneEvents.length - 1] : undefined;

  // Preparation: createdTime -> startTime (queue wait + container boot + workspace creation)
  if (toMs(jobStart) > toMs(jobCreated)) {
    phases.push(makePhase('preparation', jobCreated, jobStart));
  }

  // Input: startTime (or first clone) -> "All tables were fetched" (or last clone)
  const inputStart = firstClone?.created ?? jobStart;
  const inputEnd = allTablesFetched?.created ?? lastClone?.created ?? inputStart;
  if (toMs(inputEnd) > toMs(inputStart)) {
    phases.push(makePhase('input', inputStart, inputEnd));
  }

  // Execution: first "Running query" -> first "Loading table" or first tableImportStarted
  const execStart = firstRunningQuery?.created ?? inputEnd;
  const execEnd = loadingTableEvent?.created ?? firstImportStarted?.created ?? lastRunningQuery?.created ?? execStart;
  if (toMs(execEnd) > toMs(execStart)) {
    phases.push(makePhase('execution', execStart, execEnd));
  }

  // Output: first tableImportStarted -> last tableImportDone
  if (firstImportStarted && lastImportDone) {
    const tableMetrics = extractTableMetrics(events);
    phases.push(makePhase('output', firstImportStarted.created, lastImportDone.created, tableMetrics));
  }

  // Termination: after last output -> jobEnd
  const termStart = lastImportDone?.created ?? execEnd;
  if (toMs(jobEnd) > toMs(termStart)) {
    phases.push(makePhase('termination', termStart, jobEnd));
  }

  return phases;
}

// -- Fallback: no events --

function detectFallbackPhases(job: Job): JobPhase[] {
  const phases: JobPhase[] = [];
  const jobCreated = job.createdTime;
  const jobStart = job.startTime ?? job.createdTime;
  const jobEnd = job.endTime ?? job.startTime ?? job.createdTime;

  if (toMs(jobStart) > toMs(jobCreated)) {
    phases.push(makePhase('preparation', jobCreated, jobStart));
  }

  if (toMs(jobEnd) > toMs(jobStart)) {
    phases.push(makePhase('execution', jobStart, jobEnd));
  }

  return phases;
}

// -- Public API --

/**
 * Detect job execution phases from job metadata and events.
 * Events are expected in API order (newest-first) and will be reversed internally.
 * Returns empty array for jobs that are still running.
 */
export function detectJobPhases(job: Job, events: KeboolaEvent[]): JobPhase[] {
  // No phases for still-running jobs
  if (!job.endTime) return [];

  // Reverse events to chronological order (API returns newest-first)
  const chronological = [...events].reverse();

  if (chronological.length === 0) {
    return detectFallbackPhases(job);
  }

  if (isTransformationJob(chronological)) {
    return detectTransformationPhases(job, chronological);
  }

  return detectExtractorPhases(job, chronological);
}

/**
 * Compute aggregate metrics from detected phases.
 */
export function computePhaseMetrics(phases: JobPhase[]): PhaseMetrics {
  const allTables = phases.flatMap((p) => p.tables ?? []);
  return {
    totalTables: allTables.length,
    totalRows: allTables.reduce((sum, t) => sum + (t.rowsCount ?? 0), 0),
    totalBytes: allTables.reduce((sum, t) => sum + (t.sizeBytes ?? 0), 0),
  };
}
