// file: pages/jobs/JobsPage.tsx
// Jobs listing: recent jobs with status, component, duration.
// Auto-refreshes every 10 seconds. Filterable by status.
// Used by: App.tsx route /jobs.
// Data from: hooks/useJobs.ts (useJobs).

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { DataTable } from '@/components/DataTable';
import { useJobs } from '@/hooks/useJobs';
import { formatRelativeTime } from '@/lib/formatters';
import type { Job } from '@/api/types';

const STATUS_FILTERS = ['all', 'processing', 'success', 'error', 'waiting', 'terminated'] as const;

const COLUMNS = [
  {
    key: 'id',
    label: 'ID',
    render: (j: Job) => <span className="font-mono text-xs">{j.id}</span>,
    sortValue: (j: Job) => j.id,
  },
  {
    key: 'component',
    label: 'Component',
    render: (j: Job) => j.component,
    sortValue: (j: Job) => j.component,
  },
  {
    key: 'config',
    label: 'Config',
    render: (j: Job) => j.config || '-',
  },
  {
    key: 'status',
    label: 'Status',
    render: (j: Job) => <StatusBadge status={j.status} />,
    sortValue: (j: Job) => j.status,
  },
  {
    key: 'duration',
    label: 'Duration',
    render: (j: Job) => j.durationSeconds != null ? `${j.durationSeconds}s` : '-',
    sortValue: (j: Job) => j.durationSeconds ?? 0,
  },
  {
    key: 'created',
    label: 'Created',
    render: (j: Job) => formatRelativeTime(j.createdTime),
    sortValue: (j: Job) => j.createdTime,
  },
];

export function JobsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: jobs, isLoading, error } = useJobs({
    limit: 100,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Job execution history"
      />

      <div className="mb-4 flex gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>
      )}

      <DataTable
        columns={COLUMNS}
        data={jobs ?? []}
        keyFn={(j) => String(j.id)}
        searchFn={(j, q) =>
          j.component.toLowerCase().includes(q) ||
          String(j.id).includes(q) ||
          j.config.includes(q)
        }
        onRowClick={(j) => navigate(`/jobs/${j.id}`)}
        isLoading={isLoading}
        emptyMessage="No jobs found"
      />
    </div>
  );
}
