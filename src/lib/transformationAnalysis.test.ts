// file: src/lib/transformationAnalysis.test.ts
// Unit tests for transformation event analysis: phase detection, SQL parsing, duration inference.
// Tests small/large transformations and non-transformation jobs.
// Run with: npm test
// Pure logic tests - no DOM or React needed.

import { describe, it, expect } from 'vitest';
import { analyzeTransformation, stripTablePrefix } from './transformationAnalysis';
import type { KeboolaEvent } from '@/api/events';
import type { Job } from '@/api/schemas';

// -- Helpers --

function makeEvent(overrides: Partial<KeboolaEvent> & { created: string }): KeboolaEvent {
  const { created, ...rest } = overrides;
  return {
    event: '',
    component: '',
    type: 'info',
    message: '',
    description: '',
    created,
    params: {},
    results: {},
    ...rest,
  };
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: '123',
    runId: '123',
    parentRunId: null,
    status: 'success',
    component: 'keboola.snowflake-transformation',
    config: '456',
    configRowIds: [],
    mode: 'run',
    createdTime: '2026-03-20T10:00:00Z',
    startTime: '2026-03-20T10:00:02Z',
    endTime: '2026-03-20T10:05:00Z',
    durationSeconds: 298,
    result: {},
    token: { id: '1', description: 'test-token' },
    project: { id: '789' },
    ...overrides,
  };
}

// Events are returned newest-first from API
function reverseChronological(events: KeboolaEvent[]): KeboolaEvent[] {
  return [...events].reverse();
}

// -- Non-transformation job --

