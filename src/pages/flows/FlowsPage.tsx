// file: pages/flows/FlowsPage.tsx
// Rich flows listing: name, schedule, last change, last run status.
// Aggregates data from orchestrator configs, scheduler, and jobs APIs.
// Groups flows by folder metadata when available.
// Used by: App.tsx route /flows.
// Data from: hooks/useFlows.ts (useFlows).

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { useFlows, type FlowItem } from '@/hooks/useFlows';
import { formatDate, formatRelativeTime } from '@/lib/formatters';

const FILTERS = ['all', 'scheduled', 'not-scheduled', 'failed'] as const;

function formatCron(cronTab: string, state: string): string {
  if (state === 'disabled') return 'Disabled';
  // Simple human-readable cron interpretation
  const parts = cronTab.split(' ');
  if (parts.length !== 5) return cronTab;
  const min = parts[0] ?? '*';
  const hour = parts[1] ?? '*';
  const dom = parts[2] ?? '*';
  const dow = parts[4] ?? '*';

  if (dom === 'L') {
    return `At ${hour}:${min.padStart(2, '0')}, last day of month`;
  }
  if (dow !== '*' && dom === '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[Number(dow)] ?? dow;
    return `At ${hour}:${min.padStart(2, '0')}, every ${dayName}`;
  }
  if (hour !== '*' && min !== '*' && dom === '*' && dow === '*') {
    return `Daily at ${hour}:${min.padStart(2, '0')} UTC`;
  }
  if (min.includes(',') || min.includes('/')) {
    return 'Every minute';
  }
  if (hour === '*') {
    return `Every hour at :${min.padStart(2, '0')}`;
  }
  return `${hour}:${min.padStart(2, '0')} UTC`;
}

function matchesFilter(item: FlowItem, filter: string): boolean {
  switch (filter) {
    case 'scheduled':
      return item.schedule?.schedule.state === 'enabled';
    case 'not-scheduled':
      return !item.schedule || item.schedule.schedule.state !== 'enabled';
    case 'failed':
      return item.lastJob?.status === 'error';
    default:
      return true;
  }
}

type FolderGroup = { folder: string; items: FlowItem[] };

function groupByFolder(flows: FlowItem[]): FolderGroup[] {
  const groups = new Map<string, FlowItem[]>();
  for (const flow of flows) {
    const key = flow.folder ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(flow);
  }

  // Named folders first (sorted alphabetically), then unfiled
  const result: FolderGroup[] = [];
  const sortedKeys = [...groups.keys()].filter(k => k !== '').sort();
  for (const key of sortedKeys) {
    result.push({ folder: key, items: groups.get(key)! });
  }
  const unfiled = groups.get('');
  if (unfiled) {
    result.push({ folder: '', items: unfiled });
  }
  return result;
}

export function FlowsPage() {
  const navigate = useNavigate();
  const { data: flows, isLoading, error } = useFlows();
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'flows' | 'conditional'>('flows');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  };

  const filtered = flows?.filter((f) => {
    if (!matchesFilter(f, filter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return f.config.name.toLowerCase().includes(q) || f.config.description.toLowerCase().includes(q);
    }
    return true;
  });

  // Split into regular Flows (orchestrator) and Conditional Flows (keboola.flow)
  const regularFlows = filtered?.filter((f) => f.componentId === 'keboola.orchestrator') ?? [];
  const conditionalFlows = filtered?.filter((f) => f.componentId === 'keboola.flow') ?? [];

  const activeItems = tab === 'flows' ? regularFlows : conditionalFlows;
  const grouped = groupByFolder(activeItems);
  const hasFolders = grouped.some(g => g.folder !== '');

  function renderFlowTable(items: FlowItem[]) {
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Schedule</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Last Change</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Last Run</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {items.map((item) => (
              <tr
                key={`${item.componentId}:${item.config.id}`}
                onClick={() => navigate(`/components/${encodeURIComponent(item.componentId)}/${item.config.id}`)}
                className="cursor-pointer hover:bg-gray-50"
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.config.name}</p>
                    {item.config.description && (
                      <p className="mt-0.5 max-w-xs truncate text-xs text-gray-400">{item.config.description}</p>
                    )}
                    {item.config.isDisabled && (
                      <span className="mt-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">Disabled</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {item.schedule ? (
                    <span className={item.schedule.schedule.state === 'enabled' ? 'text-gray-700' : 'text-gray-400'}>
                      {formatCron(item.schedule.schedule.cronTab, item.schedule.schedule.state)}
                    </span>
                  ) : (
                    <span className="text-gray-400">No Schedule</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-gray-600">{formatDate(item.config.currentVersion.created)}</p>
                  <p className="text-xs text-gray-400">{item.config.currentVersion.creatorToken.description}</p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {item.lastJob ? (
                    <div>
                      <p>{formatRelativeTime(item.lastJob.createdTime)}</p>
                      {item.lastJob.durationSeconds != null && item.lastJob.durationSeconds > 0 && (
                        <p className="text-xs text-gray-400">{item.lastJob.durationSeconds}s</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">No run yet</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.lastJob ? (
                    <StatusBadge status={item.lastJob.status} />
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Flows"
        description={`${flows?.length ?? 0} flows`}
      />

      {/* Tabs: Flows / Conditional Flows */}
      {!isLoading && (regularFlows.length > 0 || conditionalFlows.length > 0) && conditionalFlows.length > 0 && (
        <div className="mb-3 flex items-center gap-0 border-b border-gray-200">
          <button
            onClick={() => setTab('flows')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'flows'
                ? 'border-b-2 border-blue-500 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Flows ({regularFlows.length})
          </button>
          <button
            onClick={() => setTab('conditional')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'conditional'
                ? 'border-b-2 border-purple-500 text-purple-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Conditional ({conditionalFlows.length})
            <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-medium text-purple-600">Beta</span>
          </button>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'not-scheduled' ? 'Not Scheduled' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search flows..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading flows...</div>
      ) : activeItems.length === 0 ? (
        <div className="rounded-lg border border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
          No {tab === 'conditional' ? 'conditional ' : ''}flows found
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.folder || '__unfiled'}>
              {group.folder ? (
                <button
                  onClick={() => toggleFolder(group.folder)}
                  className="mb-1 flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-left hover:bg-gray-50"
                >
                  <span className="text-xs text-gray-400">
                    {expandedFolders.has(group.folder) ? '\u25BC' : '\u25B6'}
                  </span>
                  <span className="text-sm font-medium text-gray-800">{group.folder}</span>
                  <span className="text-xs text-gray-400">({group.items.length})</span>
                </button>
              ) : (
                hasFolders && (
                  <p className="mb-2 mt-2 rounded bg-gray-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Without folder
                  </p>
                )
              )}
              {(!group.folder || expandedFolders.has(group.folder)) && renderFlowTable(group.items)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
