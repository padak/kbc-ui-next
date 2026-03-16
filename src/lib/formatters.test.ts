// file: lib/formatters.test.ts
// Unit tests for date, number, and byte formatting utilities.
// Tests null handling, edge cases, and typical values.
// Run with: npm test
// These are pure function tests - no DOM or React needed.

import { describe, it, expect } from 'vitest';
import { formatBytes, formatNumber } from './formatters';

describe('formatBytes', () => {
  it('returns 0 B for zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('returns 0 B for null', () => {
    expect(formatBytes(null as any)).toBe('0 B');
  });

  it('returns 0 B for undefined', () => {
    expect(formatBytes(undefined as any)).toBe('0 B');
  });

  it('formats bytes correctly', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });

  it('formats partial values', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1500)).toBe('1.5 KB');
  });
});

describe('formatNumber', () => {
  it('returns 0 for null', () => {
    expect(formatNumber(null as any)).toBe('0');
  });

  it('returns 0 for undefined', () => {
    expect(formatNumber(undefined as any)).toBe('0');
  });

  it('formats with commas', () => {
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1000000)).toBe('1,000,000');
  });

  it('handles small numbers', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(42)).toBe('42');
  });
});