describe('analyzeTransformation', () => {
  it('returns isTransformation: false for non-transformation jobs', () => {
    const job = makeJob({ component: 'keboola.ex-db-mysql' });
    const events = reverseChronological([
      makeEvent({
        created: '2026-03-20T10:00:05Z',
        event: 'ext.db.mysql.extraction',
        message: 'Extracting data',
      }),
    ]);

    const result = analyzeTransformation(job, events);
    expect(result.isTransformation).toBe(false);
    expect(result.setup).toBeNull();
    expect(result.input).toBeNull();
    expect(result.sql).toBeNull();
    expect(result.output).toBeNull();
    expect(result.cleanup).toBeNull();
  });

  // -- Small transformation (1 block, 3 queries, 1 output table) --

  it('parses a small transformation correctly', () => {
    const job = makeJob();
    const events = reverseChronological([
      // Setup: workspace created
      makeEvent({
        created: '2026-03-20T10:00:07Z',
        event: 'storage.workspaceCreated',
        message: 'Workspace ws-123 created',
      }),
      // Input: 2 tables cloned
      makeEvent({
        created: '2026-03-20T10:00:10Z',
        event: 'storage.workspaceTableCloned',
        message: 'Cloned table "in.c-sfdc.user" into workspace ws-123 as "user"',
        performance: { exportDuration: 2.1 },
      }),
      makeEvent({
        created: '2026-03-20T10:00:15Z',
        event: 'storage.workspaceTableCloned',
        message: 'Cloned table "in.c-sfdc.account" into workspace ws-123 as "account"',
        performance: { exportDuration: 3.5 },
      }),
      makeEvent({
        created: '2026-03-20T10:00:20Z',
        event: '',
        message: 'All tables were fetched from Storage',
      }),
      // SQL: 1 block with 3 queries
      makeEvent({
        created: '2026-03-20T10:00:25Z',
        event: '',
        message: 'Processing block "Phase 1".\nProcessing code "Company Report".',
      }),
      makeEvent({
        created: '2026-03-20T10:00:30Z',
        event: '',
        message: 'Running query #1: ALTER SESSION SET QUERY_TAG = \'block:1\'',
      }),
      makeEvent({
        created: '2026-03-20T10:00:31Z',
        event: '',
        message: 'Running query #2: CREATE TABLE "out_company" AS SELECT id, name FROM user JOIN account ON user.account_id = account.id',
      }),
      makeEvent({
        created: '2026-03-20T10:00:39Z',
        event: '',
        message: 'Running query #3: INSERT INTO "out_company" SELECT id, name FROM account WHERE active = true',
      }),
      makeEvent({
        created: '2026-03-20T10:00:42Z',
        event: '',
        message: 'Running query #4: DELETE FROM "out_company" WHERE id IS NULL',
      }),
      // Output
      makeEvent({
        created: '2026-03-20T10:00:50Z',
        event: '',
        message: 'Loading table out.c-sfdc.company',
      }),
      makeEvent({
        created: '2026-03-20T10:01:05Z',
        event: 'storage.tableImportDone',
        message: 'Imported table "out.c-sfdc.company"',
        results: { rowsCount: 4200, sizeBytes: 512000 },
        performance: { importDuration: 15 },
      }),
      makeEvent({
        created: '2026-03-20T10:01:10Z',
        event: '',
        message: 'Output mapping done.',
      }),
    ]);

    const result = analyzeTransformation(job, events);

    // Overall
    expect(result.isTransformation).toBe(true);
    expect(result.totalDurationMs).toBe(298000);

    // Setup
    expect(result.setup).not.toBeNull();
    expect(result.setup!.durationMs).toBe(7000); // 10:00:00 -> 10:00:07

    // Input
    expect(result.input).not.toBeNull();
    expect(result.input!.tables.length).toBe(2);
    expect(result.input!.cloneCount).toBe(2);
    expect(result.input!.copyCount).toBe(0);
    expect(result.input!.tables[0]!.name).toBe('user');
    expect(result.input!.tables[0]!.source).toBe('in.c-sfdc.user');
    expect(result.input!.tables[0]!.method).toBe('clone');
    expect(result.input!.tables[0]!.durationSeconds).toBe(2.1);
    expect(result.input!.tables[1]!.name).toBe('account');
    // Duration: 10:00:10 -> 10:00:20 = 10s
    expect(result.input!.durationMs).toBe(10000);

    // SQL
    expect(result.sql).not.toBeNull();
    expect(result.sql!.blocks.length).toBe(1);
    expect(result.sql!.totalQueries).toBe(3); // ALTER SESSION is skipped
    expect(result.sql!.blocks[0]!.name).toBe('Phase 1 / Company Report');
    expect(result.sql!.blocks[0]!.queries[0]!.tableName).toBe('out_company');
    expect(result.sql!.blocks[0]!.queries[0]!.sql).toContain('CREATE TABLE');
    expect(result.sql!.blocks[0]!.queries[1]!.tableName).toBe('out_company');
    expect(result.sql!.blocks[0]!.queries[2]!.tableName).toBe('out_company');

    // Query duration inference
    // Query 1 (CREATE): 10:00:31 -> 10:00:39 = 8s = 8000ms
    expect(result.sql!.blocks[0]!.queries[0]!.durationMs).toBe(8000);
    // Query 2 (INSERT): 10:00:39 -> 10:00:42 = 3s = 3000ms
    expect(result.sql!.blocks[0]!.queries[1]!.durationMs).toBe(3000);

    // Output
    expect(result.output).not.toBeNull();
    expect(result.output!.tables.length).toBe(1);
    expect(result.output!.tables[0]!.name).toBe('out.c-sfdc.company');
    expect(result.output!.tables[0]!.rowsCount).toBe(4200);
    expect(result.output!.tables[0]!.sizeBytes).toBe(512000);
    expect(result.output!.tables[0]!.durationSeconds).toBe(15);

    // Cleanup
    expect(result.cleanup).not.toBeNull();
    expect(result.cleanup!.startTime).toBe('2026-03-20T10:01:10Z');
    expect(result.cleanup!.endTime).toBe('2026-03-20T10:05:00Z');
  });

  // -- Large transformation (multiple blocks) --

  it('parses multiple SQL blocks correctly', () => {
    const job = makeJob({
      createdTime: '2026-03-20T10:00:00Z',
      startTime: '2026-03-20T10:00:02Z',
      endTime: '2026-03-20T10:10:00Z',
      durationSeconds: 598,
    });

    const events = reverseChronological([
      makeEvent({
        created: '2026-03-20T10:00:07Z',
        event: 'storage.workspaceCreated',
        message: 'Workspace created',
      }),
      makeEvent({
        created: '2026-03-20T10:00:10Z',
        event: 'storage.workspaceTableCloned',
        message: 'Cloned table "in.c-main.data" into workspace ws-1 as "data"',
        performance: { exportDuration: 1.0 },
      }),
      makeEvent({
        created: '2026-03-20T10:00:15Z',
        event: '',
        message: 'All tables were fetched',
      }),
      // Block 1
      makeEvent({
        created: '2026-03-20T10:01:00Z',
        event: '',
        message: 'Processing block "Phase 1".\nProcessing code "Staging".',
      }),
      makeEvent({
        created: '2026-03-20T10:01:05Z',
        event: '',
        message: 'Running query #1: CREATE TABLE "stg_data" AS SELECT * FROM data',
      }),
      makeEvent({
        created: '2026-03-20T10:01:15Z',
        event: '',
        message: 'Running query #2: INSERT INTO "stg_data" VALUES (1)',
      }),
      // Block 2
      makeEvent({
        created: '2026-03-20T10:02:00Z',
        event: '',
        message: 'Processing block "Phase 2".\nProcessing code "Aggregation".',
      }),
      makeEvent({
        created: '2026-03-20T10:02:05Z',
        event: '',
        message: 'Running query #1: CREATE TABLE "agg_data" AS SELECT count(*) FROM stg_data GROUP BY id',
      }),
      makeEvent({
        created: '2026-03-20T10:03:00Z',
        event: '',
        message: 'Running query #2: CREATE TABLE "final_output" AS SELECT * FROM agg_data WHERE cnt > 0',
      }),
      // Output
      makeEvent({
        created: '2026-03-20T10:04:00Z',
        event: '',
        message: 'Loading table out.c-main.output',
      }),
      makeEvent({
        created: '2026-03-20T10:04:30Z',
        event: 'storage.tableImportDone',
        message: 'Imported table "out.c-main.output"',
        results: { rowsCount: 10000, sizeBytes: 2048000 },
        performance: { importDuration: 25 },
      }),
      makeEvent({
        created: '2026-03-20T10:04:35Z',
        event: 'storage.tableImportDone',
        message: 'Imported table "out.c-main.agg"',
        results: { rowsCount: 500, sizeBytes: 51200 },
        performance: { importDuration: 3 },
      }),
      makeEvent({
        created: '2026-03-20T10:04:40Z',
        event: '',
        message: 'Output mapping done.',
      }),
    ]);

    const result = analyzeTransformation(job, events);

    expect(result.isTransformation).toBe(true);

    // 2 blocks
    expect(result.sql!.blocks.length).toBe(2);
    expect(result.sql!.blocks[0]!.name).toBe('Phase 1 / Staging');
    expect(result.sql!.blocks[0]!.queries.length).toBe(2);
    expect(result.sql!.blocks[1]!.name).toBe('Phase 2 / Aggregation');
    expect(result.sql!.blocks[1]!.queries.length).toBe(2);

    // Total queries
    expect(result.sql!.totalQueries).toBe(4);

    // Output: 2 tables
    expect(result.output!.tables.length).toBe(2);
    expect(result.output!.tables[0]!.name).toBe('out.c-main.output');
    expect(result.output!.tables[1]!.name).toBe('out.c-main.agg');
  });

  // -- SQL table name extraction --

  it('extracts table names from various SQL statements', () => {
    const job = makeJob();
    const events = reverseChronological([
      makeEvent({
        created: '2026-03-20T10:00:07Z',
        event: 'storage.workspaceCreated',
        message: 'Workspace created',
      }),
      makeEvent({
        created: '2026-03-20T10:00:10Z',
        event: '',
        message: 'All tables were fetched',
      }),
      makeEvent({
        created: '2026-03-20T10:00:20Z',
        event: '',
        message: 'Processing block "Phase 1".\nProcessing code "Test".',
      }),
      // CREATE TABLE
      makeEvent({
        created: '2026-03-20T10:00:25Z',
        event: '',
        message: 'Running query: CREATE TABLE "my_table" AS SELECT 1',
      }),
      // INSERT INTO
      makeEvent({
        created: '2026-03-20T10:00:30Z',
        event: '',
        message: 'Running query: INSERT INTO my_table SELECT 2',
      }),
      // DELETE FROM
      makeEvent({
        created: '2026-03-20T10:00:35Z',
        event: '',
        message: 'Running query: DELETE FROM "cleanup_table" WHERE 1=1',
      }),
      // UPDATE
      makeEvent({
        created: '2026-03-20T10:00:40Z',
        event: '',
        message: 'Running query: UPDATE "stats_table" SET count = 0',
      }),
      // DROP TABLE
      makeEvent({
        created: '2026-03-20T10:00:45Z',
        event: '',
        message: 'Running query: DROP TABLE IF EXISTS "tmp_table"',
      }),
      // Some final event
      makeEvent({
        created: '2026-03-20T10:00:50Z',
        event: '',
        message: 'Output mapping done.',
      }),
    ]);

    const result = analyzeTransformation(job, events);
    const queries = result.sql!.blocks[0]!.queries;

    expect(queries[0]!.tableName).toBe('my_table');
    expect(queries[1]!.tableName).toBe('my_table');
    expect(queries[2]!.tableName).toBe('cleanup_table');
    expect(queries[3]!.tableName).toBe('stats_table');
    expect(queries[4]!.tableName).toBe('tmp_table');
  });

  // -- Infrastructure SQL is skipped --

  it('skips infrastructure SQL queries', () => {
    const job = makeJob();
    const events = reverseChronological([
      makeEvent({
        created: '2026-03-20T10:00:07Z',
        event: 'storage.workspaceCreated',
        message: 'Workspace created',
      }),
      makeEvent({
        created: '2026-03-20T10:00:20Z',
        event: '',
        message: 'Processing block "Phase 1".\nProcessing code "Init".',
      }),
      makeEvent({
        created: '2026-03-20T10:00:25Z',
        event: '',
        message: 'Running query: ALTER SESSION SET QUERY_TAG = \'test\'',
      }),
      makeEvent({
        created: '2026-03-20T10:00:26Z',
        event: '',
        message: 'Running query: SET (KBC_RUNID, KBC_PROJECTID) = (\'123\', \'456\')',
      }),
      makeEvent({
        created: '2026-03-20T10:00:30Z',
        event: '',
        message: 'Running query: CREATE TABLE "real_table" AS SELECT 1',
      }),
      makeEvent({
        created: '2026-03-20T10:00:40Z',
        event: '',
        message: 'Output mapping done.',
      }),
    ]);

    const result = analyzeTransformation(job, events);
    // Only the real query should be present
    expect(result.sql!.totalQueries).toBe(1);
    expect(result.sql!.blocks[0]!.queries[0]!.tableName).toBe('real_table');
  });

  // -- Copy vs clone detection --

  it('detects copy and clone methods', () => {
    const job = makeJob();
    const events = reverseChronological([
      makeEvent({
        created: '2026-03-20T10:00:07Z',
        event: 'storage.workspaceCreated',
        message: 'Workspace created',
      }),
      makeEvent({
        created: '2026-03-20T10:00:10Z',
        event: 'storage.workspaceTableCloned',
        message: 'Cloned table "in.c-main.users" into workspace ws-1 as "users"',
        performance: { exportDuration: 1.5 },
      }),
      makeEvent({
        created: '2026-03-20T10:00:15Z',
        event: 'storage.workspaceTableLoaded',
        message: 'Loaded table "in.c-other.data" into workspace ws-1 as "data"',
        performance: { exportDuration: 5.0 },
      }),
      makeEvent({
        created: '2026-03-20T10:00:20Z',
        event: '',
        message: 'All tables were fetched',
      }),
    ]);

    const result = analyzeTransformation(job, events);
    expect(result.input!.cloneCount).toBe(1);
    expect(result.input!.copyCount).toBe(1);
    expect(result.input!.tables[0]!.method).toBe('clone');
    expect(result.input!.tables[0]!.durationSeconds).toBe(1.5);
    expect(result.input!.tables[1]!.method).toBe('copy');
    expect(result.input!.tables[1]!.durationSeconds).toBe(5.0);
  });

  // -- Events are reversed from newest-first --

  it('handles newest-first events (API order)', () => {
    const job = makeJob();
    // These are already in newest-first order (API order)
    const events = [
      makeEvent({
        created: '2026-03-20T10:00:20Z',
        event: '',
        message: 'Output mapping done.',
      }),
      makeEvent({
        created: '2026-03-20T10:00:15Z',
        event: '',
        message: 'Running query: CREATE TABLE "test" AS SELECT 1',
      }),
      makeEvent({
        created: '2026-03-20T10:00:10Z',
        event: '',
        message: 'Processing block "Phase 1".\nProcessing code "Test".',
      }),
      makeEvent({
        created: '2026-03-20T10:00:07Z',
        event: 'storage.workspaceCreated',
        message: 'Workspace created',
      }),
    ];

    const result = analyzeTransformation(job, events);
    expect(result.isTransformation).toBe(true);
    expect(result.sql!.blocks.length).toBe(1);
    expect(result.sql!.blocks[0]!.queries[0]!.tableName).toBe('test');
  });

  // -- Duration inference for queries --

  it('infers query durations from timestamp gaps', () => {
    const job = makeJob();
    const events = reverseChronological([
      makeEvent({
        created: '2026-03-20T10:00:07Z',
        event: 'storage.workspaceCreated',
        message: 'Workspace created',
      }),
      makeEvent({
        created: '2026-03-20T10:00:20Z',
        event: '',
        message: 'Processing block "Phase 1".\nProcessing code "Test".',
      }),
      makeEvent({
        created: '2026-03-20T10:00:25Z',
        event: '',
        message: 'Running query: CREATE TABLE "t1" AS SELECT 1',
      }),
      makeEvent({
        created: '2026-03-20T10:00:33Z',
        event: '',
        message: 'Running query: INSERT INTO "t1" SELECT 2',
      }),
      makeEvent({
        created: '2026-03-20T10:00:36Z',
        event: '',
        message: 'Running query: DELETE FROM "t1" WHERE id = 0',
      }),
      // Non-query event marks end of block
      makeEvent({
        created: '2026-03-20T10:00:40Z',
        event: '',
        message: 'Output mapping done.',
      }),
    ]);

    const result = analyzeTransformation(job, events);
    const queries = result.sql!.blocks[0]!.queries;

    // Query 1: 10:00:25 -> 10:00:33 = 8000ms
    expect(queries[0]!.durationMs).toBe(8000);
    // Query 2: 10:00:33 -> 10:00:36 = 3000ms
    expect(queries[1]!.durationMs).toBe(3000);
    // Query 3: 10:00:36 -> 10:00:40 = 4000ms (last query to block end)
    expect(queries[2]!.durationMs).toBe(4000);
  });

  // -- Block parsing from messages --

  it('parses block and code names from Processing messages', () => {
    const job = makeJob();
    const events = reverseChronological([
      makeEvent({
        created: '2026-03-20T10:00:07Z',
        event: 'storage.workspaceCreated',
        message: 'Workspace created',
      }),
      makeEvent({
        created: '2026-03-20T10:00:20Z',
        event: '',
        message: 'Processing block "Phase 1".\nProcessing code "Company, Entities & Employees".',
      }),
      makeEvent({
        created: '2026-03-20T10:00:25Z',
        event: '',
        message: 'Running query: SELECT 1',
      }),
      makeEvent({
        created: '2026-03-20T10:00:30Z',
        event: '',
        message: 'Processing block "Phase 2".\nProcessing code "Contacts & Leads".',
      }),
      makeEvent({
        created: '2026-03-20T10:00:35Z',
        event: '',
        message: 'Running query: SELECT 2',
      }),
      makeEvent({
        created: '2026-03-20T10:00:40Z',
        event: '',
        message: 'Output mapping done.',
      }),
    ]);

    const result = analyzeTransformation(job, events);
    expect(result.sql!.blocks[0]!.name).toBe('Phase 1 / Company, Entities & Employees');
    expect(result.sql!.blocks[1]!.name).toBe('Phase 2 / Contacts & Leads');
  });

  // -- Output table parsing with string rowsCount/sizeBytes --

  it('parses output tables with string numeric values', () => {
    const job = makeJob();
    const events = reverseChronological([
      makeEvent({
        created: '2026-03-20T10:00:07Z',
        event: 'storage.workspaceCreated',
        message: 'Workspace created',
      }),
      makeEvent({
        created: '2026-03-20T10:00:30Z',
        event: 'storage.tableImportDone',
        message: 'Imported table "out.c-main.result"',
        results: { rowsCount: '1500', sizeBytes: '256000' },
        performance: { importDuration: 8 },
      }),
      makeEvent({
        created: '2026-03-20T10:00:35Z',
        event: '',
        message: 'Output mapping done.',
      }),
    ]);

    const result = analyzeTransformation(job, events);
    expect(result.output!.tables[0]!.rowsCount).toBe(1500);
    expect(result.output!.tables[0]!.sizeBytes).toBe(256000);
  });

  // -- Empty transformation (workspace created but no tables or queries) --

  it('handles transformation with workspace but no input/sql/output', () => {
    const job = makeJob();
    const events = reverseChronological([
      makeEvent({
        created: '2026-03-20T10:00:07Z',
        event: 'storage.workspaceCreated',
        message: 'Workspace created',
      }),
    ]);

    const result = analyzeTransformation(job, events);
    expect(result.isTransformation).toBe(true);
    expect(result.setup).not.toBeNull();
    expect(result.input).toBeNull();
    expect(result.sql).toBeNull();
    expect(result.output).toBeNull();
    expect(result.cleanup).not.toBeNull();
  });
});

// -- stripTablePrefix --

describe('stripTablePrefix', () => {
  it('strips multi-segment prefixes', () => {
    expect(stripTablePrefix('in.c-kds-team-ex-salesforce-v2-723966296.user')).toBe('user');
    expect(stripTablePrefix('out.c-sfdc.company')).toBe('company');
  });

  it('preserves short names', () => {
    expect(stripTablePrefix('user')).toBe('user');
    expect(stripTablePrefix('in.user')).toBe('in.user');
  });
});
