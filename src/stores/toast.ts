// file: stores/toast.ts
// Zustand store for managing toast notification queue.
// Provides addToast/removeToast actions with auto-dismiss timers.
// Used by: Toast.tsx component, any component needing user feedback.
// Convenience hook useToast() provides success/error/warning/info methods.

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastStore = {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => number;
  removeToast: (id: number) => void;
};

const AUTO_DISMISS_MS: Record<ToastType, number> = {
  success: 4000,
  error: 8000,
  warning: 6000,
  info: 4000,
};

let nextId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (type, message, duration) => {
    const id = ++nextId;
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    const ms = duration ?? AUTO_DISMISS_MS[type];
    if (ms > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, ms);
    }
    return id;
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

// Convenience hook for components
export function useToast() {
  const addToast = useToastStore((s) => s.addToast);
  return {
    success: (message: string, duration?: number) => addToast('success', message, duration),
    error: (message: string, duration?: number) => addToast('error', message, duration),
    warning: (message: string, duration?: number) => addToast('warning', message, duration),
    info: (message: string, duration?: number) => addToast('info', message, duration),
  };
}
