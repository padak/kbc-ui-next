// file: pages/jobs/JobDetailPage.tsx
// Compact job detail: condensed header, events + result side by side.
// Component and config names are clickable links. Fits on one screen.
// Used by: App.tsx route /jobs/:jobId.
// Data from: hooks/useJobs.ts, hooks/useEvents.ts.

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
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

  const credits = formatCredits(calculateJobCredits(job.durationSeconds, getContainerSize((job as Record<string, unknown>).metrics), job.component));
  const result = job.result as Record<string, unknown> | null;

  return (
    <div>
      {/* Compact header — one row */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Job {job.id}</h1>
          <StatusBadge status={job.status} />
        </div>
        <button
          onClick={() => navigate('/jobs')}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Back to Jobs
        </button>
      </div>

      {/* Condensed info — single row of key-value pairs */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm">
        <div>
          <span className="text-gray-400">Component </span>
          <Link
            to={`/components/${encodeURIComponent(job.component)}`}
            className="font-medium text-blue-600 hover:text-blue-800"
          >
            {job.component}
          </Link>
        </div>
        <div>
          <span className="text-gray-400">Config </span>
          <Link
            to={`/components/${encodeURIComponent(job.component)}/${job.config}`}
            className="font-medium text-blue-600 hover:text-blue-800"
          >
            {job.config}
          </Link>
        </div>
        <div>
          <span className="text-gray-400">Duration </span>
          <span className="font-semibold">{formatDuration(job.durationSeconds)}</span>
        </div>
        <div>
          <span className="text-gray-400">Credits </span>
          <span className="font-semibold text-blue-700">{credits}</span>
        </div>
        <div>
          <span className="text-gray-400">Size </span>
          <span className="font-medium">{getContainerSize((job as Record<string, unknown>).metrics)}</span>
        </div>
        <div>
          <span className="text-gray-400">Mode </span>
          <span className="font-medium">{job.mode}</span>
        </div>
        <div>
          <span className="text-gray-400">By </span>
          <span className="font-medium">{job.token.description}</span>
        </div>
        <div className="text-gray-400">
          {job.startTime ? formatDate(job.startTime) : formatDate(job.createdTime)}
          {job.endTime && ` — ${formatDate(job.endTime)}`}
        </div>
      </div>

      {/* Two-column layout: Events (left) + Result (right) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Events — takes 2/3 */}
        <div className="lg:col-span-2">
          <EventsViewer
            events={jobEvents ?? []}
            isLoading={eventsLoading}
            error={eventsError instanceof Error ? eventsError : null}
            title={`Events${job.status === 'processing' ? ' (live)' : ''}`}
            maxHeight="calc(100vh - 250px)"
            emptyMessage="No events for this job."
          />
        </div>

        {/* Result — takes 1/3 */}
        <div>
          <JobResult result={result} />
        </div>
      </div>
    </div>
  );
}

// -- Structured job result viewer (compact, sidebar-style) --

function JobResult({ result }: { result: Record<string, unknown> | null }) {
  const [showRaw, setShowRaw] = useState(false);

  if (!result || Object.keys(result).length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-xs text-gray-400">
        No result data.
      </div>
    );
  }

  const message = result.message as string | undefined;
  const configVersion = result.configVersion as string | undefined;
  const output = result.output as Record<string, unknown> | undefined;
  const outputTables = (output?.tables as Array<Record<string, unknown>>) ?? [];
  const input = result.input as Record<string, unknown> | undefined;
  const inputTables = (input?.tables as Array<Record<string, unknown>>) ?? [];
  const images = (result.images as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
        <h3 className="text-sm font-semibold text-gray-900">Result</h3>
        <button
          type="button"
          onClick={() => setShowRaw(!showRaw)}
          className="rounded px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 transition-colors"
        >
          {showRaw ? 'Structured' : 'JSON'}
        </button>
      </div>

      {showRaw ? (
        <pre className="overflow-auto bg-gray-900 p-3 text-xs text-green-400" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : (
        <div className="divide-y divide-gray-100">
          {/* Message */}
          {message && (
            <div className="px-3 py-2">
              <p className="text-sm text-gray-800">{message}</p>
              {configVersion && <p className="text-[10px] text-gray-400">v{configVersion}</p>}
            </div>
          )}

          {/* Output tables */}
          {outputTables.length > 0 && (
            <div className="px-3 py-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase text-gray-400">
                Output <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-green-600 normal-case">{outputTables.length}</span>
              </p>
              {outputTables.map((table, i) => (
                <TableResultRow key={i} table={table} stage="out" />
              ))}
            </div>
          )}

          {/* Input tables */}
          {inputTables.length > 0 && (
            <div className="px-3 py-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase text-gray-400">
                Input <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-blue-600 normal-case">{inputTables.length}</span>
              </p>
              {inputTables.map((table, i) => (
                <TableResultRow key={i} table={table} stage="in" />
              ))}
            </div>
          )}

          {/* Images */}
          {images.length > 0 && (
            <div className="px-3 py-2">
              <p className="mb-1 text-[10px] font-semibold uppercase text-gray-400">Image</p>
              {images.map((img, i) => (
                <p key={i} className="truncate font-mono text-[10px] text-gray-500" title={img.id as string}>{img.id as string}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -- Single table row in result --

function TableResultRow({ table, stage }: { table: Record<string, unknown>; stage: 'in' | 'out' }) {
  const [expanded, setExpanded] = useState(false);
  const id = table.id as string ?? '';
  const name = table.name as string ?? table.displayName as string ?? '';
  const columns = (table.columns as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 rounded py-0.5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium ${
          stage === 'out' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
        }`}>
          {stage}
        </span>
        <span className="font-mono text-xs text-gray-800">{name || id}</span>
        {columns.length > 0 && (
          <span className="text-[10px] text-gray-400">{columns.length}c</span>
        )}
        <span className={`ml-auto text-[9px] text-gray-300 transition-transform ${expanded ? 'rotate-90' : ''}`}>&#9656;</span>
      </button>
      {expanded && columns.length > 0 && (
        <div className="ml-5 mb-1 flex flex-wrap gap-0.5">
          {columns.map((col, i) => (
            <span key={i} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[9px] text-gray-500">
              {col.name as string}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
