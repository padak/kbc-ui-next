// file: stores/theme.ts
// Zustand store for design system theme toggle.
// Persists choice to localStorage so it survives page reloads.
// Used by: AppLayout.tsx, ThemeToggle.tsx, main.tsx.
// Syncs data-theme attribute on <html> element.

import { create } from 'zustand';

const STORAGE_KEY = 'kbc-design-system';

type ThemeStore = {
  designSystem: boolean;
  toggle: () => void;
};

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function syncToDOM(enabled: boolean) {
  if (enabled) {
    document.documentElement.setAttribute('data-theme', 'keboola');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export const useThemeStore = create<ThemeStore>((set) => {
  const initial = readInitial();
  // Apply on store creation (before first render)
  syncToDOM(initial);

  return {
    designSystem: initial,
    toggle: () =>
      set((state) => {
        const next = !state.designSystem;
        try {
          localStorage.setItem(STORAGE_KEY, String(next));
        } catch {
          // localStorage unavailable
        }
        syncToDOM(next);
        return { designSystem: next };
      }),
  };
});
