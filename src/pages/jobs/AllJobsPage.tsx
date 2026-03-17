// file: pages/jobs/AllJobsPage.tsx
// Multi-project jobs view: all jobs across all registered projects.
// Merged and sorted by createdTime, with project name column.
// Used by: App.tsx route /jobs/all.
// Data from: hooks/useAllProjectsJobs.ts.

import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { useAllProjectsJobs, type MultiProjectJob } from '@/hooks/useAllProjectsJobs';
import { useComponentLookup } from '@/hooks/useComponentLookup';
import { useConnectionStore } from '@/stores/connection';
import { formatRelativeTime } from '@/lib/formatters';

const STATUS_FILTERS = [
  'all',
  'processing',
  'success',
  'error',
  'waiting',
  'terminated',
] as const;

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds === 0) return '-';
  if (seconds < 60) return `${seconds} sec`;
  const min = Math.floor(seconds / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} hr ${min % 60} min`;
}

export function AllJobsPage() {
  const navigate = useNavigate();
  const { setActiveProject } = useConnectionStore();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: jobs, isLoading } = useAllProjectsJobs({ limit: 30 });
  const { getComponentName, getComponentType } = useComponentLookup();

  const filtered =
    statusFilter === 'all' ? jobs : jobs.filter((j) => j.status === statusFilter);

  return (
    <div>
      <PageHeader
        title="All Jobs"
        description="Jobs across all projects"
        actions={
          <Link
            to="/jobs"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Current Project Only
          </Link>
        }
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

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          Loading jobs from all projects...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Project
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Component
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {!filtered.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    No jobs found
                  </td>
                </tr>
              ) : (
                filtered.map((job: MultiProjectJob) => (
                  <tr
                    key={`${job._projectId}-${job.id}`}
                    onClick={() => {
                      setActiveProject(job._projectId);
                      navigate(`/jobs/${job.id}`);
                    }}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-gray-700">{job._projectName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900">{getComponentName(job.component)}</p>
                      <p className="text-xs text-gray-400">{getComponentType(job.component)}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {formatDuration(job.durationSeconds)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatRelativeTime(job.createdTime)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
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
