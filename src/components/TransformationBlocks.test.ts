// file: components/TransformationBlocks.test.ts
// Unit tests for extractBlocks and hasBlockStructure helpers.
// Tests the parsing of transformation configuration into phases/blocks.
// Covers: Snowflake blocks, Python blocks, flat queries fallback, empty config.

import { describe, it, expect } from 'vitest';
import { extractBlocks, hasBlockStructure, splitStatements, disableStatement, enableStatement, isStatementDisabled } from './TransformationBlocks';

describe('extractBlocks', () => {
  it('returns empty array for empty config', () => {
    expect(extractBlocks({})).toEqual([]);
  });

  it('returns empty array for config without blocks or queries', () => {
    expect(extractBlocks({ parameters: { foo: 'bar' } })).toEqual([]);
  });

  it('extracts phases and blocks from Snowflake-style blocks', () => {
    const config = {
      parameters: {
        blocks: [
          {
            name: 'Phase 1',
            codes: [
              { name: 'Create Tables', script: ['CREATE TABLE foo;', 'CREATE TABLE bar;'] },
              { name: 'Insert Data', script: ['INSERT INTO foo VALUES (1);'] },
            ],
          },
          {
            name: 'Phase 2',
            codes: [
              { name: 'Aggregation', script: ['SELECT count(*) FROM foo;'] },
            ],
          },
        ],
      },
    };

    const result = extractBlocks(config);
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe('Phase 1');
    expect(result[0]!.codes).toHaveLength(2);
    expect(result[0]!.codes[0]!.name).toBe('Create Tables');
    expect(result[0]!.codes[0]!.script).toBe('CREATE TABLE foo;\n\nCREATE TABLE bar;');
    expect(result[0]!.codes[1]!.name).toBe('Insert Data');
    expect(result[1]!.name).toBe('Phase 2');
    expect(result[1]!.codes).toHaveLength(1);
    expect(result[1]!.codes[0]!.name).toBe('Aggregation');
  });

  it('handles string script (not array)', () => {
    const config = {
      parameters: {
        blocks: [
          {
            name: 'Main',
            codes: [
              { name: 'Query', script: 'SELECT 1;' },
            ],
          },
        ],
      },
    };

    const result = extractBlocks(config);
    expect(result[0]!.codes[0]!.script).toBe('SELECT 1;');
  });

  it('falls back to top-level queries array', () => {
    const config = {
      queries: ['SELECT 1;', 'SELECT 2;'],
    };

    const result = extractBlocks(config);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Queries');
    expect(result[0]!.codes).toHaveLength(2);
    expect(result[0]!.codes[0]!.name).toBe('Query 1');
    expect(result[0]!.codes[0]!.script).toBe('SELECT 1;');
  });

  it('falls back to parameters.queries array', () => {
    const config = {
      parameters: {
        queries: ['SELECT 1;', 'SELECT 2;', 'SELECT 3;'],
      },
    };

    const result = extractBlocks(config);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Queries');
    expect(result[0]!.codes).toHaveLength(3);
  });

  it('handles unnamed phases and blocks', () => {
    const config = {
      parameters: {
        blocks: [
          {
            codes: [
              { script: ['SELECT 1;'] },
            ],
          },
        ],
      },
    };

    const result = extractBlocks(config);
    expect(result[0]!.name).toBe('Unnamed Phase');
    expect(result[0]!.codes[0]!.name).toBe('Unnamed Block');
  });

  it('handles empty codes array in phase', () => {
    const config = {
      parameters: {
        blocks: [
          { name: 'Empty Phase', codes: [] },
        ],
      },
    };

    const result = extractBlocks(config);
    expect(result).toHaveLength(1);
    expect(result[0]!.codes).toHaveLength(0);
  });
});

