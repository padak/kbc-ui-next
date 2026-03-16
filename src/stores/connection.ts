// file: stores/connection.ts
// Zustand store for stack connection state (URL + token).
// Hydrates from localStorage SYNCHRONOUSLY at store creation time.
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
};

// Hydrate synchronously from localStorage at store creation
// This avoids race conditions with route guards checking isConnected
const initialStackUrl = localStorage.getItem(STORAGE_KEY.STACK_URL) ?? '';
const initialToken = localStorage.getItem(STORAGE_KEY.TOKEN) ?? '';

export const useConnectionStore = create<ConnectionState>((set) => ({
  stackUrl: initialStackUrl,
  token: initialToken,
  projectName: '',
  tokenDescription: '',
  isConnected: !!initialStackUrl && !!initialToken,

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
}));
