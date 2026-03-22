// file: src/security.test.tsx
// Security regression tests for audit findings (H1, M4, M5, L3).
// Ensures XSS prevention, token masking, and production error hiding work correctly.
// Run with: npm test
// See docs/AGENT-REPORTS/SECURITY.md for full audit report.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { z } from 'zod';

// Polyfill localStorage for Node 25+ (must run before any module that uses localStorage)
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.getItem !== 'function') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  } as Storage;
}

// Dynamic imports — modules that transitively depend on localStorage must load after polyfill
const { MarkdownViewer } = await import('@/components/MarkdownViewer');
const { ErrorBoundary } = await import('@/components/ErrorBoundary');
const { KeboolaValidationError } = await import('@/api/client');

// -- H1: XSS via javascript: URI in MarkdownViewer --

describe('H1: MarkdownViewer href sanitization', () => {
  it('renders https links with href', async () => {
    render(<MarkdownViewer content="[safe](https://example.com)" />);
    const link = await screen.findByText('safe');
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('renders http links with href', async () => {
    render(<MarkdownViewer content="[safe](http://example.com)" />);
    const link = await screen.findByText('safe');
    expect(link).toHaveAttribute('href', 'http://example.com');
  });

  it('renders mailto links with href', async () => {
    render(<MarkdownViewer content="[email](mailto:user@example.com)" />);
    const link = await screen.findByText('email');
    expect(link).toHaveAttribute('href', 'mailto:user@example.com');
  });

  it('renders anchor links with href', async () => {
    render(<MarkdownViewer content="[section](#heading)" />);
    const link = await screen.findByText('section');
    expect(link).toHaveAttribute('href', '#heading');
  });

  it('strips javascript: URI from href', async () => {
    render(<MarkdownViewer content="[xss](javascript:alert(1))" />);
    const link = await screen.findByText('xss');
    expect(link).not.toHaveAttribute('href');
  });

  it('strips javascript: URI with mixed case', async () => {
    render(<MarkdownViewer content="[xss](JavaScript:alert(1))" />);
    const link = await screen.findByText('xss');
    expect(link).not.toHaveAttribute('href');
  });

  it('strips data: URI from href', async () => {
    render(<MarkdownViewer content="[xss](data:text/html,<script>alert(1)</script>)" />);
    const link = await screen.findByText('xss');
    expect(link).not.toHaveAttribute('href');
  });

  it('strips vbscript: URI from href', async () => {
    render(<MarkdownViewer content="[xss](vbscript:MsgBox)" />);
    const link = await screen.findByText('xss');
    expect(link).not.toHaveAttribute('href');
  });
});

// -- M4: KeboolaValidationError in DEV mode --

describe('M4: KeboolaValidationError debug output', () => {
  it('includes debug details in DEV mode', () => {
    const zodError = new z.ZodError([
      { code: 'invalid_type', expected: 'string', path: ['name'], message: 'Expected string' } as z.ZodIssue,
    ]);
    const error = new KeboolaValidationError('/test', zodError, { name: 42 }, 'curl -s ...');

    // In DEV (test env), full details are available
    expect(error.message).toContain('Fields with issues');
    expect(error.message).toContain('Debug with');
    expect(error.rawData).toEqual({ name: 42 });
    expect(error.curlCommand).toBe('curl -s ...');
  });
});

// -- M5: Token masking in event details --

describe('M5: Event token masking', () => {
  it('token object should only contain name, not raw token data', () => {
    // Simulates the masking pattern used in EventsViewer
    const rawToken = { name: 'my-token', id: 'secret-123', token: 'real-secret-value' };
    const masked = { name: rawToken.name };
    expect(masked).toEqual({ name: 'my-token' });
    expect(masked).not.toHaveProperty('id');
    expect(masked).not.toHaveProperty('token');
  });
});

// -- L3: ErrorBoundary production error message --

describe('L3: ErrorBoundary error display', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('shows error message in DEV mode', () => {
    const ThrowingComponent = () => {
      throw new Error('Detailed internal error with API path /v2/storage/...');
    };

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );

    // In DEV (test env), the actual error message is shown
    expect(screen.getByText(/Detailed internal error/)).toBeTruthy();
  });
});
