// file: stores/connection.ts
// Zustand store for multi-project connection state.
// Manages multiple Keboola projects with an active project selector.
// Used by: api/client.ts, hooks/useAuth.ts, ConnectPage.tsx, Sidebar.tsx.
// Backward compatible: exposes stackUrl, token, isConnected from active project.

import { create } from 'zustand';
import { STORAGE_KEY } from '@/lib/constants';

export type ProjectEntry = {
  id: string;
  stackUrl: string;
  token: string;
  projectId: number;
  projectName: string;
  tokenDescription: string;
};

type ConnectionState = {
  // Multi-project state
  projects: ProjectEntry[];
  activeProjectId: string | null;
  isLoading: boolean;

  // Derived from active project (for API client compatibility)
  stackUrl: string;
  token: string;
  projectName: string;
  tokenDescription: string;
  isConnected: boolean;

  // Actions
  setProjects: (projects: ProjectEntry[]) => void;
  setActiveProject: (id: string) => void;
  connect: (stackUrl: string, token: string, projectName: string, tokenDescription: string) => void;
  disconnect: () => void;
  setLoading: (loading: boolean) => void;
};

// Hydrate from localStorage: restore projects and active project
function hydrateProjects(): { projects: ProjectEntry[]; activeProjectId: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY.PROJECTS);
    if (raw) {
      const projects = JSON.parse(raw) as ProjectEntry[];
      const activeProjectId = localStorage.getItem(STORAGE_KEY.ACTIVE_PROJECT_ID);
      return { projects, activeProjectId };
    }
  } catch {
    // Corrupted data, ignore
  }

  // Legacy single-project fallback
  const stackUrl = localStorage.getItem(STORAGE_KEY.STACK_URL);
  const token = localStorage.getItem(STORAGE_KEY.TOKEN);
  if (stackUrl && token) {
    const legacyProject: ProjectEntry = {
      id: 'legacy',
      stackUrl,
      token,
      projectId: 0,
      projectName: '',
      tokenDescription: '',
    };
    return { projects: [legacyProject], activeProjectId: 'legacy' };
  }

  return { projects: [], activeProjectId: null };
}

function deriveActiveFields(projects: ProjectEntry[], activeProjectId: string | null) {
  const active = projects.find((p) => p.id === activeProjectId);
  if (!active) {
    return {
      stackUrl: '',
      token: '',
      projectName: '',
      tokenDescription: '',
      isConnected: false,
    };
  }
  return {
    stackUrl: active.stackUrl,
    token: active.token,
    projectName: active.projectName,
    tokenDescription: active.tokenDescription,
    isConnected: true,
  };
}

function persistProjects(projects: ProjectEntry[], activeProjectId: string | null) {
  if (projects.length > 0) {
    localStorage.setItem(STORAGE_KEY.PROJECTS, JSON.stringify(projects));
    if (activeProjectId) {
      localStorage.setItem(STORAGE_KEY.ACTIVE_PROJECT_ID, activeProjectId);
    }
  }
  // Also persist stackUrl and token for legacy API client compatibility
  const active = projects.find((p) => p.id === activeProjectId);
  if (active) {
    localStorage.setItem(STORAGE_KEY.STACK_URL, active.stackUrl);
    localStorage.setItem(STORAGE_KEY.TOKEN, active.token);
  }
}

const hydrated = hydrateProjects();
const initialDerived = deriveActiveFields(hydrated.projects, hydrated.activeProjectId);

export const useConnectionStore = create<ConnectionState>((set) => ({
  projects: hydrated.projects,
  activeProjectId: hydrated.activeProjectId,
  isLoading: false,
  ...initialDerived,

  setProjects: (projects) => {
    const activeProjectId = projects.length > 0 ? projects[0]!.id : null;
    const derived = deriveActiveFields(projects, activeProjectId);
    persistProjects(projects, activeProjectId);
    set({ projects, activeProjectId, ...derived });
  },

  setActiveProject: (id) => {
    set((state) => {
      const derived = deriveActiveFields(state.projects, id);
      persistProjects(state.projects, id);
      return { activeProjectId: id, ...derived };
    });
  },

  // Legacy single-project connect (for manual form)
  connect: (stackUrl, token, projectName, tokenDescription) => {
    const project: ProjectEntry = {
      id: 'manual',
      stackUrl,
      token,
      projectId: 0,
      projectName,
      tokenDescription,
    };
    persistProjects([project], 'manual');
    set({
      projects: [project],
      activeProjectId: 'manual',
      stackUrl,
      token,
      projectName,
      tokenDescription,
      isConnected: true,
    });
  },

  disconnect: () => {
    localStorage.removeItem(STORAGE_KEY.PROJECTS);
    localStorage.removeItem(STORAGE_KEY.ACTIVE_PROJECT_ID);
    localStorage.removeItem(STORAGE_KEY.STACK_URL);
    localStorage.removeItem(STORAGE_KEY.TOKEN);
    set({
      projects: [],
      activeProjectId: null,
      stackUrl: '',
      token: '',
      projectName: '',
      tokenDescription: '',
      isConnected: false,
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),
}));
