// file: src/components/TransformationAnalyzer.tsx
// Detailed breakdown of Snowflake transformation jobs with Gantt-style timeline.
// Collapsed by default showing a sequential phase bar; expands to per-query detail.
// Used by: pages/jobs/JobDetailPage.tsx when the job is a completed transformation.
// Colors follow design system tokens: neutral (setup/cleanup), blue (input), green (SQL), orange (output).

import { useState, useMemo } from 'react';
import type { KeboolaEvent } from '@/api/events';
import type { Job } from '@/api/schemas';
import { formatBytes, formatNumber } from '@/lib/formatters';
import {
  analyzeTransformation,
  type TransformationAnalysis,
  type SqlBlock,
} from '@/lib/transformationAnalysis';
import { TRANSFORMATION_DISPLAY, PROFILER_AI_PROMPT } from '@/config/transformation';
import { PHASE_MIN_PERCENT } from '@/config/phases';

// -- Duration formatting --

function fmtMs(ms: number): string {
  if (ms < 0) return '0s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function fmtSec(s: number | undefined): string {
  if (s == null) return '-';
  if (s < 0.1) return '<0.1s';
  if (s < 10) return `${s.toFixed(1)}s`;
  return `${Math.round(s)}s`;
}

// -- Types for Gantt segments --

type GanttSegment = {
  label: string;
  durationMs: number;
  bgClass: string;
  textClass: string;
};

function buildGanttSegments(a: TransformationAnalysis): GanttSegment[] {
  const segs: GanttSegment[] = [];

  if (a.setup && a.setup.durationMs > 0) {
    segs.push({ label: 'Setup', durationMs: a.setup.durationMs, bgClass: 'bg-neutral-300', textClass: 'text-neutral-700' });
  }

  if (a.input && a.input.durationMs > 0) {
    segs.push({ label: `Input (${a.input.tables.length})`, durationMs: a.input.durationMs, bgClass: 'bg-blue-400', textClass: 'text-white' });
  }

  // SQL blocks as individual segments
  if (a.sql) {
    for (const block of a.sql.blocks) {
      if (block.durationMs > 0) {
        const shortName = block.name.replace(/^Phase \d+\s*\/\s*/, '').substring(0, 20);
        segs.push({ label: shortName, durationMs: block.durationMs, bgClass: 'bg-green-500', textClass: 'text-white' });
      }
    }
  }

  if (a.output && a.output.durationMs > 0) {
    segs.push({ label: `Output (${a.output.tables.length})`, durationMs: a.output.durationMs, bgClass: 'bg-orange-400', textClass: 'text-white' });
  }

  if (a.cleanup && a.cleanup.durationMs > 0) {
    segs.push({ label: 'Cleanup', durationMs: a.cleanup.durationMs, bgClass: 'bg-neutral-300', textClass: 'text-neutral-700' });
  }

  return segs;
}

// -- Gantt bar --

function computeMarkerPct(
  currentTime: string | null | undefined,
  analysis: TransformationAnalysis,
  totalMs: number,
): number | null {
  if (!currentTime || totalMs === 0) return null;
  const ct = new Date(currentTime).getTime();
  const phases: Array<{ start: number; end: number; pct: number; pctOffset: number }> = [];
  let pctOffset = 0;
  const addPhase = (startTime?: string, endTime?: string, durationMs?: number) => {
    if (!startTime || !endTime || !durationMs || durationMs <= 0) return;
    const pct = (durationMs / totalMs) * 100;
    phases.push({ start: new Date(startTime).getTime(), end: new Date(endTime).getTime(), pct, pctOffset });
    pctOffset += pct;
  };
  if (analysis.setup) addPhase(analysis.setup.startTime, analysis.setup.endTime, analysis.setup.durationMs);
  if (analysis.input) addPhase(analysis.input.startTime, analysis.input.endTime, analysis.input.durationMs);
  if (analysis.sql) {
    for (const block of analysis.sql.blocks) {
      if (block.durationMs > 0) addPhase(block.startTime, block.endTime, block.durationMs);
    }
  }
  if (analysis.output) addPhase(analysis.output.startTime, analysis.output.endTime, analysis.output.durationMs);
  if (analysis.cleanup) addPhase(analysis.cleanup.startTime, analysis.cleanup.endTime, analysis.cleanup.durationMs);

  for (const p of phases) {
    if (ct <= p.start) return p.pctOffset;
    if (ct <= p.end) {
      const range = p.end - p.start;
      const frac = range > 0 ? (ct - p.start) / range : 0;
      return p.pctOffset + frac * p.pct;
    }
  }
  return 100;
}

