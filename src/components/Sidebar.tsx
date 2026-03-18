// file: components/Sidebar.tsx
// Collapsible navigation sidebar with project switcher, route links, and connection info.
// When multiple projects are loaded, shows a scrollable project list grouped by stack.
// Used by: components/AppLayout.tsx (always visible when connected).
// Toggle via hamburger button or AppLayout state.

import { NavLink } from 'react-router';
import { NAV_ITEMS } from '@/lib/constants';
import { useConnectionStore } from '@/stores/connection';
import type { ProjectEntry } from '@/stores/connection';
import { useThemeStore } from '@/stores/theme';

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

function groupByOrg(projects: ProjectEntry[]): Record<string, ProjectEntry[]> {
  const groups: Record<string, ProjectEntry[]> = {};
  for (const project of projects) {
    const orgLabel = project.organizationName || `Org ${project.organizationId}` || extractStackLabel(project.stackUrl);
    if (!groups[orgLabel]) {
      groups[orgLabel] = [];
    }
    groups[orgLabel].push(project);
  }
  return groups;
}

function extractStackLabel(stackUrl: string): string {
  try {
    const hostname = new URL(stackUrl).hostname;
    // connection.north-europe.azure.keboola.com -> north-europe.azure
    // connection.keboola.com -> keboola.com
    const parts = hostname.split('.');
    if (parts.length > 2 && parts[0] === 'connection') {
      return parts.slice(1, -2).join('.') || parts.slice(1).join('.');
    }
    return hostname;
  } catch {
    return stackUrl;
  }
}

function ThemeToggleInline({ collapsed }: { collapsed: boolean }) {
  const { designSystem, toggle } = useThemeStore();
  return (
    <button
      onClick={toggle}
      title={collapsed ? (designSystem ? 'Design System ON' : 'Design System OFF') : undefined}
      className={`mb-1.5 flex w-full items-center gap-2 rounded-md py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 ${
        collapsed ? 'justify-center px-1' : 'px-3'
      }`}
    >
      <span
        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full transition-colors ${
          designSystem ? 'bg-green-500' : 'bg-gray-300'
        }`}
      />
      {!collapsed && (designSystem ? 'Design System ON' : 'Design System OFF')}
    </button>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { projects, activeProjectId, projectName, tokenDescription, disconnect, setActiveProject } =
    useConnectionStore();

  const hasMultipleProjects = projects.length > 1;
  const groupedProjects = hasMultipleProjects ? groupByOrg(projects) : {};

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
            {!hasMultipleProjects && projectName && (
              <p className="truncate text-[10px] text-gray-400" title={projectName}>
                {projectName}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Project switcher for multi-project mode */}
      {hasMultipleProjects && (
        <div className="border-b border-gray-200 max-h-48 overflow-y-auto px-2 py-2">
          {collapsed ? (
            // Collapsed: show abbreviated project IDs
            <div className="flex flex-col gap-0.5">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActiveProject(p.id)}
                  title={p.projectName}
                  className={`w-full rounded px-1 py-1 text-[10px] font-mono ${
                    p.id === activeProjectId
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {p.id.slice(0, 4)}
                </button>
              ))}
            </div>
          ) : (
            // Expanded: show projects grouped by stack
            Object.entries(groupedProjects).map(([stackLabel, stackProjects]) => (
              <div key={stackLabel} className="mb-1">
                {Object.keys(groupedProjects).length > 1 && (
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase text-gray-400 tracking-wider">
                    {stackLabel}
                  </p>
                )}
                {stackProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setActiveProject(p.id)}
                    title={`${p.projectName} (ID: ${p.id})`}
                    className={`w-full text-left px-2 py-1 text-xs rounded truncate ${
                      p.id === activeProjectId
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p.projectName}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}

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
        <ThemeToggleInline collapsed={collapsed} />
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
