// file: pages/jobs/JobDetailPage.tsx
// Single job detail: status, component, timing, result JSON.
// Shows job metadata, duration, and raw result/config.
// Used by: App.tsx route /jobs/:jobId.
// Data from: hooks/useJobs.ts (useJob).

import { useState } from 'react';
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

      {/* Result — structured view */}
      <JobResult result={job.result as Record<string, unknown> | null} />
    </div>
  );
}

// -- Structured job result viewer --

function JobResult({ result }: { result: Record<string, unknown> | null }) {
  const [showRaw, setShowRaw] = useState(false);

  if (!result || Object.keys(result).length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
        No result data.
      </div>
    );
  }

  const message = result.message as string | undefined;
  const configVersion = result.configVersion as string | undefined;

  // Output tables
  const output = result.output as Record<string, unknown> | undefined;
  const outputTables = (output?.tables as Array<Record<string, unknown>>) ?? [];

  // Input tables
  const input = result.input as Record<string, unknown> | undefined;
  const inputTables = (input?.tables as Array<Record<string, unknown>>) ?? [];

  // Images
  const images = (result.images as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Result</h2>
        <button
          type="button"
          onClick={() => setShowRaw(!showRaw)}
          className="rounded border border-gray-300 px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-50 transition-colors"
        >
          {showRaw ? 'Structured' : 'Raw JSON'}
        </button>
      </div>

      {showRaw ? (
        <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-900 p-4 text-sm text-green-400 max-h-[500px]">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : (
        <div className="space-y-3">
          {/* Message + version */}
          {(message || configVersion) && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
              {message && <p className="text-sm text-gray-800">{message}</p>}
              {configVersion && (
                <p className="mt-1 text-xs text-gray-400">Config version: {configVersion}</p>
              )}
            </div>
          )}

          {/* Output tables */}
          {outputTables.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
                <h3 className="text-xs font-semibold uppercase text-gray-500">
                  Output Tables
                  <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600 normal-case">{outputTables.length}</span>
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {outputTables.map((table, i) => (
                  <TableResultRow key={i} table={table} stage="out" />
                ))}
              </div>
            </div>
          )}

          {/* Input tables */}
          {inputTables.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
                <h3 className="text-xs font-semibold uppercase text-gray-500">
                  Input Tables
                  <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 normal-case">{inputTables.length}</span>
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {inputTables.map((table, i) => (
                  <TableResultRow key={i} table={table} stage="in" />
                ))}
              </div>
            </div>
          )}

          {/* Images */}
          {images.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
              <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Component Image</h3>
              {images.map((img, i) => (
                <p key={i} className="font-mono text-xs text-gray-600">{img.id as string}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -- Single output/input table in result --

function TableResultRow({ table, stage }: { table: Record<string, unknown>; stage: 'in' | 'out' }) {
  const [expanded, setExpanded] = useState(false);
  const id = table.id as string ?? '';
  const name = table.name as string ?? table.displayName as string ?? '';
  const columns = (table.columns as Array<Record<string, unknown>>) ?? [];

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-50 transition-colors"
      >
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
          stage === 'out' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
        }`}>
          {stage}
        </span>
        <span className="font-mono text-sm text-gray-800">{name || id}</span>
        {columns.length > 0 && (
          <span className="text-xs text-gray-400">{columns.length} columns</span>
        )}
        <span className={`ml-auto text-[10px] text-gray-300 transition-transform ${expanded ? 'rotate-90' : ''}`}>&#9656;</span>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-2">
          <p className="mb-1 font-mono text-xs text-gray-400">{id}</p>
          {columns.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {columns.map((col, i) => (
                <span key={i} className="rounded bg-white border border-gray-200 px-1.5 py-0.5 font-mono text-[10px] text-gray-600">
                  {col.name as string}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
