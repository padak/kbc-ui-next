// file: components/FlowBuilder.test.tsx
// Tests for FlowBuilder: phase/task parsing, edge generation, node estimation.
// Tests pure logic functions exported from FlowBuilder.
// Run with: npm test
// Uses vitest for assertions, does not render ReactFlow (requires canvas).

import { describe, it, expect } from 'vitest';
import { parseConfiguration, estimateNodeHeight } from './FlowBuilder';
import type { RawPhase, RawTask } from './FlowBuilder';

// Must match constants in FlowBuilder.tsx
const HEADER_HEIGHT = 36;
const TASK_HEIGHT = 48;
const TASK_GAP = 8;
const TASK_COLS = 3;
const PADDING = 16;
const EMPTY_HEIGHT = 40;

describe('estimateNodeHeight', () => {
  it('returns correct height for empty phase', () => {
    expect(estimateNodeHeight(0)).toBe(HEADER_HEIGHT + EMPTY_HEIGHT + PADDING);
  });

  it('returns correct height for 1 task', () => {
    // 1 task = 1 row, no gaps
    expect(estimateNodeHeight(1)).toBe(HEADER_HEIGHT + TASK_HEIGHT + PADDING);
  });

  it('returns correct height for 3 tasks', () => {
    // 3 tasks = 1 row (TASK_COLS=3), no gaps
    const rows = Math.ceil(3 / TASK_COLS);
    expect(estimateNodeHeight(3)).toBe(HEADER_HEIGHT + rows * TASK_HEIGHT + (rows - 1) * TASK_GAP + PADDING);
  });
});

