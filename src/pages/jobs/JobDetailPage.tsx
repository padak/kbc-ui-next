// file: pages/jobs/JobDetailPage.tsx
// Job detail with 4 switchable layout variants for A/B testing.
// Users can switch and vote. Choice persists in localStorage.
// Used by: App.tsx route /jobs/:jobId.
// Data from: hooks/useJobs.ts, hooks/useEvents.ts.

import { useState, useMemo, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/formatters';
import { useJob } from '@/hooks/useJobs';
import { useJobEvents } from '@/hooks/useEvents';
import { EventsViewer } from '@/components/EventsViewer';
import { PhaseTimeline } from '@/components/PhaseTimeline';
import { TransformationAnalyzer } from '@/components/TransformationAnalyzer';
import { calculateJobCredits, formatCredits, getContainerSize } from '@/config/credits';
import { EVENTS_JUMP_TO_START_DELAY } from '@/config/events';
import { COMPLETED_JOB_STATUSES } from '@/config/phases';
import { useConnectionStore } from '@/stores/connection';

// -- Layout persistence --

const LAYOUT_KEY = 'kbc-job-layout';
const VOTES_KEY = 'kbc-job-layout-votes';

type LayoutId = 'classic' | 'split' | 'terminal' | 'dashboard';

const LAYOUTS: { id: LayoutId; label: string; desc: string }[] = [
  { id: 'classic', label: 'Classic', desc: 'Cards + stacked sections' },
  { id: 'split', label: 'Split', desc: 'Events left, result right' },
  { id: 'terminal', label: 'Terminal', desc: 'Events-first, minimal chrome' },
  { id: 'dashboard', label: 'Dashboard', desc: 'Grid cards overview' },
];

function getSavedLayout(): LayoutId {
  try { return (localStorage.getItem(LAYOUT_KEY) as LayoutId) ?? 'classic'; } catch { return 'classic'; }
}

function saveLayout(id: LayoutId) {
  try { localStorage.setItem(LAYOUT_KEY, id); } catch { /* */ }
}

function getVotes(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(VOTES_KEY) ?? '{}'); } catch { return {}; }
}

function castVote(id: LayoutId) {
  const votes = getVotes();
  votes[id] = (votes[id] ?? 0) + 1;
  try { localStorage.setItem(VOTES_KEY, JSON.stringify(votes)); } catch { /* */ }
}

// -- Helpers --

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

// -- Main page --

