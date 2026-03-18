// file: components/ThemeToggle.tsx
// Floating button to toggle between default Tailwind and Keboola design system.
// Shows current state and provides one-click switch.
// Used by: AppLayout.tsx (rendered in bottom-right corner).
// Can be removed entirely when design system is permanently adopted.

import { useThemeStore } from '@/stores/theme';

export function ThemeToggle() {
  const { designSystem, toggle } = useThemeStore();

  return (
    <button
      onClick={toggle}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-lg transition-all hover:shadow-xl"
      data-tooltip={designSystem ? 'Switch to default theme' : 'Switch to Keboola Design System'}
    >
      <span
        className={`inline-block h-3 w-3 rounded-full transition-colors ${
          designSystem ? 'bg-green-500' : 'bg-gray-300'
        }`}
      />
      {designSystem ? 'Design System ON' : 'Design System OFF'}
    </button>
  );
}
