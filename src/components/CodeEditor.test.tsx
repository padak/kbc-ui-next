// file: components/CodeEditor.test.tsx
// Tests for CodeEditor component and extractCode helper function.
// Covers rendering, language display, read-only state, and code extraction.
// Run with: npm test
// Uses @testing-library/react for DOM assertions.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeEditor, extractCode } from './CodeEditor';

describe('CodeEditor', () => {
  it('renders with language label', () => {
    render(<CodeEditor value="SELECT 1" onChange={vi.fn()} language="sql" />);
    expect(screen.getByText('sql')).toBeInTheDocument();
  });

  it('renders textarea with provided value', () => {
    render(<CodeEditor value="SELECT * FROM users" onChange={vi.fn()} language="sql" />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('SELECT * FROM users');
  });

  it('shows Read-only label when readOnly is true', () => {
    render(<CodeEditor value="" onChange={vi.fn()} language="sql" readOnly />);
    expect(screen.getByText('Read-only')).toBeInTheDocument();
  });

  it('does not show Read-only label when readOnly is false', () => {
    render(<CodeEditor value="" onChange={vi.fn()} language="sql" />);
    expect(screen.queryByText('Read-only')).not.toBeInTheDocument();
  });

  it('calls onChange when user types', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<CodeEditor value="" onChange={onChange} language="python" />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'x');
    expect(onChange).toHaveBeenCalled();
  });

  it('displays python language label', () => {
    render(<CodeEditor value="" onChange={vi.fn()} language="python" />);
    expect(screen.getByText('python')).toBeInTheDocument();
  });

  it('has spellcheck disabled', () => {
    render(<CodeEditor value="" onChange={vi.fn()} language="text" />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.getAttribute('spellcheck')).toBe('false');
  });
});

describe('extractCode', () => {
  it('extracts from top-level queries array', () => {
    const config = {
      queries: ['SELECT 1', 'SELECT 2'],
    };
    expect(extractCode(config)).toBe('SELECT 1\n\nSELECT 2');
  });

  it('extracts from parameters.queries array', () => {
    const config = {
      parameters: {
        queries: ['CREATE TABLE foo', 'INSERT INTO foo SELECT 1'],
      },
    };
    expect(extractCode(config)).toBe('CREATE TABLE foo\n\nINSERT INTO foo SELECT 1');
  });

  it('extracts from Python blocks structure', () => {
    const config = {
      parameters: {
        blocks: [
          {
            codes: [
              { script: ['import pandas as pd', 'df = pd.read_csv("input.csv")'] },
            ],
          },
        ],
      },
    };
    expect(extractCode(config)).toBe('import pandas as pd\ndf = pd.read_csv("input.csv")');
  });

  it('extracts from multiple Python blocks', () => {
    const config = {
      parameters: {
        blocks: [
          { codes: [{ script: ['print("block 1")'] }] },
          { codes: [{ script: ['print("block 2")'] }] },
        ],
      },
    };
    const result = extractCode(config);
    expect(result).toContain('print("block 1")');
    expect(result).toContain('# --- Next Block ---');
    expect(result).toContain('print("block 2")');
  });

  it('handles string script (not array)', () => {
    const config = {
      parameters: {
        blocks: [
          { codes: [{ script: 'print("hello")' }] },
        ],
      },
    };
    expect(extractCode(config)).toBe('print("hello")');
  });

  it('returns fallback message when no code found', () => {
    const config = { parameters: {} };
    expect(extractCode(config)).toBe('// No code found in configuration');
  });

  it('returns fallback for empty config', () => {
    expect(extractCode({})).toBe('// No code found in configuration');
  });

  it('prefers top-level queries over parameters.queries', () => {
    const config = {
      queries: ['SELECT 1'],
      parameters: {
        queries: ['SELECT 2'],
      },
    };
    expect(extractCode(config)).toBe('SELECT 1');
  });

  it('ignores empty queries array', () => {
    const config = {
      queries: [],
      parameters: {
        queries: ['SELECT 2'],
      },
    };
    expect(extractCode(config)).toBe('SELECT 2');
  });
});
