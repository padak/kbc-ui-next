// file: pages/flows/FlowsPage.tsx
// Rich flows listing: name, schedule, last change, last run status.
// Aggregates data from orchestrator configs, scheduler, and jobs APIs.
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

export function FlowsPage() {
  const navigate = useNavigate();
  const { data: flows, isLoading, error } = useFlows();
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = flows?.filter((f) => {
    if (!matchesFilter(f, filter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return f.config.name.toLowerCase().includes(q) || f.config.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Flows"
        description={`${flows?.length ?? 0} flows`}
      />

      <div className="mb-4 flex gap-2">
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
        className="mb-4 w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading flows...</div>
      ) : (
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
              {!filtered?.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    No flows found
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
