// file: pages/DashboardPage.tsx
// Organization-wide dashboard: stats and health across all registered projects.
// Shows aggregate stats, per-project health cards, and recent cross-project jobs.
// Used by: App.tsx route /dashboard.
// Single project: shows current project stats. Multi-project: shows org dashboard.

import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { useBuckets, useTables } from '@/hooks/useStorage';
import { useComponents } from '@/hooks/useComponents';
import { useJobs } from '@/hooks/useJobs';
import { useAllProjectsJobs } from '@/hooks/useAllProjectsJobs';
import { useConnectionStore } from '@/stores/connection';
import { formatRelativeTime } from '@/lib/formatters';
import { ROUTES } from '@/lib/constants';
import type { Bucket, Component, Job } from '@/api/schemas';

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | number;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{loading ? '...' : value}</p>
    </div>
  );
}

// -- Single project dashboard (backward compatible) --

function SingleProjectDashboard() {
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
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Component
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Created
              </th>
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
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatRelativeTime(job.createdTime)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -- Multi-project organization dashboard --

function OrgDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const projects = useConnectionStore((s) => s.projects);
  const { setActiveProject } = useConnectionStore();
  const { data: allJobs, isLoading: jobsLoading } = useAllProjectsJobs({ limit: 15 });

  // Aggregate stats from TanStack Query cache
  let totalBuckets = 0;
  let totalComponents = 0;
  const activeJobCount = allJobs.filter(
    (j) => j.status === 'processing' || j.status === 'waiting',
  ).length;

  const projectHealth: Array<{
    id: string;
    name: string;
    bucketCount: number;
    componentCount: number;
    lastJob: Job | null;
  }> = [];

  for (const project of projects) {
    const buckets = queryClient.getQueryData<Bucket[]>([project.id, 'storage', 'buckets']);
    const components = queryClient.getQueryData<Component[]>([project.id, 'components']);
    const bucketCount = buckets?.length ?? 0;
    const componentCount = components?.length ?? 0;
    totalBuckets += bucketCount;
    totalComponents += componentCount;

    // Find last job for this project from allJobs
    const projectJobs = allJobs.filter((j) => j._projectId === project.id);
    const lastJob = projectJobs[0] ?? null;

    projectHealth.push({
      id: project.id,
      name: project.projectName || `Project ${project.projectId}`,
      bucketCount,
      componentCount,
      lastJob,
    });
  }

  const recentJobs = allJobs.slice(0, 15);

  return (
    <div>
      <PageHeader
        title="Organization Dashboard"
        description={`${projects.length} projects connected`}
      />

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Projects" value={projects.length} />
        <StatCard label="Total Buckets" value={totalBuckets} />
        <StatCard label="Total Components" value={totalComponents} />
        <StatCard label="Active Jobs" value={activeJobCount} loading={jobsLoading} />
      </div>

      {/* Project health grid */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Project Health</h2>
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projectHealth.map((ph) => (
          <button
            key={ph.id}
            onClick={() => {
              setActiveProject(ph.id);
              navigate(ROUTES.DASHBOARD);
            }}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <p className="text-sm font-semibold text-gray-900 truncate">{ph.name}</p>
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
              <span>{ph.bucketCount} buckets</span>
              <span>{ph.componentCount} components</span>
            </div>
            {ph.lastJob ? (
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={ph.lastJob.status} />
                <span className="text-xs text-gray-400">
                  {formatRelativeTime(ph.lastJob.createdTime)}
                </span>
              </div>
            ) : (
              <p className="mt-2 text-xs text-gray-400">No recent jobs</p>
            )}
          </button>
        ))}
      </div>

      {/* Recent jobs across all projects */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Recent Jobs (All Projects)</h2>
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
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {jobsLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                  Loading jobs from all projects...
                </td>
              </tr>
            ) : !recentJobs.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                  No recent jobs
                </td>
              </tr>
            ) : (
              recentJobs.map((job) => (
                <tr
                  key={`${job._projectId}-${job.id}`}
                  onClick={() => {
                    setActiveProject(job._projectId);
                    navigate(`${ROUTES.JOBS}/${job.id}`);
                  }}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-xs font-medium text-gray-700">
                    {job._projectName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{job.component}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatRelativeTime(job.createdTime)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -- Main export: chooses single or multi-project dashboard --

export function DashboardPage() {
  const projects = useConnectionStore((s) => s.projects);
  const isMultiProject = projects.length > 1;

  return isMultiProject ? <OrgDashboard /> : <SingleProjectDashboard />;
}