function GanttBar({ segments, markerPct }: { segments: GanttSegment[]; markerPct: number | null }) {
  const totalMs = segments.reduce((s, seg) => s + seg.durationMs, 0);
  if (totalMs === 0) return null;

  return (
    <div className="relative flex h-6 w-full overflow-hidden rounded-md">
      {segments.map((seg, i) => {
        const pct = Math.max((seg.durationMs / totalMs) * 100, PHASE_MIN_PERCENT);
        const showLabel = pct > 6;
        return (
          <div
            key={i}
            className={`flex items-center justify-center overflow-hidden ${seg.bgClass} first:rounded-l-md last:rounded-r-md`}
            style={{ width: `${pct}%` }}
            title={`${seg.label}: ${fmtMs(seg.durationMs)}`}
          >
            {showLabel && (
              <span className={`truncate px-1 text-[9px] font-medium ${seg.textClass} drop-shadow-sm`}>
                {seg.label}
              </span>
            )}
          </div>
        );
      })}
      {/* Position marker */}
      {markerPct !== null && (
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-red-500"
          style={{ left: `${markerPct}%` }}
        >
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-red-500" />
        </div>
      )}
    </div>
  );
}

// -- Summary line --

function SummaryLine({ analysis }: { analysis: TransformationAnalysis }) {
  const parts: string[] = [];
  if (analysis.setup) parts.push(`Setup ${fmtMs(analysis.setup.durationMs)}`);
  if (analysis.input) parts.push(`Input ${fmtMs(analysis.input.durationMs)} (${analysis.input.tables.length} tables)`);
  if (analysis.sql) parts.push(`SQL ${fmtMs(analysis.sql.durationMs)} (${analysis.sql.blocks.length} blocks, ${analysis.sql.totalQueries} queries)`);
  if (analysis.output) parts.push(`Output ${fmtMs(analysis.output.durationMs)} (${analysis.output.tables.length} tables)`);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-neutral-400">
      {parts.map((p, i) => (
        <span key={i}>{p}</span>
      ))}
    </div>
  );
}

// -- Chevron --

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <span className={`inline-block text-[10px] text-neutral-400 transition-transform ${expanded ? 'rotate-90' : ''}`}>
      &#9656;
    </span>
  );
}

// -- Duration bar --

// DurationBar removed — replaced by sequential Gantt bars in each section

// -- Detail sections --

