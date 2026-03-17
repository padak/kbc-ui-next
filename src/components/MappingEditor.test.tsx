// file: components/MappingEditor.test.tsx
// Tests for MappingEditor: input/output mapping extraction and mutation helpers.
// Tests pure logic functions exported from MappingEditor.
// Run with: npm test
// Uses vitest for assertions.

import { describe, it, expect, vi } from 'vitest';

// Mock the hooks module to avoid localStorage access from connection store at import time
vi.mock('@/hooks/useStorage', () => ({
  useTables: () => ({ data: [], isLoading: false }),
}));

import { getInputMappings, getOutputMappings, setInputMappings, setOutputMappings } from './MappingEditor';

describe('getInputMappings', () => {
  it('returns empty array when no storage key', () => {
    expect(getInputMappings({})).toEqual([]);
  });

  it('returns empty array when no input key', () => {
    expect(getInputMappings({ storage: {} })).toEqual([]);
  });

  it('returns empty array when no tables key', () => {
    expect(getInputMappings({ storage: { input: {} } })).toEqual([]);
  });

  it('extracts input table mappings', () => {
    const config = {
      storage: {
        input: {
          tables: [
            { source: 'in.c-data.sales', destination: 'sales' },
            { source: 'in.c-data.products', destination: 'products' },
          ],
        },
      },
    };
    const result = getInputMappings(config);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ source: 'in.c-data.sales', destination: 'sales' });
    expect(result[1]).toEqual({ source: 'in.c-data.products', destination: 'products' });
  });
});

describe('getOutputMappings', () => {
  it('returns empty array when no storage key', () => {
    expect(getOutputMappings({})).toEqual([]);
  });

  it('extracts output table mappings with incremental flag', () => {
    const config = {
      storage: {
        output: {
          tables: [
            { source: 'output', destination: 'out.c-results.aggregated', incremental: false },
            { source: 'summary', destination: 'out.c-results.summary', incremental: true },
          ],
        },
      },
    };
    const result = getOutputMappings(config);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ source: 'output', destination: 'out.c-results.aggregated', incremental: false });
    expect(result[1]).toEqual({ source: 'summary', destination: 'out.c-results.summary', incremental: true });
  });
});

describe('setInputMappings', () => {
  it('creates storage.input.tables from empty config', () => {
    const result = setInputMappings({}, [{ source: 'in.c-data.x', destination: 'x' }]);
    expect(result).toEqual({
      storage: {
        input: {
          tables: [{ source: 'in.c-data.x', destination: 'x' }],
        },
      },
    });
  });

  it('preserves existing config keys', () => {
    const config = {
      parameters: { foo: 'bar' },
      storage: {
        input: {
          tables: [{ source: 'old', destination: 'old' }],
        },
        output: {
          tables: [{ source: 'keep', destination: 'keep' }],
        },
      },
    };
    const result = setInputMappings(config, [{ source: 'new', destination: 'new' }]);
    expect((result as Record<string, unknown>).parameters).toEqual({ foo: 'bar' });
    const storage = result.storage as Record<string, Record<string, unknown>>;
    expect(storage.output).toEqual({ tables: [{ source: 'keep', destination: 'keep' }] });
    expect(storage.input).toEqual({ tables: [{ source: 'new', destination: 'new' }] });
  });

  it('replaces input tables entirely', () => {
    const config = {
      storage: {
        input: {
          tables: [{ source: 'a', destination: 'a' }, { source: 'b', destination: 'b' }],
        },
      },
    };
    const result = setInputMappings(config, []);
    const storage = result.storage as Record<string, Record<string, unknown>>;
    expect(storage.input!.tables).toEqual([]);
  });
});

describe('setOutputMappings', () => {
  it('creates storage.output.tables from empty config', () => {
    const result = setOutputMappings({}, [{ source: 'out', destination: 'out.c-x.y', incremental: true }]);
    expect(result).toEqual({
      storage: {
        output: {
          tables: [{ source: 'out', destination: 'out.c-x.y', incremental: true }],
        },
      },
    });
  });

  it('preserves existing input mappings when setting output', () => {
    const config = {
      storage: {
        input: { tables: [{ source: 'in.c-data.x', destination: 'x' }] },
        output: { tables: [] },
      },
    };
    const result = setOutputMappings(config, [{ source: 'y', destination: 'out.c-res.y' }]);
    const storage = result.storage as Record<string, Record<string, unknown>>;
    expect(storage.input!.tables).toEqual([{ source: 'in.c-data.x', destination: 'x' }]);
    expect(storage.output!.tables).toEqual([{ source: 'y', destination: 'out.c-res.y' }]);
  });
});
