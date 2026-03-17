// file: components/FlowEditor.test.tsx
// Tests for FlowEditor: phase/task manipulation helper functions.
// Tests pure logic functions exported from FlowEditor.
// Run with: npm test
// Uses vitest for assertions.

import { describe, it, expect, vi } from 'vitest';

// Mock the hooks module to avoid localStorage access from connection store at import time
vi.mock('@/hooks/useComponents', () => ({
  useComponents: () => ({ data: [], isLoading: false }),
}));

import { getPhases, getTasks, addPhase, removePhase, updatePhaseName, addTask, removeTask, toggleTask } from './FlowEditor';

const baseConfig = {
  phases: [
    { id: 1, name: 'Extract', dependsOn: [] },
    { id: 2, name: 'Transform', dependsOn: [1] },
  ],
  tasks: [
    { id: 10, name: 'Task 10', phase: 1, task: { componentId: 'keboola.ex-db-snowflake', configId: '100', mode: 'run' }, continueOnFailure: false, enabled: true },
    { id: 11, name: 'Task 11', phase: 2, task: { componentId: 'keboola.snowflake-transformation', configId: '200', mode: 'run' }, continueOnFailure: false, enabled: true },
  ],
};

describe('getPhases', () => {
  it('returns empty array for empty config', () => {
    expect(getPhases({})).toEqual([]);
  });

  it('returns phases from config', () => {
    const phases = getPhases(baseConfig);
    expect(phases).toHaveLength(2);
    expect(phases[0]!.name).toBe('Extract');
  });
});

describe('getTasks', () => {
  it('returns empty array for empty config', () => {
    expect(getTasks({})).toEqual([]);
  });

  it('returns tasks from config', () => {
    const tasks = getTasks(baseConfig);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]!.task.componentId).toBe('keboola.ex-db-snowflake');
  });
});

describe('addPhase', () => {
  it('adds a phase to empty config', () => {
    const result = addPhase({}, 'First Phase');
    const phases = getPhases(result);
    expect(phases).toHaveLength(1);
    expect(phases[0]!.name).toBe('First Phase');
    expect(phases[0]!.dependsOn).toEqual([]);
  });

  it('adds a phase that depends on the last existing phase', () => {
    const result = addPhase(baseConfig, 'Load');
    const phases = getPhases(result);
    expect(phases).toHaveLength(3);
    expect(phases[2]!.name).toBe('Load');
    expect(phases[2]!.dependsOn).toEqual([2]); // depends on last phase
  });

  it('generates a unique ID higher than existing IDs', () => {
    const result = addPhase(baseConfig, 'New');
    const phases = getPhases(result);
    const newPhase = phases[2]!;
    // All existing IDs: phases [1,2], tasks [10,11] => max is 11
    expect(newPhase.id).toBe(12);
  });
});

describe('removePhase', () => {
  it('removes a phase and its tasks', () => {
    const result = removePhase(baseConfig, 1);
    const phases = getPhases(result);
    const tasks = getTasks(result);
    expect(phases).toHaveLength(1);
    expect(phases[0]!.id).toBe(2);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.id).toBe(11);
  });

  it('removes dependsOn references to the deleted phase', () => {
    const result = removePhase(baseConfig, 1);
    const phases = getPhases(result);
    expect(phases[0]!.dependsOn).toEqual([]); // was [1], now cleaned
  });

  it('handles removing a phase with no tasks', () => {
    const config = {
      phases: [
        { id: 1, name: 'A', dependsOn: [] },
        { id: 2, name: 'B', dependsOn: [1] },
      ],
      tasks: [],
    };
    const result = removePhase(config, 2);
    expect(getPhases(result)).toHaveLength(1);
    expect(getTasks(result)).toHaveLength(0);
  });
});

describe('updatePhaseName', () => {
  it('updates the name of a phase', () => {
    const result = updatePhaseName(baseConfig, 1, 'Data Extraction');
    const phases = getPhases(result);
    expect(phases[0]!.name).toBe('Data Extraction');
    expect(phases[1]!.name).toBe('Transform'); // unchanged
  });
});

describe('addTask', () => {
  it('adds a task to a phase', () => {
    const result = addTask(baseConfig, 1, 'keboola.ex-google-drive', '300');
    const tasks = getTasks(result);
    expect(tasks).toHaveLength(3);
    const newTask = tasks[2]!;
    expect(newTask.phase).toBe(1);
    expect(newTask.task.componentId).toBe('keboola.ex-google-drive');
    expect(newTask.task.configId).toBe('300');
    expect(newTask.enabled).toBe(true);
  });

  it('generates a unique ID', () => {
    const result = addTask(baseConfig, 2, 'comp', 'cfg');
    const tasks = getTasks(result);
    const newTask = tasks[2]!;
    expect(newTask.id).toBe(12); // max existing is 11
  });
});

describe('removeTask', () => {
  it('removes a task by ID', () => {
    const result = removeTask(baseConfig, 10);
    const tasks = getTasks(result);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.id).toBe(11);
  });

  it('leaves phases intact when removing a task', () => {
    const result = removeTask(baseConfig, 10);
    expect(getPhases(result)).toHaveLength(2);
  });
});

describe('toggleTask', () => {
  it('disables an enabled task', () => {
    const result = toggleTask(baseConfig, 10);
    const tasks = getTasks(result);
    expect(tasks[0]!.enabled).toBe(false);
    expect(tasks[1]!.enabled).toBe(true); // unchanged
  });

  it('enables a disabled task', () => {
    const configWithDisabled = {
      ...baseConfig,
      tasks: baseConfig.tasks.map((t) => (t.id === 10 ? { ...t, enabled: false } : t)),
    };
    const result = toggleTask(configWithDisabled, 10);
    const tasks = getTasks(result);
    expect(tasks[0]!.enabled).toBe(true);
  });
});