function InputDetail({ analysis }: { analysis: TransformationAnalysis }) {
  const [showAll, setShowAll] = useState(false);
  if (!analysis.input) return null;

  // Keep chronological order (as they were cloned sequentially)
  const tables = analysis.input.tables;
  const totalDur = tables.reduce((s, t) => s + (t.durationSeconds ?? 0), 0);
  const visible = showAll ? tables : tables.slice(0, TRANSFORMATION_DISPLAY.defaultVisibleTables);

  return (
    <div className="mt-2">
      <h4 className="mb-1 text-xs font-medium text-blue-700">
        Input ({tables.length} tables, {analysis.input.cloneCount} cloned{analysis.input.copyCount > 0 ? `, ${analysis.input.copyCount} copied` : ''})
      </h4>
      {/* Mini sequential Gantt for input tables */}
      {totalDur > 0 && (
        <div className="mb-1.5 flex h-4 w-full overflow-hidden rounded">
          {tables.map((t, i) => {
            const pct = totalDur > 0 ? ((t.durationSeconds ?? 0) / totalDur) * 100 : 0;
            if (pct < 0.5) return null;
            return (
              <div
                key={i}
                className={`${t.method === 'copy' ? 'bg-blue-600' : 'bg-blue-400'} border-r border-blue-300/50`}
                style={{ width: `${Math.max(pct, 0.5)}%` }}
                title={`${t.name} (${t.method}) ${fmtSec(t.durationSeconds)}`}
              />
            );
          })}
        </div>
      )}
      <div className="space-y-0.5">
        {visible.map((t, i) => (
          <div key={i} className="flex items-center gap-2 font-mono text-[11px] flex-nowrap">
            <span className="w-36 min-w-0 shrink-0 truncate text-neutral-600" title={t.source}>{t.name}</span>
            <span className={`w-8 shrink-0 whitespace-nowrap text-right ${t.method === 'copy' ? 'text-blue-600 font-medium' : 'text-neutral-400'}`}>{t.method}</span>
            <span className="w-12 shrink-0 whitespace-nowrap text-right text-neutral-500">{fmtSec(t.durationSeconds)}</span>
          </div>
        ))}
      </div>
      {tables.length > TRANSFORMATION_DISPLAY.defaultVisibleTables && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="mt-1 text-[10px] text-blue-600 hover:text-blue-800">
          {showAll ? 'Show less' : `Show all ${tables.length} tables`}
        </button>
      )}
    </div>
  );
}

function SqlDetail({ analysis }: { analysis: TransformationAnalysis }) {
  if (!analysis.sql) return null;

  const { blocks } = analysis.sql;
  const slowestIdx = blocks.reduce((mi, b, i, arr) => b.durationMs > (arr[mi]?.durationMs ?? 0) ? i : mi, 0);

  return (
    <div className="mt-2">
      <h4 className="mb-1 text-xs font-medium text-green-700">
        SQL Execution ({blocks.length} blocks, {analysis.sql.totalQueries} queries)
      </h4>
      <div className="space-y-1">
        {blocks.map((block, i) => (
          <SqlBlockDetail key={i} block={block} isSlowest={blocks.length > 1 && i === slowestIdx} />
        ))}
      </div>
    </div>
  );
}

