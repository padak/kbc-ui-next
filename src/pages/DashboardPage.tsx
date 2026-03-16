// file: pages/DashboardPage.tsx
// Dashboard overview: project stats, recent jobs, quick links.
// Aggregates data from storage, components, and jobs hooks.
// Used by: App.tsx as the default authenticated landing page.
// Renders summary cards and a recent jobs table.

import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { useBuckets, useTables } from '@/hooks/useStorage';
import { useComponents } from '@/hooks/useComponents';
import { useJobs } from '@/hooks/useJobs';
import { useConnectionStore } from '@/stores/connection';
import { formatRelativeTime } from '@/lib/formatters';
import { ROUTES } from '@/lib/constants';

function StatCard({ label, value, loading }: { label: string; value: string | number; loading?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">
        {loading ? '...' : value}
      </p>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const projectName = useConnectionStore((s) => s.projectName);
  const { data: buckets, isLoading: bucketsLoading } = useBuckets();
  const { data: tables, isLoading: tablesLoading } = useTables();
  const { data: components, isLoading: componentsLoading } = useComponents();
  const { data: jobs, isLoading: jobsLoading } = useJobs({ limit: 10 });

  const configCount = components?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={projectName ? `Project: ${projectName}` : undefined}
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Buckets" value={buckets?.length ?? 0} loading={bucketsLoading} />
        <StatCard label="Tables" value={tables?.length ?? 0} loading={tablesLoading} />
        <StatCard label="Components" value={configCount} loading={componentsLoading} />
        <StatCard label="Recent Jobs" value={jobs?.length ?? 0} loading={jobsLoading} />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-gray-900">Recent Jobs</h2>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Component</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {jobsLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                  Loading jobs...
                </td>
              </tr>
            ) : !jobs?.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                  No recent jobs
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr
                  key={job.id}
                  onClick={() => navigate(`${ROUTES.JOBS}/${job.id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">{job.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{job.component}</td>
                  <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatRelativeTime(job.createdTime)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
