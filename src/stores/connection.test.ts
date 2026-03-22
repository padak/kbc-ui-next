// file: stores/connection.test.ts
// Unit tests for Zustand multi-project connection store.
// Tests connect, disconnect, multi-project operations, and localStorage persistence.
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
    // Reset store state to clean defaults
    useConnectionStore.setState({
      projects: [],
      activeProjectId: null,
      isLoading: false,
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
    expect(state.projects).toEqual([]);
    expect(state.activeProjectId).toBeNull();
  });

  it('connects via legacy connect and persists to localStorage', () => {
    const { connect } = useConnectionStore.getState();
    connect('https://connection.keboola.com', 'test-token', 'Test Project', 'test@example.com');

    const state = useConnectionStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.stackUrl).toBe('https://connection.keboola.com');
    expect(state.token).toBe('test-token');
    expect(state.projectName).toBe('Test Project');
    expect(state.projects).toHaveLength(1);
    expect(state.activeProjectId).toBe('manual');
    // Security (H2): tokens stored only in kbc_projects, no redundant legacy keys
    expect(localStorage.getItem('kbc_projects')).toBeTruthy();
    expect(localStorage.getItem('kbc_stack_url')).toBeNull();
    expect(localStorage.getItem('kbc_storage_token')).toBeNull();
  });

  it('disconnects and clears localStorage', () => {
    const { connect, disconnect } = useConnectionStore.getState();
    connect('https://connection.keboola.com', 'test-token', 'Test', 'test');
    disconnect();

    const state = useConnectionStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.stackUrl).toBe('');
    expect(state.projects).toEqual([]);
    expect(state.activeProjectId).toBeNull();
    expect(localStorage.getItem('kbc_stack_url')).toBeNull();
    expect(localStorage.getItem('kbc_projects')).toBeNull();
  });

  it('sets multiple projects and activates the first one', () => {
    const projects = [
      {
        id: '100',
        stackUrl: 'https://connection.keboola.com',
        token: 'token-a',
        projectId: 100,
        projectName: 'Project A',
        organizationId: '1',
        organizationName: 'Org A',
        tokenDescription: 'Token A',
      },
      {
        id: '200',
        stackUrl: 'https://connection.north-europe.azure.keboola.com',
        token: 'token-b',
        projectId: 200,
        projectName: 'Project B',
        organizationId: '2',
        organizationName: 'Org B',
        tokenDescription: 'Token B',
      },
    ];

    useConnectionStore.getState().setProjects(projects);

    const state = useConnectionStore.getState();
    expect(state.projects).toHaveLength(2);
    expect(state.activeProjectId).toBe('100');
    expect(state.stackUrl).toBe('https://connection.keboola.com');
    expect(state.token).toBe('token-a');
    expect(state.projectName).toBe('Project A');
    expect(state.isConnected).toBe(true);
  });

  it('switches active project', () => {
    const projects = [
      {
        id: '100',
        stackUrl: 'https://connection.keboola.com',
        token: 'token-a',
        projectId: 100,
        projectName: 'Project A',
        organizationId: '1',
        organizationName: 'Org A',
        tokenDescription: 'Token A',
      },
      {
        id: '200',
        stackUrl: 'https://connection.north-europe.azure.keboola.com',
        token: 'token-b',
        projectId: 200,
        projectName: 'Project B',
        organizationId: '2',
        organizationName: 'Org B',
        tokenDescription: 'Token B',
      },
    ];

    useConnectionStore.getState().setProjects(projects);
    useConnectionStore.getState().setActiveProject('200');

    const state = useConnectionStore.getState();
    expect(state.activeProjectId).toBe('200');
    expect(state.stackUrl).toBe('https://connection.north-europe.azure.keboola.com');
    expect(state.token).toBe('token-b');
    expect(state.projectName).toBe('Project B');
    expect(state.isConnected).toBe(true);
  });

  it('API client compatibility - getState returns stackUrl and token from active project', () => {
    const projects = [
      {
        id: '100',
        stackUrl: 'https://connection.keboola.com',
        token: 'token-a',
        projectId: 100,
        projectName: 'Project A',
        organizationId: '1',
        organizationName: 'Org A',
        tokenDescription: 'Token A',
      },
    ];

    useConnectionStore.getState().setProjects(projects);

    // This is what api/client.ts does
    const { stackUrl, token } = useConnectionStore.getState();
    expect(stackUrl).toBe('https://connection.keboola.com');
    expect(token).toBe('token-a');
  });

  it('handles setLoading correctly', () => {
    useConnectionStore.getState().setLoading(true);
    expect(useConnectionStore.getState().isLoading).toBe(true);

    useConnectionStore.getState().setLoading(false);
    expect(useConnectionStore.getState().isLoading).toBe(false);
  });
});
