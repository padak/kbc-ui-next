// file: src/lib/jobPhases.test.ts
// Unit tests for job phase detection algorithm.
// Tests extractor, transformation, fallback, and edge-case scenarios.
// Run with: npm test
// Pure function tests — no DOM or React needed.

import { describe, it, expect } from 'vitest';
import { detectJobPhases, computePhaseMetrics } from './jobPhases';
import type { Job } from '@/api/schemas';
import type { KeboolaEvent } from '@/api/events';

// -- Test helpers --

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: '123',
    runId: '123',
    parentRunId: null,
    status: 'success',
    component: 'keboola.ex-db-snowflake',
    config: '456',
    configRowIds: [],
    mode: 'run',
    createdTime: '2024-01-01T10:00:00Z',
    startTime: '2024-01-01T10:00:05Z',
    endTime: '2024-01-01T10:05:00Z',
    durationSeconds: 295,
    result: {},
    token: { id: 'tok-1', description: 'test-token' },
    project: { id: 'proj-1' },
    ...overrides,
  };
}

function makeEvent(overrides: Partial<KeboolaEvent> = {}): KeboolaEvent {
  return {
    id: String(Math.random()),
    event: '',
    component: '',
    type: 'info',
    message: '',
    description: '',
    created: '2024-01-01T10:00:10Z',
    params: {},
    results: {},
    ...overrides,
  };
}

// -- Extractor job tests --

describe('detectJobPhases — extractor job', () => {
  it('detects preparation, execution, output, and termination phases', () => {
    // Events in newest-first order (as API returns them)
    const events: KeboolaEvent[] = [
      makeEvent({ event: 'storage.tableImportDone', created: '2024-01-01T10:04:30Z', params: { tableId: 'out.c-bucket.orders' }, results: { rowsCount: 1000, sizeBytes: 50000 }, performance: { importDuration: 5 } }),
      makeEvent({ event: 'storage.tableImportStarted', created: '2024-01-01T10:04:00Z' }),
      makeEvent({ event: 'ext.keboola.ex-db-snowflake.fetchData', created: '2024-01-01T10:01:00Z', message: 'Fetching data' }),
      makeEvent({ event: 'ext.keboola.ex-db-snowflake.start', created: '2024-01-01T10:00:10Z', message: 'Component started' }),
    ];

    const job = makeJob();
    const phases = detectJobPhases(job, events);

    expect(phases.length).toBeGreaterThanOrEqual(3);

    const names = phases.map((p) => p.name);
    expect(names).toContain('preparation');
    expect(names).toContain('execution');
    expect(names).toContain('output');

    // Output phase should have table metrics
    const outputPhase = phases.find((p) => p.name === 'output');
    expect(outputPhase).toBeDefined();
    expect(outputPhase!.tables).toHaveLength(1);
    expect(outputPhase!.tables![0]!.name).toBe('out.c-bucket.orders');
    expect(outputPhase!.tables![0]!.rowsCount).toBe(1000);
    expect(outputPhase!.tables![0]!.sizeBytes).toBe(50000);
  });

  it('handles extractor with no output mapping events', () => {
    const events: KeboolaEvent[] = [
      makeEvent({ event: 'ext.keboola.ex-http.done', created: '2024-01-01T10:03:00Z', message: 'Output mapping done' }),
      makeEvent({ event: 'ext.keboola.ex-http.start', created: '2024-01-01T10:00:10Z', message: 'Component started' }),
    ];

    const job = makeJob({ endTime: '2024-01-01T10:03:30Z' });
    const phases = detectJobPhases(job, events);

    expect(phases.length).toBeGreaterThanOrEqual(2);
    const names = phases.map((p) => p.name);
    expect(names).toContain('preparation');
    expect(names).toContain('execution');
  });
});

// -- Transformation job tests --

describe('detectJobPhases — transformation job', () => {
  it('detects all 5 phases for a transformation', () => {
    const events: KeboolaEvent[] = [
      // newest-first
      makeEvent({ event: 'storage.workspaceDeleted', created: '2024-01-01T10:04:55Z' }),
      makeEvent({ event: 'storage.tableImportDone', created: '2024-01-01T10:04:30Z', params: { tableId: 'out.c-results.agg' }, results: { rowsCount: 500, sizeBytes: 25000 }, performance: { importDuration: 3 } }),
      makeEvent({ event: 'storage.tableImportStarted', created: '2024-01-01T10:04:00Z' }),
      makeEvent({ event: '', created: '2024-01-01T10:03:30Z', message: 'Running query #2' }),
      makeEvent({ event: '', created: '2024-01-01T10:02:30Z', message: 'Running query #1' }),
      makeEvent({ event: '', created: '2024-01-01T10:02:00Z', message: 'All tables were fetched' }),
      makeEvent({ event: 'storage.workspaceTableCloned', created: '2024-01-01T10:01:30Z' }),
      makeEvent({ event: 'storage.workspaceTableCloned', created: '2024-01-01T10:01:00Z' }),
      makeEvent({ event: 'storage.workspaceCreated', created: '2024-01-01T10:00:30Z' }),
    ];

    const job = makeJob({ component: 'keboola.snowflake-transformation' });
    const phases = detectJobPhases(job, events);

    const names = phases.map((p) => p.name);
    expect(names).toContain('preparation');
    expect(names).toContain('input');
    expect(names).toContain('execution');
    expect(names).toContain('output');
    expect(names).toContain('termination');

    // Check ordering
    for (let i = 1; i < phases.length; i++) {
      expect(new Date(phases[i]!.startTime).getTime()).toBeGreaterThanOrEqual(
        new Date(phases[i - 1]!.startTime).getTime(),
      );
    }

    // Output should have table metrics
    const outputPhase = phases.find((p) => p.name === 'output');
    expect(outputPhase).toBeDefined();
    expect(outputPhase!.tables).toHaveLength(1);
    expect(outputPhase!.tables![0]!.rowsCount).toBe(500);
  });

  it('detects transformation without clone events (no input mapping)', () => {
    const events: KeboolaEvent[] = [
      makeEvent({ event: 'storage.tableImportDone', created: '2024-01-01T10:04:30Z', params: { tableId: 'out.c-results.agg' }, results: { rowsCount: 100, sizeBytes: 5000 } }),
      makeEvent({ event: 'storage.tableImportStarted', created: '2024-01-01T10:04:00Z' }),
      makeEvent({ event: '', created: '2024-01-01T10:02:30Z', message: 'Running query #1' }),
      makeEvent({ event: 'storage.workspaceCreated', created: '2024-01-01T10:00:30Z' }),
    ];

    const job = makeJob({ component: 'keboola.snowflake-transformation' });
    const phases = detectJobPhases(job, events);

    const names = phases.map((p) => p.name);
    expect(names).toContain('preparation');
    // No input phase because there are no clone events
    expect(names).toContain('execution');
    expect(names).toContain('output');
  });
});