describe('hasBlockStructure', () => {
  it('returns false for empty config', () => {
    expect(hasBlockStructure({})).toBe(false);
  });

  it('returns true for config with blocks', () => {
    const config = {
      parameters: {
        blocks: [
          { name: 'P1', codes: [{ name: 'B1', script: ['SELECT 1;'] }] },
        ],
      },
    };
    expect(hasBlockStructure(config)).toBe(true);
  });

  it('returns true for config with top-level queries', () => {
    expect(hasBlockStructure({ queries: ['SELECT 1;'] })).toBe(true);
  });

  it('returns false for config with empty queries', () => {
    expect(hasBlockStructure({ queries: [] })).toBe(false);
  });
});

describe('splitStatements', () => {
  it('returns empty array for empty string', () => {
    expect(splitStatements('')).toEqual([]);
    expect(splitStatements('  ')).toEqual([]);
  });

  it('splits simple statements by semicolon', () => {
    expect(splitStatements('SELECT 1; SELECT 2;')).toEqual([
      'SELECT 1;',
      'SELECT 2;',
    ]);
  });

  it('handles multiline CREATE TABLE AS', () => {
    const sql = 'CREATE TABLE "out1" AS\nSELECT \'1\' as id;\nCREATE TABLE "out2" AS\nSELECT \'2\' as id;';
    const result = splitStatements(sql);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('CREATE TABLE "out1" AS\nSELECT \'1\' as id;');
    expect(result[1]).toBe('CREATE TABLE "out2" AS\nSELECT \'2\' as id;');
  });

  it('does not split on semicolons inside single quotes', () => {
    expect(splitStatements("SELECT 'a;b' as x;")).toEqual([
      "SELECT 'a;b' as x;",
    ]);
  });

  it('does not split on semicolons inside double quotes', () => {
    expect(splitStatements('SELECT "col;name" FROM t;')).toEqual([
      'SELECT "col;name" FROM t;',
    ]);
  });

  it('handles escaped single quotes', () => {
    expect(splitStatements("SELECT 'it''s' as x;")).toEqual([
      "SELECT 'it''s' as x;",
    ]);
  });

  it('ignores semicolons in line comments', () => {
    expect(splitStatements('-- comment;\nSELECT 1;')).toEqual([
      '-- comment;\nSELECT 1;',
    ]);
  });

  it('ignores semicolons in block comments', () => {
    expect(splitStatements('/* comment; */ SELECT 1;')).toEqual([
      '/* comment; */ SELECT 1;',
    ]);
  });

  it('handles statement without trailing semicolon', () => {
    expect(splitStatements('SELECT 1')).toEqual(['SELECT 1']);
  });

  it('handles real-world Keboola transformation code', () => {
    const sql = `CREATE TABLE "out1" AS
SELECT '1' as id;

CREATE TABLE "out3" AS
SELECT '3' as id;`;
    const result = splitStatements(sql);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('out1');
    expect(result[1]).toContain('out3');
  });
});

describe('disableStatement / enableStatement', () => {
  it('roundtrips a simple statement', () => {
    const stmt = 'SELECT 1 as id;';
    const disabled = disableStatement(stmt);
    expect(isStatementDisabled(disabled)).toBe(true);
    expect(enableStatement(disabled)).toBe(stmt);
  });

  it('roundtrips a multiline statement', () => {
    const stmt = 'CREATE TABLE "out1" AS\nSELECT \'1\' as id;';
    const disabled = disableStatement(stmt);
    expect(isStatementDisabled(disabled)).toBe(true);
    expect(enableStatement(disabled)).toBe(stmt);
  });

  it('disabled statement starts with marker', () => {
    const disabled = disableStatement('SELECT 1;');
    expect(disabled).toContain('[DISABLED BY KBC-UI]');
    expect(disabled).toContain('-- SELECT 1;');
  });

  it('non-disabled statement is not detected', () => {
    expect(isStatementDisabled('SELECT 1;')).toBe(false);
    expect(isStatementDisabled('-- regular comment')).toBe(false);
  });
});
