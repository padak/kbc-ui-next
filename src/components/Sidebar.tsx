// file: components/Sidebar.tsx
// Main navigation sidebar with route links and connection info.
// Renders NAV_ITEMS from constants, highlights active route.
// Used by: components/AppLayout.tsx (always visible when connected).
// Disconnect button logs out and redirects to ConnectPage.

import { NavLink } from 'react-router';
import { NAV_ITEMS } from '@/lib/constants';
import { useConnectionStore } from '@/stores/connection';

const ICONS: Record<string, string> = {
  home: '\u2302',
  database: '\u26C1',
  puzzle: '\u29BB',
  workflow: '\u2942',
  code: '\u2039\u203A',
  play: '\u25B6',
  settings: '\u2699',
};

export function Sidebar() {
  const { projectName, tokenDescription, disconnect } = useConnectionStore();

  return (
    <aside className="flex h-full w-56 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-4">
        <h1 className="text-lg font-bold text-gray-900">Keboola</h1>
        {projectName && (
          <p className="mt-1 truncate text-xs text-gray-500" title={projectName}>
            {projectName}
          </p>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <span className="w-5 text-center text-base">{ICONS[item.icon] ?? '?'}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-200 px-4 py-3">
        {tokenDescription && (
          <p className="mb-2 truncate text-xs text-gray-400" title={tokenDescription}>
            {tokenDescription}
          </p>
        )}
        <button
          onClick={disconnect}
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50"
        >
          Disconnect
        </button>
      </div>
    </aside>
  );
}