// -- Fallback tests --

describe('detectJobPhases — fallback (no events)', () => {
  it('returns preparation + execution from job timestamps', () => {
    const job = makeJob();
    const phases = detectJobPhases(job, []);

    expect(phases.length).toBe(2);
    expect(phases[0]!.name).toBe('preparation');
    expect(phases[1]!.name).toBe('execution');

    expect(phases[0]!.startTime).toBe(job.createdTime);
    expect(phases[0]!.endTime).toBe(job.startTime);
    expect(phases[1]!.startTime).toBe(job.startTime);
    expect(phases[1]!.endTime).toBe(job.endTime);
  });

  it('returns single execution phase when createdTime equals startTime', () => {
    const job = makeJob({
      createdTime: '2024-01-01T10:00:00Z',
      startTime: '2024-01-01T10:00:00Z',
      endTime: '2024-01-01T10:05:00Z',
    });
    const phases = detectJobPhases(job, []);

    expect(phases.length).toBe(1);
    expect(phases[0]!.name).toBe('execution');
  });
});

// -- Edge cases --

describe('detectJobPhases — edge cases', () => {
  it('returns empty array for still-processing jobs', () => {
    const job = makeJob({ status: 'processing', endTime: null });
    const phases = detectJobPhases(job, []);
    expect(phases).toEqual([]);
  });

  it('returns empty array for waiting jobs', () => {
    const job = makeJob({ status: 'waiting', endTime: null, startTime: null });
    const phases = detectJobPhases(job, []);
    expect(phases).toEqual([]);
  });

  it('handles events with same timestamp', () => {
    const sameTime = '2024-01-01T10:01:00Z';
    const events: KeboolaEvent[] = [
      makeEvent({ event: 'storage.tableImportDone', created: sameTime, params: { tableId: 'out.c-test.t1' }, results: { rowsCount: 10 } }),
      makeEvent({ event: 'storage.tableImportStarted', created: sameTime }),
      makeEvent({ event: 'ext.keboola.ex-test.start', created: sameTime }),
    ];

    const job = makeJob();
    const phases = detectJobPhases(job, events);

    // Should not crash and should produce at least some phases
    expect(phases.length).toBeGreaterThanOrEqual(1);
    // All durations should be >= 0
    phases.forEach((p) => {
      expect(p.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  it('handles single event', () => {
    const events: KeboolaEvent[] = [
      makeEvent({ event: 'ext.keboola.ex-test.start', created: '2024-01-01T10:00:10Z' }),
    ];

    const job = makeJob();
    const phases = detectJobPhases(job, events);
    expect(phases.length).toBeGreaterThanOrEqual(1);
  });
});

// -- Metrics tests --

describe('computePhaseMetrics', () => {
  it('aggregates table metrics across phases', () => {
    const phases = detectJobPhases(
      makeJob(),
      [
        // newest-first
        makeEvent({ event: 'storage.tableImportDone', created: '2024-01-01T10:04:30Z', params: { tableId: 'out.c-bucket.t2' }, results: { rowsCount: 200, sizeBytes: 10000 } }),
        makeEvent({ event: 'storage.tableImportDone', created: '2024-01-01T10:04:15Z', params: { tableId: 'out.c-bucket.t1' }, results: { rowsCount: 100, sizeBytes: 5000 } }),
        makeEvent({ event: 'storage.tableImportStarted', created: '2024-01-01T10:04:00Z' }),
        makeEvent({ event: 'ext.keboola.ex-test.start', created: '2024-01-01T10:00:10Z' }),
      ],
    );

    const metrics = computePhaseMetrics(phases);
    expect(metrics.totalTables).toBe(2);
    expect(metrics.totalRows).toBe(300);
    expect(metrics.totalBytes).toBe(15000);
  });

  it('returns zeros when no tables', () => {
    const metrics = computePhaseMetrics([]);
    expect(metrics.totalTables).toBe(0);
    expect(metrics.totalRows).toBe(0);
    expect(metrics.totalBytes).toBe(0);
  });
});
