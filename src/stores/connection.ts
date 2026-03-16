// file: stores/connection.ts
// Zustand store for stack connection state (URL + token).
// Persists to localStorage so the user stays connected across reloads.
// Used by: api/client.ts, hooks/useAuth.ts, ConnectPage.tsx.
// This is the ONLY place connection credentials are stored.

import { create } from 'zustand';
import { STORAGE_KEY } from '@/lib/constants';

type ConnectionState = {
  stackUrl: string;
  token: string;
  projectName: string;
  tokenDescription: string;
  isConnected: boolean;
  connect: (stackUrl: string, token: string, projectName: string, tokenDescription: string) => void;
  disconnect: () => void;
  hydrate: () => void;
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  stackUrl: '',
  token: '',
  projectName: '',
  tokenDescription: '',
  isConnected: false,

  connect: (stackUrl, token, projectName, tokenDescription) => {
    localStorage.setItem(STORAGE_KEY.STACK_URL, stackUrl);
    localStorage.setItem(STORAGE_KEY.TOKEN, token);
    set({ stackUrl, token, projectName, tokenDescription, isConnected: true });
  },

  disconnect: () => {
    localStorage.removeItem(STORAGE_KEY.STACK_URL);
    localStorage.removeItem(STORAGE_KEY.TOKEN);
    set({ stackUrl: '', token: '', projectName: '', tokenDescription: '', isConnected: false });
  },

  hydrate: () => {
    const stackUrl = localStorage.getItem(STORAGE_KEY.STACK_URL) ?? '';
    const token = localStorage.getItem(STORAGE_KEY.TOKEN) ?? '';
    if (stackUrl && token) {
      set({ stackUrl, token, isConnected: true });
    }
  },
}));