export function JobDetailPage() {
  const { projects, projectName } = useConnectionStore();
  const isMultiProject = projects.length > 1;
  const { jobId } = useParams<{ jobId: string }>();
  const { data: job, isLoading, error } = useJob(jobId ?? '');
  const isLive = job?.status === 'processing';
  const {
    data: eventsData,
    isLoading: eventsLoading,
    error: eventsError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useJobEvents(job?.id, job?.runId, { polling: isLive });
  const jobEvents = useMemo(() => eventsData?.pages.flat() ?? [], [eventsData]);
  const [layout, setLayout] = useState<LayoutId>(getSavedLayout);
  const [voted, setVoted] = useState(false);
  const [isJumpingToStart, setIsJumpingToStart] = useState(false);
  const jumpAbortRef = useRef(false);

  const handleJumpToStart = useCallback(async () => {
    setIsJumpingToStart(true);
    jumpAbortRef.current = false;
    try {
      let result = await fetchNextPage();
      while (result.hasNextPage && !jumpAbortRef.current) {
        await new Promise((r) => setTimeout(r, EVENTS_JUMP_TO_START_DELAY));
        result = await fetchNextPage();
      }
    } finally {
      setIsJumpingToStart(false);
    }
  }, [fetchNextPage]);

  function switchLayout(id: LayoutId) {
    setLayout(id);
    saveLayout(id);
  }

  // Track the timestamp of the currently visible event in EventsViewer (for phase timeline marker)
  const [visibleEventTime, setVisibleEventTime] = useState<string | null>(null);

  function handleVote() {
    castVote(layout);
    setVoted(true);
    setTimeout(() => setVoted(false), 2000);
  }

  if (isLoading) return <div className="flex items-center justify-center py-12 text-gray-400">Loading job...</div>;
  if (error) return <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>;
  if (!job) return null;

  const result = job.result as Record<string, unknown> | null;
  const credits = formatCredits(calculateJobCredits(job.durationSeconds, getContainerSize((job as Record<string, unknown>).metrics), job.component));
  const backendSize = getContainerSize((job as Record<string, unknown>).metrics);
  const eventsProps = {
    events: jobEvents,
    isLoading: eventsLoading,
    error: eventsError instanceof Error ? eventsError : null,
    title: `Events${isLive ? ' (live)' : ''}`,
    emptyMessage: 'No events for this job.',
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage: () => { fetchNextPage(); },
    onJumpToStart: handleJumpToStart,
    isJumpingToStart,
    onVisibleTimeChange: setVisibleEventTime,
    totalLoadedCount: jobEvents.length,
  };

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-2 flex items-center gap-1 text-sm text-gray-400">
        {isMultiProject && projectName && (
          <>
            <span className="truncate max-w-48 text-blue-500 font-medium">{projectName}</span>
            <span className="text-gray-300">/</span>
          </>
        )}
        <Link to="/jobs" className="hover:text-gray-700 transition-colors">Jobs</Link>
      </nav>

      {/* Header — shared by all layouts */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Job {job.id}</h1>
          <StatusBadge status={job.status} />

          {/* Layout switcher */}
          <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 ml-3">
            {LAYOUTS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => switchLayout(l.id)}
                className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                  layout === l.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                title={l.desc}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Vote button */}
          <button
            type="button"
            onClick={handleVote}
            className={`rounded-full px-2 py-0.5 text-[10px] transition-colors ${
              voted ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }`}
            title={`Vote for "${LAYOUTS.find((l) => l.id === layout)?.label}" layout`}
          >
            {voted ? 'Voted!' : '\u2764 Vote'}
          </button>
        </div>

      </div>

      {/* Render selected layout */}
      {(() => {
        const isCompleted = COMPLETED_JOB_STATUSES.has(job.status);
        const isTransformation = isCompleted && job.component.includes('transformation');
        const phaseBar = isCompleted
          ? isTransformation
            ? <TransformationAnalyzer job={job} events={jobEvents} currentTime={visibleEventTime} />
            : <PhaseTimeline job={job} events={jobEvents} currentTime={visibleEventTime} />
          : undefined;
        const props = { job, result, credits, backendSize, eventsProps, phaseBar };
        return (
          <>
            {layout === 'classic' && <LayoutClassic {...props} />}
            {layout === 'split' && <LayoutSplit {...props} />}
            {layout === 'terminal' && <LayoutTerminal {...props} />}
            {layout === 'dashboard' && <LayoutDashboard {...props} />}
          </>
        );
      })()}
    </div>
  );
}

// -- Shared types --

type LayoutProps = {
  job: ReturnType<typeof useJob>['data'] & {};
  result: Record<string, unknown> | null;
  credits: string;
  backendSize: string;
  phaseBar?: React.ReactNode;
  eventsProps: {
    events: import('@/api/events').KeboolaEvent[];
    isLoading: boolean;
    error: Error | null;
    title: string;
    emptyMessage: string;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    fetchNextPage?: () => void;
    onJumpToStart?: () => void;
    isJumpingToStart?: boolean;
    totalLoadedCount?: number;
    onVisibleTimeChange?: (time: string | null) => void;
  };
};

// -- Shared info bar component --

function InfoBar({ job, credits, backendSize }: { job: LayoutProps['job']; credits: string; backendSize: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm">
      <div>
        <span className="text-gray-400">Component </span>
        <Link to={`/components/${encodeURIComponent(job.component)}`} className="font-medium text-blue-600 hover:text-blue-800">
          {job.component}
        </Link>
      </div>
      <div>
        <span className="text-gray-400">Config </span>
        <Link to={`/components/${encodeURIComponent(job.component)}/${job.config}`} className="font-medium text-blue-600 hover:text-blue-800">
          {job.config}
        </Link>
      </div>
      <div><span className="text-gray-400">Duration </span><span className="font-semibold">{formatDuration(job.durationSeconds)}</span></div>
      <div><span className="text-gray-400">Credits </span><span className="font-semibold text-blue-700">{credits}</span></div>
      <div><span className="text-gray-400">Size </span><span className="font-medium">{backendSize}</span></div>
      <div><span className="text-gray-400">By </span><span className="font-medium">{job.token.description}</span></div>
      <div className="text-gray-400 text-xs">
        {job.startTime ? formatDate(job.startTime) : formatDate(job.createdTime)}
        {job.endTime && ` — ${formatDate(job.endTime)}`}
      </div>
    </div>
  );
}

// -- Result sidebar component --