function SqlBlockDetail({ block, isSlowest }: { block: SqlBlock; isSlowest: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? block.queries : block.queries.slice(0, TRANSFORMATION_DISPLAY.defaultVisibleQueries);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-neutral-50"
      >
        <Chevron expanded={expanded} />
        <span className="font-medium text-neutral-700 truncate">{block.name}</span>
        <span className="font-mono text-neutral-500">{fmtMs(block.durationMs)}</span>
        <span className="text-neutral-400">{block.queries.length}q</span>
        {isSlowest && (
          <span className="ml-auto rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-medium text-orange-700">SLOWEST</span>
        )}
      </button>
      {expanded && (
        <div className="ml-5 mt-0.5">
          {visible.map((q, i) => {
            const label = q.tableName
              ? `${q.sql.match(/^\w+/)?.[0] ?? ''} ${q.tableName}`
              : q.sql.substring(0, 50);
            // Staircase: cumulative offset from all previous queries
            let cumMs = 0;
            const source = showAll ? block.queries : visible;
            for (let j = 0; j < i; j++) cumMs += source[j]?.durationMs ?? 0;
            const totalBlockMs = source.reduce((s, qq) => s + qq.durationMs, 0) || 1;
            const offsetPct = (cumMs / totalBlockMs) * 100;
            const widthPct = Math.max((q.durationMs / totalBlockMs) * 100, 0.5);

            return (
              <div key={i} className="flex items-center gap-0 text-[11px] font-mono flex-nowrap" title={q.sql}>
                <span className="w-48 min-w-0 shrink-0 truncate pr-1 text-neutral-600">{label}</span>
                <span className="w-14 shrink-0 whitespace-nowrap text-right text-neutral-500">{fmtMs(q.durationMs)}</span>
                <div className="relative ml-1 h-4 flex-1">
                  <div
                    className="absolute top-0.5 h-3 rounded-sm bg-green-400"
                    style={{ left: `${offsetPct}%`, width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {block.queries.length > TRANSFORMATION_DISPLAY.defaultVisibleQueries && (
            <button type="button" onClick={() => setShowAll(!showAll)} className="mt-0.5 text-[10px] text-green-600 hover:text-green-800">
              {showAll ? 'Show less' : `Show all ${block.queries.length} queries`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function OutputDetail({ analysis }: { analysis: TransformationAnalysis }) {
  const [showAll, setShowAll] = useState(false);
  if (!analysis.output) return null;

  // Sort by duration descending for the list (biggest impact first)
  const sorted = useMemo(
    () => [...analysis.output!.tables].sort((a, b) => (b.durationSeconds ?? 0) - (a.durationSeconds ?? 0)),
    [analysis.output],
  );
  const visible = showAll ? sorted : sorted.slice(0, TRANSFORMATION_DISPLAY.defaultVisibleTables);
  const totalRows = sorted.reduce((s, t) => s + (t.rowsCount ?? 0), 0);
  const totalBytes = sorted.reduce((s, t) => s + (t.sizeBytes ?? 0), 0);

  return (
    <div className="mt-2">
      <h4 className="mb-1 text-xs font-medium text-orange-700">
        Output ({fmtMs(analysis.output.durationMs)}) — {analysis.output.tables.length} tables{totalRows > 0 ? `, ${formatNumber(totalRows)} rows` : ''}{totalBytes > 0 ? `, ${formatBytes(totalBytes)}` : ''}
        <span className="ml-1 font-normal text-neutral-400">(parallel)</span>
      </h4>
      <table className="w-full text-[11px] font-mono">
        <thead>
          <tr className="text-left text-[9px] uppercase tracking-wider text-neutral-400">
            <th className="pb-0.5 font-medium">Table</th>
            <th className="pb-0.5 text-right font-medium">Time</th>
            <th className="pb-0.5 text-right font-medium">Rows</th>
            <th className="pb-0.5 text-right font-medium">Size</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((t, i) => (
            <tr key={i} className="border-t border-neutral-50">
              <td className="max-w-[200px] truncate py-0.5 text-neutral-600" title={t.name}>{t.name}</td>
              <td className="py-0.5 text-right text-neutral-500">{fmtSec(t.durationSeconds)}</td>
              <td className="py-0.5 text-right text-neutral-400">{t.rowsCount != null ? formatNumber(t.rowsCount) : '-'}</td>
              <td className="py-0.5 text-right text-neutral-400">{t.sizeBytes != null ? formatBytes(t.sizeBytes) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length > TRANSFORMATION_DISPLAY.defaultVisibleTables && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="mt-1 text-[10px] text-orange-600 hover:text-orange-800">
          {showAll ? 'Show less' : `Show all ${sorted.length} tables`}
        </button>
      )}
    </div>
  );
}

// -- Profiler text export --

function profilerHeader(job: Job, analysis: TransformationAnalysis): string {
  const lines: string[] = [];
  lines.push(`# Keboola Job Profiler`);
  lines.push(`Job ID: ${job.id}`);
  lines.push(`Component: ${job.component}`);
  lines.push(`Config: ${job.config ?? '-'}`);
  lines.push(`Status: ${job.status}`);
  lines.push(`Total duration: ${fmtMs(analysis.totalDurationMs || (job.durationSeconds ?? 0) * 1000)}`);
  lines.push(`Created: ${job.createdTime}`);
  if (job.startTime) lines.push(`Started: ${job.startTime}`);
  if (job.endTime) lines.push(`Ended: ${job.endTime}`);
  lines.push('');
  return lines.join('\n');
}

function profilerPhases(analysis: TransformationAnalysis): string {
  const lines: string[] = ['## Phase Breakdown', ''];
  const total = analysis.totalDurationMs || 1;
  const phase = (name: string, p: { durationMs: number } | null, extra?: string) => {
    if (!p) return;
    const pct = ((p.durationMs / total) * 100).toFixed(1);
    lines.push(`- ${name}: ${fmtMs(p.durationMs)} (${pct}%)${extra ? ' ' + extra : ''}`);
  };
  phase('Setup', analysis.setup);
  phase('Input', analysis.input, analysis.input ? `— ${analysis.input.tables.length} tables (${analysis.input.cloneCount} cloned, ${analysis.input.copyCount} copied)` : undefined);
  phase('SQL Execution', analysis.sql, analysis.sql ? `— ${analysis.sql.blocks.length} blocks, ${analysis.sql.totalQueries} queries` : undefined);
  phase('Output', analysis.output, analysis.output ? `— ${analysis.output.tables.length} tables` : undefined);
  phase('Cleanup', analysis.cleanup);
  lines.push('');
  return lines.join('\n');
}

function profilerInputTables(analysis: TransformationAnalysis): string {
  if (!analysis.input || analysis.input.tables.length === 0) return '';
  const lines: string[] = ['## Input Tables', ''];
  const sorted = [...analysis.input.tables].sort((a, b) => (b.durationSeconds ?? 0) - (a.durationSeconds ?? 0));
  for (const t of sorted) {
    lines.push(`- ${t.name} (${t.method}) ${fmtSec(t.durationSeconds)} — source: ${t.source}`);
  }
  lines.push('');
  return lines.join('\n');
}

function profilerSqlSummary(analysis: TransformationAnalysis): string {
  if (!analysis.sql) return '';
  const lines: string[] = ['## SQL Blocks', ''];
  for (const block of analysis.sql.blocks) {
    lines.push(`### ${block.name} — ${fmtMs(block.durationMs)} (${block.queries.length} queries)`);
    for (const q of block.queries) {
      const label = q.tableName ?? q.sql.substring(0, 60).replace(/\n/g, ' ');
      lines.push(`  - ${label}: ${fmtMs(q.durationMs)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function profilerSqlDetailed(analysis: TransformationAnalysis): string {
  if (!analysis.sql) return '';
  const lines: string[] = ['## SQL Queries (detailed)', ''];
  for (const block of analysis.sql.blocks) {
    lines.push(`### ${block.name} — ${fmtMs(block.durationMs)} (${block.queries.length} queries)`);
    lines.push('');
    for (let i = 0; i < block.queries.length; i++) {
      const q = block.queries[i]!;
      lines.push(`**Query ${i + 1}** — ${fmtMs(q.durationMs)}${q.tableName ? ` (table: ${q.tableName})` : ''}`);
      lines.push('```sql');
      lines.push(q.fullSql);
      lines.push('```');
      lines.push('');
    }
  }
  return lines.join('\n');
}

function profilerOutputTables(analysis: TransformationAnalysis): string {
  if (!analysis.output || analysis.output.tables.length === 0) return '';
  const lines: string[] = ['## Output Tables', ''];
  const sorted = [...analysis.output.tables].sort((a, b) => (b.durationSeconds ?? 0) - (a.durationSeconds ?? 0));
  for (const t of sorted) {
    const parts = [t.name];
    if (t.durationSeconds != null) parts.push(fmtSec(t.durationSeconds));
    if (t.rowsCount != null) parts.push(`${formatNumber(t.rowsCount)} rows`);
    if (t.sizeBytes != null) parts.push(formatBytes(t.sizeBytes));
    lines.push(`- ${parts.join(' — ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

/** Compact summary — quick stats for clipboard */
function generateProfilerSummary(job: Job, analysis: TransformationAnalysis): string {
  return [
    profilerHeader(job, analysis),
    profilerPhases(analysis),
    profilerInputTables(analysis),
    profilerSqlSummary(analysis),
    profilerOutputTables(analysis),
  ].join('');
}

/** Detailed export with AI prompt preamble */
function generateProfilerDetail(job: Job, analysis: TransformationAnalysis): string {
  return [
    PROFILER_AI_PROMPT,
    '---\n\n',
    profilerHeader(job, analysis),
    profilerPhases(analysis),
    profilerInputTables(analysis),
    profilerSqlDetailed(analysis),
    profilerOutputTables(analysis),
  ].join('');
}

// -- Copy button with feedback --

function CopyButton({ label, getText }: { label: string; getText: () => string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: download as file
      const blob = new Blob([getText()], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'job-profiler.md';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleCopy}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCopy(e as unknown as React.MouseEvent); }}
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
        copied
          ? 'bg-green-100 text-green-700'
          : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
      }`}
    >
      {copied ? 'Copied!' : label}
    </span>
  );
}

// -- Main component --

type TransformationAnalyzerProps = {
  job: Job;
  events: KeboolaEvent[];
  currentTime?: string | null;
  /** Whether more event pages are available (not all loaded yet) */
  hasMoreEvents?: boolean;
  /** Callback to load all remaining events */
  onLoadAllEvents?: () => void;
  /** Whether events are currently being bulk-loaded */
  isLoadingAllEvents?: boolean;
};

export function TransformationAnalyzer({ job, events, currentTime, hasMoreEvents, onLoadAllEvents, isLoadingAllEvents }: TransformationAnalyzerProps) {
  const [expanded, setExpanded] = useState(false);
  const analysis = useMemo(() => analyzeTransformation(job, events), [job, events]);
  const segments = useMemo(() => buildGanttSegments(analysis), [analysis]);
  const totalSegMs = segments.reduce((s, seg) => s + seg.durationMs, 0);
  const markerPct = useMemo(
    () => computeMarkerPct(currentTime, analysis, totalSegMs),
    [currentTime, analysis, totalSegMs],
  );

  const hasDetail = analysis.isTransformation && segments.length > 0;
  const partialEvents = events.length > 0 && !analysis.isTransformation;

  return (
    <div className="mb-3 rounded-lg border border-neutral-200 bg-white">
      {/* Collapsed view: Gantt bar + summary, click to expand */}
      <button
        type="button"
        onClick={() => hasDetail && setExpanded(!expanded)}
        className={`w-full px-3 py-2 text-left ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasDetail && <Chevron expanded={expanded} />}
            <span className="text-xs font-medium text-neutral-700">Transformation Analysis</span>
            {hasDetail && !expanded && (
              <span className="text-[10px] text-neutral-400">click for detail</span>
            )}
          </div>
          <span className="flex items-center gap-2">
            {hasDetail && (
              <>
                <CopyButton label="Copy Stats" getText={() => generateProfilerSummary(job, analysis)} />
                <CopyButton label="Copy for AI" getText={() => generateProfilerDetail(job, analysis)} />
              </>
            )}
            <span className="font-mono text-[11px] text-neutral-500">
              {fmtMs(analysis.totalDurationMs || ((job.durationSeconds ?? 0) * 1000))}
            </span>
          </span>
        </div>
        {hasDetail ? (
          <>
            <GanttBar segments={segments} markerPct={markerPct} />
            <div className="mt-1">
              <SummaryLine analysis={analysis} />
            </div>
          </>
        ) : (
          <div className="text-[10px] text-neutral-400">
            {events.length === 0
              ? 'Loading events...'
              : partialEvents
                ? (
                  <span className="flex items-center gap-2">
                    <span>All events needed for detailed phase breakdown.</span>
                    {isLoadingAllEvents ? (
                      <span className="text-neutral-500">Loading events...</span>
                    ) : hasMoreEvents && onLoadAllEvents ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); onLoadAllEvents(); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onLoadAllEvents(); } }}
                        className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        Load All Events
                      </span>
                    ) : null}
                  </span>
                )
                : 'No phase data available'}
          </div>
        )}
      </button>

      {/* Expanded: detailed sections */}
      {expanded && hasDetail && (
        <div className="border-t border-neutral-100 px-3 pb-3">
          <InputDetail analysis={analysis} />
          <SqlDetail analysis={analysis} />
          <OutputDetail analysis={analysis} />
        </div>
      )}
    </div>
  );
}
