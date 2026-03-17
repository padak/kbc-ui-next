// file: components/Sidebar.tsx
// Collapsible navigation sidebar with route links and connection info.
// Collapsed: shows only icons (48px). Expanded: icons + labels (208px).
// Used by: components/AppLayout.tsx (always visible when connected).
// Toggle via hamburger button or AppLayout state.

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

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { projectName, tokenDescription, disconnect } = useConnectionStore();

  return (
    <aside
      className={`flex h-full flex-col border-r border-gray-200 bg-white transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-52'
      }`}
    >
      <div className="flex items-center border-b border-gray-200 px-3 py-3">
        <button
          onClick={onToggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '\u2261' : '\u2190'}
        </button>
        {!collapsed && (
          <div className="ml-2 min-w-0">
            <h1 className="text-sm font-bold text-gray-900">Keboola</h1>
            {projectName && (
              <p className="truncate text-[10px] text-gray-400" title={projectName}>
                {projectName}
              </p>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-1.5 py-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${collapsed ? 'justify-center' : ''}`
            }
          >
            <span className="w-5 shrink-0 text-center text-base">{ICONS[item.icon] ?? '?'}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-200 px-2 py-2">
        {!collapsed && tokenDescription && (
          <p className="mb-1.5 truncate px-1 text-[10px] text-gray-400" title={tokenDescription}>
            {tokenDescription}
          </p>
        )}
        <button
          onClick={disconnect}
          title={collapsed ? 'Disconnect' : undefined}
          className={`w-full rounded-md border border-gray-300 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 ${
            collapsed ? 'px-1' : 'px-3'
          }`}
        >
          {collapsed ? '\u23FB' : 'Disconnect'}
        </button>
      </div>
    </aside>
  );
}
