// file: pages/jobs/JobsPage.tsx
// Jobs listing with resolved component/config names and icons.
// Mirrors legacy UI: Component (icon+name+type), Configuration, Duration, Created, Status.
// Used by: App.tsx route /jobs.
// Data from: hooks/useJobs.ts, hooks/useComponentLookup.ts.

import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { useJobs } from '@/hooks/useJobs';
import { useComponentLookup } from '@/hooks/useComponentLookup';
import { useConnectionStore } from '@/stores/connection';
import { formatRelativeTime } from '@/lib/formatters';
import { ROUTES } from '@/lib/constants';
import type { Job } from '@/api/schemas';

const STATUS_FILTERS = ['all', 'processing', 'success', 'error', 'waiting', 'terminated', 'cancelled'] as const;

const TYPE_LABELS: Record<string, string> = {
  extractor: 'Data Source',
  writer: 'Data Destination',
  application: 'Application',
  transformation: 'Transformation',
  other: '',
};

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds === 0) return '-';
  if (seconds < 60) return `${seconds} sec`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min < 60) return sec > 0 ? `${min} min ${sec} sec` : `${min} min`;
  const hrs = Math.floor(min / 60);
  const remainMin = min % 60;
  return `${hrs} hr ${remainMin} min`;
}

export function JobsPage() {
  const navigate = useNavigate();
  const projects = useConnectionStore((s) => s.projects);
  const isMultiProject = projects.length > 1;
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: jobs, isLoading, error } = useJobs({
    limit: 100,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const { getComponentName, getComponentType, getComponentIcon, getConfigName } = useComponentLookup();

  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Job execution history"
        actions={
          isMultiProject ? (
            <Link
              to={ROUTES.ALL_JOBS}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              All Projects
            </Link>
          ) : undefined
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

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading jobs...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Component</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Configuration</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {!jobs?.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    No jobs found
                  </td>
                </tr>
              ) : (
                jobs.map((job: Job) => {
                  const compName = getComponentName(job.component);
                  const compType = getComponentType(job.component);
                  const compIcon = getComponentIcon(job.component);
                  const cfgName = getConfigName(job.component, job.config);
                  const typeLabel = TYPE_LABELS[compType] ?? compType;

                  return (
                    <tr
                      key={job.id}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {compIcon && (
                            <img src={compIcon} alt="" className="h-6 w-6 rounded" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{compName}</p>
                            {typeLabel && (
                              <p className="text-xs text-gray-400">{typeLabel}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-700">{cfgName}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {formatDuration(job.durationSeconds)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-600">{formatRelativeTime(job.createdTime)}</p>
                        <p className="text-xs text-gray-400">{job.token.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={job.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