describe('parseConfiguration', () => {
  it('returns empty arrays when no phases or tasks', () => {
    const result = parseConfiguration({});
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it('creates nodes from phases', () => {
    const config = {
      phases: [
        { id: 1, name: 'Step 1', dependsOn: [] },
        { id: 2, name: 'Step 2', dependsOn: [1] },
      ] satisfies RawPhase[],
      tasks: [] as RawTask[],
    };

    const result = parseConfiguration(config);
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]!.id).toBe('1');
    expect(result.nodes[0]!.data.name).toBe('Step 1');
    expect(result.nodes[1]!.id).toBe('2');
    expect(result.nodes[1]!.data.name).toBe('Step 2');
  });

  it('creates edges from dependsOn', () => {
    const config = {
      phases: [
        { id: 10, name: 'Extract', dependsOn: [] },
        { id: 20, name: 'Transform', dependsOn: [10] },
        { id: 30, name: 'Load', dependsOn: [20] },
      ] satisfies RawPhase[],
      tasks: [],
    };

    const result = parseConfiguration(config);
    expect(result.edges).toHaveLength(2);
    expect(result.edges[0]).toMatchObject({ source: '10', target: '20' });
    expect(result.edges[1]).toMatchObject({ source: '20', target: '30' });
  });

  it('creates sequential edges as fallback when no dependsOn', () => {
    const config = {
      phases: [
        { id: 1, name: 'A', dependsOn: [] },
        { id: 2, name: 'B', dependsOn: [] },
        { id: 3, name: 'C', dependsOn: [] },
      ] satisfies RawPhase[],
      tasks: [],
    };

    const result = parseConfiguration(config);
    expect(result.edges).toHaveLength(2);
    expect(result.edges[0]).toMatchObject({ source: '1', target: '2' });
    expect(result.edges[1]).toMatchObject({ source: '2', target: '3' });
  });

  it('assigns tasks to correct phases', () => {
    const config = {
      phases: [
        { id: 100, name: 'Extract', dependsOn: [] },
        { id: 200, name: 'Load', dependsOn: [100] },
      ] satisfies RawPhase[],
      tasks: [
        {
          id: 1,
          name: 'task-1',
          phase: 100,
          task: { componentId: 'keboola.ex-db-snowflake', configId: '123', mode: 'run' },
          continueOnFailure: false,
          enabled: true,
        },
        {
          id: 2,
          name: 'task-2',
          phase: 100,
          task: { componentId: 'keboola.ex-db-mysql', configId: '456', mode: 'run' },
          continueOnFailure: false,
          enabled: false,
        },
        {
          id: 3,
          name: 'task-3',
          phase: 200,
          task: { componentId: 'keboola.wr-db-snowflake', configId: '789', mode: 'run' },
          continueOnFailure: true,
          enabled: true,
        },
      ] satisfies RawTask[],
    };

    const result = parseConfiguration(config);
    expect(result.nodes[0]!.data.tasks).toHaveLength(2);
    expect(result.nodes[1]!.data.tasks).toHaveLength(1);

    // Check task details
    const extractTasks = result.nodes[0]!.data.tasks;
    expect(extractTasks[0]!.componentId).toBe('keboola.ex-db-snowflake');
    expect(extractTasks[0]!.enabled).toBe(true);
    expect(extractTasks[1]!.enabled).toBe(false);

    const loadTasks = result.nodes[1]!.data.tasks;
    expect(loadTasks[0]!.componentId).toBe('keboola.wr-db-snowflake');
  });

  it('uses componentLookup for name resolution', () => {
    const config = {
      phases: [{ id: 1, name: 'Step', dependsOn: [] }] satisfies RawPhase[],
      tasks: [
        {
          id: 10,
          name: 'task',
          phase: 1,
          task: { componentId: 'keboola.ex-db-snowflake', configId: '123', mode: 'run' },
          continueOnFailure: false,
          enabled: true,
        },
      ] satisfies RawTask[],
    };

    const lookup = {
      getComponentName: (id: string) => id === 'keboola.ex-db-snowflake' ? 'Snowflake Extractor' : id,
      getComponentIcon: (id: string) => id === 'keboola.ex-db-snowflake' ? 'https://icon.png' : null,
      getConfigName: (_componentId: string, configId: string) => configId === '123' ? 'My Config' : configId,
    };

    const result = parseConfiguration(config, lookup);
    const task = result.nodes[0]!.data.tasks[0]!;
    expect(task.componentName).toBe('Snowflake Extractor');
    expect(task.configName).toBe('My Config');
    expect(task.icon).toBe('https://icon.png');
  });

  it('falls back to IDs when no componentLookup', () => {
    const config = {
      phases: [{ id: 1, name: 'Step', dependsOn: [] }] satisfies RawPhase[],
      tasks: [
        {
          id: 10,
          name: 'task',
          phase: 1,
          task: { componentId: 'keboola.ex-db-snowflake', configId: '123', mode: 'run' },
          continueOnFailure: false,
          enabled: true,
        },
      ] satisfies RawTask[],
    };

    const result = parseConfiguration(config);
    const task = result.nodes[0]!.data.tasks[0]!;
    expect(task.componentName).toBe('keboola.ex-db-snowflake');
    expect(task.configName).toBe('123');
    expect(task.icon).toBeNull();
  });

  it('handles phases with multiple dependsOn', () => {
    const config = {
      phases: [
        { id: 1, name: 'A', dependsOn: [] },
        { id: 2, name: 'B', dependsOn: [] },
        { id: 3, name: 'C', dependsOn: [1, 2] },
      ] satisfies RawPhase[],
      tasks: [],
    };

    const result = parseConfiguration(config);
    expect(result.edges).toHaveLength(2);
    expect(result.edges[0]).toMatchObject({ source: '1', target: '3' });
    expect(result.edges[1]).toMatchObject({ source: '2', target: '3' });
  });

  it('sets node type to phaseNode', () => {
    const config = {
      phases: [{ id: 1, name: 'Step', dependsOn: [] }] satisfies RawPhase[],
      tasks: [],
    };

    const result = parseConfiguration(config);
    expect(result.nodes[0]!.type).toBe('phaseNode');
  });
});
