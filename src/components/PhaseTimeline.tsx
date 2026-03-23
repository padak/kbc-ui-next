// file: src/components/PhaseTimeline.tsx
// Horizontal stacked phase bar showing job execution phases with durations.
// Each phase is a colored segment with width proportional to its duration.
// Used by: pages/jobs/JobDetailPage.tsx for completed jobs.
// Displays tooltip on hover and I/O summary metrics below the bar.

import { useMemo, useState } from 'react';
import type { Job } from '@/api/schemas';
import type { KeboolaEvent } from '@/api/events';
import { detectJobPhases, computePhaseMetrics } from '@/lib/jobPhases';
import type { JobPhase } from '@/lib/jobPhases';
import { PHASE_MIN_PERCENT } from '@/config/phases';
import { formatDate, formatBytes, formatNumber } from '@/lib/formatters';

// -- Duration formatter (compact for phase labels) --

function formatPhaseDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// -- Tooltip component --

function PhaseTooltip({ phase }: { phase: JobPhase }) {
  return (
    <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-dialog">
      <p className="font-semibold text-neutral-900">{phase.label}</p>
      <p className="text-neutral-500">
        {formatDate(phase.startTime)} — {formatDate(phase.endTime)}
      </p>
      <p className="font-medium text-neutral-700">{formatPhaseDuration(phase.durationMs)}</p>
      {phase.tables && phase.tables.length > 0 && (
        <p className="mt-1 text-neutral-400">
          {phase.tables.length} table{phase.tables.length !== 1 ? 's' : ''}
          {' / '}
          {formatNumber(phase.tables.reduce((s, t) => s + (t.rowsCount ?? 0), 0))} rows
        </p>
      )}
      {/* Arrow */}
      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white" />
    </div>
  );
}

// -- Phase segment --

function PhaseSegment({ phase, percent, isLast }: { phase: JobPhase; percent: number; isLast: boolean }) {
  const [hovered, setHovered] = useState(false);
  const isWide = percent > 8;
  const isVeryWide = percent > 15;

  return (
    <div
      className={`relative flex items-center justify-center ${isLast ? 'overflow-visible' : 'overflow-hidden'} ${phase.bgClass} first:rounded-l-md last:rounded-r-md transition-opacity`}
      style={{ width: `${Math.max(percent, PHASE_MIN_PERCENT)}%` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isWide ? (
        <span className="truncate px-1 text-[10px] font-medium text-white drop-shadow-sm">
          {phase.label}
          {isVeryWide && (
            <span className="ml-1 opacity-80">{formatPhaseDuration(phase.durationMs)}</span>
          )}
        </span>
      ) : (
        <span className="whitespace-nowrap px-1 text-[10px] font-medium text-white drop-shadow-sm">
          {phase.label} {formatPhaseDuration(phase.durationMs)}
        </span>
      )}
      {hovered && <PhaseTooltip phase={phase} />}
    </div>
  );
}

// -- Main component --

type PhaseTimelineProps = {
  job: Job;
  events: KeboolaEvent[];
  /** ISO timestamp of the currently visible event in the events viewer — shows a position marker */
  currentTime?: string | null;
};

export function PhaseTimeline({ job, events, currentTime }: PhaseTimelineProps) {
  const phases = useMemo(() => detectJobPhases(job, events), [job, events]);
  const metrics = useMemo(() => computePhaseMetrics(phases), [phases]);

  if (phases.length === 0) return null;

  const totalMs = phases.reduce((sum, p) => sum + p.durationMs, 0);

  // Avoid division by zero for instant jobs
  if (totalMs === 0) return null;

  const percents = phases.map((p) => (p.durationMs / totalMs) * 100);

  // Compute position indicator from currentTime — find which phase it falls in
  const markerPercent = useMemo(() => {
    if (!currentTime) return null;
    const ct = new Date(currentTime).getTime();
    let accumulated = 0;
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i]!;
      const phaseStart = new Date(phase.startTime).getTime();
      const phaseEnd = new Date(phase.endTime).getTime();
      const phasePct = percents[i] ?? 0;

      if (ct <= phaseStart) {
        // Before this phase — clamp to start
        return accumulated;
      }
      if (ct <= phaseEnd) {
        // Inside this phase — interpolate
        const phaseRange = phaseEnd - phaseStart;
        const fraction = phaseRange > 0 ? (ct - phaseStart) / phaseRange : 0;
        return accumulated + fraction * phasePct;
      }
      accumulated += phasePct;
    }
    return 100; // After all phases
  }, [currentTime, phases, percents]);

  return (
    <div className="mb-3">
      {/* Stacked bar */}
      <div className="relative flex h-7 w-full overflow-hidden rounded-md">
        {phases.map((phase, i) => {
          const pct = percents[i] ?? 0;
          return <PhaseSegment key={phase.name} phase={phase} percent={pct} isLast={i === phases.length - 1} />;
        })}
        {/* Position indicator — vertical line showing current event position */}
        {markerPercent !== null && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-red-500 shadow-sm"
            style={{ left: `${markerPercent}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-red-500" />
          </div>
        )}
      </div>

      {/* Summary line */}
      <div className="mt-1 flex items-center gap-3 text-[10px] text-neutral-400">
        {/* Phase legend */}
        {phases.map((phase, i) => {
          const pct = percents[i] ?? 0;
          return (
            <span key={phase.name} className="flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-sm ${phase.bgClass}`} />
              <span>{phase.label}</span>
              <span className="font-medium text-neutral-500">{formatPhaseDuration(phase.durationMs)}</span>
              {pct >= 1 && (
                <span className="text-neutral-300">({Math.round(pct)}%)</span>
              )}
            </span>
          );
        })}

        {/* I/O metrics */}
        {metrics.totalTables > 0 && (
          <>
            <span className="text-neutral-200">|</span>
            <span>
              <span className="font-medium text-neutral-500">{metrics.totalTables}</span> table{metrics.totalTables !== 1 ? 's' : ''}
            </span>
            {metrics.totalRows > 0 && (
              <span>
                <span className="font-medium text-neutral-500">{formatNumber(metrics.totalRows)}</span> rows
              </span>
            )}
            {metrics.totalBytes > 0 && (
              <span>
                <span className="font-medium text-neutral-500">{formatBytes(metrics.totalBytes)}</span>
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
