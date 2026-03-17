// file: lib/flowToMermaid.test.ts
// Tests for flow-to-Mermaid and flow-to-text conversion.
import { describe, it, expect } from 'vitest';
import { flowToMermaid, flowToText } from './flowToMermaid';

const SIMPLE_FLOW = {
  phases: [
    { id: 0, name: 'Extract', dependsOn: [] },
    { id: 1, name: 'Transform', dependsOn: [0] },
    { id: 2, name: 'Load', dependsOn: [1] },
  ],
  tasks: [
    { id: 10, phase: 0, name: 'T1', enabled: true, task: { componentId: 'keboola.ex-db-mysql', configId: '123', mode: 'run' } },
    { id: 11, phase: 0, name: 'T2', enabled: true, task: { componentId: 'keboola.ex-google-drive', configId: '456', mode: 'run' } },
    { id: 20, phase: 1, name: 'T3', enabled: true, task: { componentId: 'keboola.snowflake-transformation', configId: '789', mode: 'run' } },
    { id: 30, phase: 2, name: 'T4', enabled: false, task: { componentId: 'keboola.wr-db-snowflake', configId: '101', mode: 'run' } },
  ],
};

describe('flowToMermaid', () => {
  it('generates valid mermaid with edges from dependsOn', () => {
    const result = flowToMermaid(SIMPLE_FLOW);
    expect(result).toContain('graph TD');
    expect(result).toContain('phase_0 --> phase_1');
    expect(result).toContain('phase_1 --> phase_2');
    expect(result).toContain('Extract');
    expect(result).toContain('Transform');
  });

  it('uses component lookup for readable names', () => {
    const lookup = {
      getComponentName: (id: string) => id === 'keboola.ex-db-mysql' ? 'MySQL' : id,
      getConfigName: (_c: string, id: string) => id === '123' ? 'Sales DB' : id,
    };
    const result = flowToMermaid(SIMPLE_FLOW, lookup);
    expect(result).toContain('MySQL: Sales DB');
  });

  it('skips disabled tasks', () => {
    const result = flowToMermaid(SIMPLE_FLOW);
    // Phase 2 has only a disabled task
    expect(result).toContain('no tasks');
  });

  it('handles empty flow', () => {
    expect(flowToMermaid({ phases: [], tasks: [] })).toContain('No phases defined');
  });

  it('creates sequential edges when no dependsOn', () => {
    const flow = {
      phases: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      tasks: [],
    };
    const result = flowToMermaid(flow);
    expect(result).toContain('phase_a --> phase_b');
  });
});

describe('flowToText', () => {
  it('generates readable text summary', () => {
    const result = flowToText(SIMPLE_FLOW);
    expect(result).toContain('Phase 1: Extract');
    expect(result).toContain('Phase 2: Transform');
    expect(result).toContain('Phase 3: Load');
    expect(result).toContain('keboola.ex-db-mysql');
    expect(result).toContain('[DISABLED]');
  });

  it('uses lookup for names', () => {
    const lookup = {
      getComponentName: (id: string) => id === 'keboola.ex-db-mysql' ? 'MySQL' : id,
      getConfigName: (_c: string, id: string) => id === '123' ? 'Sales DB' : id,
    };
    const result = flowToText(SIMPLE_FLOW, lookup);
    expect(result).toContain('MySQL: Sales DB');
  });
});