function ResultPanel({ result, maxHeight }: { result: Record<string, unknown> | null; maxHeight?: string }) {
  const [showRaw, setShowRaw] = useState(false);

  if (!result || Object.keys(result).length === 0) {
    return <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-xs text-gray-400">No result.</div>;
  }

  const message = result.message as string | undefined;
  const configVersion = result.configVersion as string | undefined;
  const outputTables = ((result.output as Record<string, unknown>)?.tables as Array<Record<string, unknown>>) ?? [];
  const inputTables = ((result.input as Record<string, unknown>)?.tables as Array<Record<string, unknown>>) ?? [];
  const images = (result.images as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
        <h3 className="text-sm font-semibold text-gray-900">Result</h3>
        <button type="button" onClick={() => setShowRaw(!showRaw)} className="rounded px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100">
          {showRaw ? 'Structured' : 'JSON'}
        </button>
      </div>
      {showRaw ? (
        <pre className="overflow-auto bg-gray-900 p-3 text-xs text-green-400" style={{ maxHeight: maxHeight ?? '400px' }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : (
        <div className="divide-y divide-gray-100" style={{ maxHeight: maxHeight ?? '400px', overflowY: 'auto' }}>
          {message && (
            <div className="px-3 py-2">
              <p className="text-sm text-gray-800">{message}</p>
              {configVersion && <p className="text-[10px] text-gray-400">v{configVersion}</p>}
            </div>
          )}
          {outputTables.length > 0 && (
            <div className="px-3 py-2">
              <p className="mb-1 text-[10px] font-semibold uppercase text-gray-400">Output <span className="text-green-600">{outputTables.length}</span></p>
              {outputTables.map((t, i) => <TableRow key={i} table={t} stage="out" />)}
            </div>
          )}
          {inputTables.length > 0 && (
            <div className="px-3 py-2">
              <p className="mb-1 text-[10px] font-semibold uppercase text-gray-400">Input <span className="text-blue-600">{inputTables.length}</span></p>
              {inputTables.map((t, i) => <TableRow key={i} table={t} stage="in" />)}
            </div>
          )}
          {images.length > 0 && images.some((img) => img.id || img.digests) && (
            <div className="px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-gray-400">Image</p>
              {images.map((img, i) => {
                const label = (img.id as string) || ((img.digests as string[])?.join(', ')) || '';
                return label ? <p key={i} className="truncate font-mono text-[10px] text-gray-500" title={label}>{label}</p> : null;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TableRow({ table, stage }: { table: Record<string, unknown>; stage: 'in' | 'out' }) {
  const [exp, setExp] = useState(false);
  const name = (table.name ?? table.displayName ?? table.id ?? '') as string;
  const cols = (table.columns as Array<Record<string, unknown>>) ?? [];
  return (
    <div className="mb-0.5">
      <button type="button" onClick={() => setExp(!exp)} className="flex w-full items-center gap-1.5 rounded py-0.5 text-left hover:bg-gray-50">
        <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${stage === 'out' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>{stage}</span>
        <span className="font-mono text-xs text-gray-800">{name}</span>
        {cols.length > 0 && <span className="text-[10px] text-gray-400">{cols.length}c</span>}
        <span className={`ml-auto text-[9px] text-gray-300 ${exp ? 'rotate-90' : ''}`}>&#9656;</span>
      </button>
      {exp && cols.length > 0 && (
        <div className="ml-5 mb-1 flex flex-wrap gap-0.5">
          {cols.map((c, i) => <span key={i} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[9px] text-gray-500">{c.name as string}</span>)}
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// Layout A: Classic — cards + stacked sections (original layout)
// ==========================================================================

function LayoutClassic({ job, result, credits, eventsProps, phaseBar }: LayoutProps) {
  return (
    <>
      {/* Stats cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5">
          <p className="text-xs text-gray-500">Component</p>
          <Link to={`/components/${encodeURIComponent(job.component)}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800">{job.component}</Link>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5">
          <p className="text-xs text-gray-500">Config</p>
          <Link to={`/components/${encodeURIComponent(job.component)}/${job.config}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800">{job.config}</Link>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5">
          <p className="text-xs text-gray-500">Duration</p>
          <p className="text-sm font-semibold">{formatDuration(job.durationSeconds)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5">
          <p className="text-xs text-gray-500">Credits</p>
          <p className="text-sm font-semibold text-blue-700">{credits}</p>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5">
          <p className="text-xs text-gray-500">Created</p>
          <p className="text-xs font-semibold">{formatDate(job.createdTime)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5">
          <p className="text-xs text-gray-500">Start</p>
          <p className="text-xs font-semibold">{job.startTime ? formatDate(job.startTime) : '-'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5">
          <p className="text-xs text-gray-500">End</p>
          <p className="text-xs font-semibold">{job.endTime ? formatDate(job.endTime) : '-'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5">
          <p className="text-xs text-gray-500">By</p>
          <p className="text-xs font-semibold">{job.token.description}</p>
        </div>
      </div>

      {/* Result */}
      <div className="mb-4">
        <ResultPanel result={result} maxHeight="300px" />
      </div>

      {/* Phase timeline + Events */}
      {phaseBar}
      <EventsViewer {...eventsProps} maxHeight="400px" />
    </>
  );
}

// ==========================================================================
// Layout B: Split — events left 2/3, result right 1/3
// ==========================================================================

function LayoutSplit({ job, result, credits, backendSize, eventsProps, phaseBar }: LayoutProps) {
  return (
    <>
      <div className="mb-4">
        <InfoBar job={job} credits={credits} backendSize={backendSize} />
      </div>
      {phaseBar}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EventsViewer {...eventsProps} maxHeight="calc(100vh - 240px)" />
        </div>
        <div>
          <ResultPanel result={result} maxHeight="calc(100vh - 280px)" />
        </div>
      </div>
    </>
  );
}

// ==========================================================================
// Layout C: Terminal — events-first, minimal chrome, full width
// ==========================================================================

function LayoutTerminal({ job, result, credits, backendSize, eventsProps, phaseBar }: LayoutProps) {
  const outputTables = ((result?.output as Record<string, unknown>)?.tables as Array<Record<string, unknown>>) ?? [];
  const message = result?.message as string | undefined;

  return (
    <>
      {/* Ultra-compact info line */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-gray-500">
        <Link to={`/components/${encodeURIComponent(job.component)}`} className="text-blue-600 hover:text-blue-800">{job.component}</Link>
        <span>/</span>
        <Link to={`/components/${encodeURIComponent(job.component)}/${job.config}`} className="text-blue-600 hover:text-blue-800">{job.config}</Link>
        <span className="text-gray-300">|</span>
        <span>{formatDuration(job.durationSeconds)}</span>
        <span className="text-gray-300">|</span>
        <span className="text-blue-600">{credits} credits</span>
        <span className="text-gray-300">|</span>
        <span>{backendSize}</span>
        <span className="text-gray-300">|</span>
        <span>{job.token.description}</span>
        {message && (
          <>
            <span className="text-gray-300">|</span>
            <span className="text-gray-700">{message}</span>
          </>
        )}
        {outputTables.length > 0 && (
          <>
            <span className="text-gray-300">|</span>
            <span className="text-green-600">{outputTables.length} output tables</span>
          </>
        )}
      </div>

      {/* Phase timeline + Events — full width, maximum height */}
      {phaseBar}
      <EventsViewer {...eventsProps} maxHeight="calc(100vh - 180px)" />
    </>
  );
}

// ==========================================================================
// Layout D: Dashboard — grid cards with everything visible
// ==========================================================================

function LayoutDashboard({ job, result, credits, backendSize, eventsProps, phaseBar }: LayoutProps) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
      {/* Row 1: 4 stat cards */}
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-center">
        <p className="text-3xl font-bold">{formatDuration(job.durationSeconds)}</p>
        <p className="text-xs text-gray-500">Duration</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-center">
        <p className="text-3xl font-bold text-blue-700">{credits}</p>
        <p className="text-xs text-gray-500">Credits</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-center">
        <p className="text-3xl font-bold">{eventsProps.events.length}{eventsProps.hasNextPage ? '+' : ''}</p>
        <p className="text-xs text-gray-500">Events</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-center">
        <p className="text-3xl font-bold">{backendSize}</p>
        <p className="text-xs text-gray-500">Backend Size</p>
      </div>

      {/* Row 2: Info + Result */}
      <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-gray-400">Component</dt><dd><Link to={`/components/${encodeURIComponent(job.component)}`} className="font-medium text-blue-600">{job.component}</Link></dd></div>
          <div className="flex justify-between"><dt className="text-gray-400">Config</dt><dd><Link to={`/components/${encodeURIComponent(job.component)}/${job.config}`} className="font-medium text-blue-600">{job.config}</Link></dd></div>
          <div className="flex justify-between"><dt className="text-gray-400">Mode</dt><dd className="font-medium">{job.mode}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-400">By</dt><dd className="font-medium">{job.token.description}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-400">Created</dt><dd className="text-xs">{formatDate(job.createdTime)}</dd></div>
          {job.endTime && <div className="flex justify-between"><dt className="text-gray-400">Finished</dt><dd className="text-xs">{formatDate(job.endTime)}</dd></div>}
        </dl>
      </div>
      <div className="lg:col-span-2">
        <ResultPanel result={result} maxHeight="200px" />
      </div>

      {/* Row 3: Phase timeline + Events full width */}
      <div className="lg:col-span-4">
        {phaseBar}
        <EventsViewer {...eventsProps} maxHeight="400px" />
      </div>
    </div>
  );
}
