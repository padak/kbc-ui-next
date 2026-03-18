// file: pages/jobs/JobDetailPage.tsx
// Single job detail: status, component, timing, result JSON.
// Shows job metadata, duration, and raw result/config.
// Used by: App.tsx route /jobs/:jobId.
// Data from: hooks/useJobs.ts (useJob).

import { useParams, useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/formatters';
import { useJob } from '@/hooks/useJobs';
import { useJobEvents } from '@/hooks/useEvents';
import { EventsViewer } from '@/components/EventsViewer';
import { calculateJobCredits, formatCredits, getContainerSize } from '@/config/credits';

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '-';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
}

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading, error } = useJob(jobId ?? '');
  const { data: jobEvents, isLoading: eventsLoading, error: eventsError } = useJobEvents(job?.runId);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-gray-400">Loading job...</div>;
  }

  if (error) {
    return <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>;
  }

  if (!job) return null;

  return (
    <div>
      <PageHeader
        title={`Job ${job.id}`}
        description={`${job.component} / ${job.config}`}
        actions={
          <button
            onClick={() => navigate('/jobs')}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Back to Jobs
          </button>
        }
      />

      {/* Info cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Status</p>
          <div className="mt-1">
            <StatusBadge status={job.status} />
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Component</p>
          <p className="text-sm font-semibold">{job.component}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Config</p>
          <p className="text-sm font-semibold">{job.config}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Mode</p>
          <p className="text-sm font-semibold">{job.mode}</p>
        </div>
      </div>

      {/* Timing */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Created</p>
          <p className="text-sm font-semibold">{formatDate(job.createdTime)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Start Time</p>
          <p className="text-sm font-semibold">{job.startTime ? formatDate(job.startTime) : '-'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">End Time</p>
          <p className="text-sm font-semibold">{job.endTime ? formatDate(job.endTime) : '-'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Duration</p>
          <p className="text-sm font-semibold">{formatDuration(job.durationSeconds)}</p>
        </div>
      </div>

      {/* Credits */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Credits consumed</p>
          <p className="text-lg font-semibold text-blue-700">
            {formatCredits(calculateJobCredits(job.durationSeconds, getContainerSize((job as Record<string, unknown>).metrics), job.component))}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Backend size</p>
          <p className="text-sm font-semibold">{getContainerSize((job as Record<string, unknown>).metrics)}</p>
        </div>
      </div>

      {/* Token info */}
      <div className="mb-6">
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Run by</p>
          <p className="text-sm font-semibold">{job.token.description}</p>
        </div>
      </div>

      {/* Job Events — live stream */}
      <div className="mb-6">
        <EventsViewer
          events={jobEvents ?? []}
          isLoading={eventsLoading}
          error={eventsError instanceof Error ? eventsError : null}
          title={`Job Events${job.status === 'processing' ? ' (live)' : ''}`}
          maxHeight="400px"
          emptyMessage="No events for this job."
        />
      </div>

      {/* Raw result JSON */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Result</h2>
      <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-900 p-4 text-sm text-green-400">
        {JSON.stringify(job.result, null, 2)}
      </pre>
    </div>
  );
}
