// file: stores/connection.test.ts
// Unit tests for Zustand connection store.
// Tests connect, disconnect, and localStorage persistence.
// Run with: npm test
// Clears localStorage between tests for isolation.
// Uses dynamic import because the store reads localStorage at module scope,
// and we need the jsdom localStorage to be fully available first.

import { describe, it, expect, beforeEach } from 'vitest';

// Ensure jsdom localStorage is available before importing the store.
// Node 25+ has a built-in localStorage that lacks getItem/setItem,
// so we polyfill if needed before the store module evaluates.
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.getItem !== 'function') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  } as Storage;
}

const { useConnectionStore } = await import('./connection');

describe('connection store', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset store state
    useConnectionStore.setState({
      stackUrl: '',
      token: '',
      projectName: '',
      tokenDescription: '',
      isConnected: false,
    });
  });

  it('starts disconnected when localStorage is empty', () => {
    const state = useConnectionStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.stackUrl).toBe('');
    expect(state.token).toBe('');
  });

  it('connects and persists to localStorage', () => {
    const { connect } = useConnectionStore.getState();
    connect('https://connection.keboola.com', 'test-token', 'Test Project', 'test@example.com');

    const state = useConnectionStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.stackUrl).toBe('https://connection.keboola.com');
    expect(state.token).toBe('test-token');
    expect(state.projectName).toBe('Test Project');
    expect(localStorage.getItem('kbc_stack_url')).toBe('https://connection.keboola.com');
    expect(localStorage.getItem('kbc_storage_token')).toBe('test-token');
  });

  it('disconnects and clears localStorage', () => {
    const { connect, disconnect } = useConnectionStore.getState();
    connect('https://connection.keboola.com', 'test-token', 'Test', 'test');
    disconnect();

    const state = useConnectionStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.stackUrl).toBe('');
    expect(localStorage.getItem('kbc_stack_url')).toBeNull();
  });
});
