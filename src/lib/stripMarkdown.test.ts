// file: lib/stripMarkdown.test.ts
// Unit tests for Markdown stripping utility.
// Tests all supported markdown constructs and edge cases.
// Run with: npm test
// Pure function tests — no DOM or React needed.

import { describe, it, expect } from 'vitest';
import { stripMarkdown } from './stripMarkdown';

describe('stripMarkdown', () => {
  it('returns empty string for empty input', () => {
    expect(stripMarkdown('')).toBe('');
  });

  it('returns empty string for null/undefined', () => {
    expect(stripMarkdown(null as unknown as string)).toBe('');
    expect(stripMarkdown(undefined as unknown as string)).toBe('');
  });

  it('passes through plain text unchanged', () => {
    expect(stripMarkdown('Hello world')).toBe('Hello world');
  });

  it('strips headings', () => {
    expect(stripMarkdown('# Heading 1')).toBe('Heading 1');
    expect(stripMarkdown('## Heading 2')).toBe('Heading 2');
    expect(stripMarkdown('### Heading 3')).toBe('Heading 3');
  });

  it('strips bold', () => {
    expect(stripMarkdown('This is **bold** text')).toBe('This is bold text');
    expect(stripMarkdown('This is __bold__ text')).toBe('This is bold text');
  });

  it('strips italic', () => {
    expect(stripMarkdown('This is *italic* text')).toBe('This is italic text');
    expect(stripMarkdown('This is _italic_ text')).toBe('This is italic text');
  });

  it('strips links — keeps text, drops URL', () => {
    expect(stripMarkdown('Visit [Google](https://google.com) now')).toBe('Visit Google now');
  });

  it('strips images — keeps alt text', () => {
    expect(stripMarkdown('![Alt text](image.png)')).toBe('Alt text');
  });

  it('strips inline code', () => {
    expect(stripMarkdown('Use `console.log` here')).toBe('Use console.log here');
  });

  it('strips code blocks entirely', () => {
    expect(stripMarkdown('Before\n```js\nconst x = 1;\n```\nAfter')).toBe('Before After');
  });

  it('strips mermaid blocks', () => {
    expect(stripMarkdown('Intro\n```mermaid\ngraph TD\n  A-->B\n```\nEnd')).toBe('Intro End');
  });

  it('strips blockquotes', () => {
    expect(stripMarkdown('> This is a quote')).toBe('This is a quote');
  });

  it('strips list markers', () => {
    expect(stripMarkdown('- item one\n- item two')).toBe('item one item two');
    expect(stripMarkdown('1. first\n2. second')).toBe('first second');
  });

  it('strips strikethrough', () => {
    expect(stripMarkdown('This is ~~deleted~~ text')).toBe('This is deleted text');
  });

  it('strips horizontal rules', () => {
    expect(stripMarkdown('Above\n---\nBelow')).toBe('Above Below');
  });

  it('handles complex markdown', () => {
    const md = `# Pipeline Docs
This config uses **Snowflake** to load data.

- Step 1: Extract from [API](https://api.example.com)
- Step 2: Transform with \`SQL\`

\`\`\`mermaid
graph TD
  A-->B
\`\`\`

> Note: runs daily`;

    const result = stripMarkdown(md);
    expect(result).toContain('Pipeline Docs');
    expect(result).toContain('Snowflake');
    expect(result).toContain('API');
    expect(result).toContain('SQL');
    expect(result).not.toContain('**');
    expect(result).not.toContain('```');
    expect(result).not.toContain('[');
    expect(result).not.toContain('>');
  });
});
