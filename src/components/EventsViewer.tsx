// file: src/components/EventsViewer.tsx
// Terminal-style event log viewer. Shows events as a searchable, scrollable stream.
// Supports live polling, type/source color coding, search with Ctrl+F,
// copy all to clipboard, download as .log, expand for full JSON detail.
// Used by: EventsPage (global), JobDetailPage (per-job), TableDetailPage (per-table).

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { KeboolaEvent } from '@/api/events';

// -- Event type styles --

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  success: { bg: 'bg-green-50', text: 'text-green-700', label: 'OK' },
  error: { bg: 'bg-red-50', text: 'text-red-700', label: 'ERR' },
  warn: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'WARN' },
  info: { bg: 'bg-blue-50', text: 'text-blue-600', label: 'INFO' },
};

// Is this a storage/system event vs component event?
function isStorageEvent(event: KeboolaEvent): boolean {
  return event.component === 'storage' || event.event.startsWith('storage.');
}

// -- Format event as plain text for copy --

function eventToText(e: KeboolaEvent, includeDetails: boolean): string {
  const time = new Date(e.created).toISOString();
  const type = e.type.toUpperCase().padEnd(7);
  const comp = e.component ? ` [${e.component}]` : '';
  const msg = e.message || e.event;
  const desc = e.description ? `\n    ${e.description}` : '';
  let text = `${time} ${type}${comp} ${msg}${desc}`;
  if (includeDetails) {
    const detail: Record<string, unknown> = {};
    if (e.event) detail.event = e.event;
    if (Object.keys(e.params).length > 0) detail.params = e.params;
    if (Object.keys(e.results).length > 0) detail.results = e.results;
    if (e.performance && Object.keys(e.performance).length > 0) detail.performance = e.performance;
    if (e.token) detail.token = e.token;
    if (e.context) detail.context = e.context;
    if (Object.keys(detail).length > 0) {
      text += '\n' + JSON.stringify(detail, null, 2).split('\n').map((l) => '    ' + l).join('\n');
    }
  }
  return text;
}

// -- Helpers --

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      + '.' + String(d.getMilliseconds()).padStart(3, '0');
  } catch {
    return iso;
  }
}

function shortenComponentId(id: string): string {
  return id.replace(/^keboola\./, '');
}

// Highlight search match in text
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// -- Extract inline metrics from events for display in the row --

type InlineMetric = { label: string; value: string; color: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)}MB`;
  return `${(bytes / 1073741824).toFixed(2)}GB`;
}

function getInlineMetrics(event: KeboolaEvent): InlineMetric[] {
  const metrics: InlineMetric[] = [];
  const results = event.results as Record<string, unknown>;
  const params = event.params as Record<string, unknown>;
  const perf = event.performance as Record<string, unknown> | undefined;

  // Import done: rows, size, duration
  if (event.event === 'storage.tableImportDone' || event.event === 'storage.tableExportDone') {
    const rows = results?.rowsCount as number | undefined;
    const sizeBytes = results?.sizeBytes as number | undefined;
    const importDur = perf?.importDuration as number | undefined;
    if (rows != null) metrics.push({ label: 'rows', value: rows.toLocaleString(), color: 'text-green-600' });
    if (sizeBytes != null) metrics.push({ label: 'size', value: formatBytes(sizeBytes), color: 'text-blue-500' });
    if (importDur != null) metrics.push({ label: 'time', value: `${importDur.toFixed(1)}s`, color: 'text-gray-400' });
  }

  // Import started: columns count, file size, incremental flag
  if (event.event === 'storage.tableImportStarted') {
    const cols = params?.columns as string[] | undefined;
    if (cols?.length) metrics.push({ label: 'cols', value: String(cols.length), color: 'text-purple-500' });
    const source = params?.source as Record<string, unknown> | undefined;
    const fileSize = source?.fileSize as number | undefined;
    if (fileSize) metrics.push({ label: 'file', value: formatBytes(fileSize), color: 'text-blue-400' });
    const incremental = params?.incremental;
    if (incremental === true) metrics.push({ label: '', value: 'incr', color: 'text-orange-500' });
  }

  // File uploaded: file size
  if (event.event === 'storage.fileUploaded') {
    const fileId = params?.fileId as number | undefined;
    if (fileId) metrics.push({ label: 'id', value: String(fileId), color: 'text-gray-400' });
  }

  // Workspace created: backend type
  if (event.event === 'storage.workspaceCreated') {
    const backend = params?.backend as string | undefined;
    if (backend) metrics.push({ label: '', value: backend, color: 'text-cyan-600' });
  }

  // Waiting for N storage jobs (parse from message)
  const waitingMatch = event.message.match(/Waiting for (\d+) Storage jobs/);
  if (waitingMatch) {
    metrics.push({ label: 'pending', value: waitingMatch[1]!, color: 'text-orange-500' });
  }

  // Finished component row progress (parse from message)
  const rowMatch = event.message.match(/row (\d+) of (\d+)/);
  if (rowMatch) {
    metrics.push({ label: '', value: `${rowMatch[1]}/${rowMatch[2]}`, color: 'text-gray-400' });
  }

  return metrics;
}

// -- Mask sensitive tokens in event messages --

function maskSensitiveData(text: string): string {
  // Mask JWT/Bearer tokens (Authorization: eyJ...)
  return text.replace(/Authorization:\s*(?:Bearer\s+)?eyJ[A-Za-z0-9._-]{20,}/g, 'Authorization: [MASKED]');
}

// -- Single event row --

function EventRow({ event, search }: { event: KeboolaEvent; search: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const style = TYPE_STYLES[event.type] ?? TYPE_STYLES.info!;
  const isStorage = isStorageEvent(event);
  const message = maskSensitiveData(event.message || event.event);
  const inlineMetrics = getInlineMetrics(event);

  // Build detail object (skip empty fields)
  const detail: Record<string, unknown> = {};
  if (event.description) detail.description = event.description;
  if (event.event) detail.event = event.event;
  if (Object.keys(event.params).length > 0) detail.params = event.params;
  if (Object.keys(event.results).length > 0) detail.results = event.results;
  if (event.performance && Object.keys(event.performance).length > 0) detail.performance = event.performance;
  if (event.token) detail.token = event.token;
  if (event.context) detail.context = event.context;

  const detailJson = JSON.stringify(detail, null, 2);

  function handleCopyDetail(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(detailJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={`border-b border-gray-100 last:border-b-0 ${
      event.type === 'error' ? 'bg-red-50/30' :
      isStorage ? 'bg-neutral-50/50' : ''
    }`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-50/80 transition-colors cursor-pointer"
      >
        {/* Timestamp */}
        <span className="shrink-0 font-mono text-gray-400 tabular-nums" title={event.created}>
          {formatTime(event.created)}
        </span>

        {/* Type badge */}
        <span className={`shrink-0 rounded px-1 py-0.5 font-mono text-[10px] font-semibold ${style.bg} ${style.text}`}>
          {style.label}
        </span>

        {/* Component */}
        {event.component && (
          <span className={`shrink-0 truncate font-mono ${isStorage ? 'text-neutral-300' : 'text-gray-400'}`} style={{ maxWidth: '180px' }} title={event.component}>
            {shortenComponentId(event.component)}
          </span>
        )}

        {/* Message */}
        <span className={`min-w-0 flex-1 font-mono ${
          event.type === 'error' ? 'text-red-700' :
          isStorage ? 'text-neutral-400' : 'text-gray-800'
        }`}>
          {highlightMatch(message, search)}
        </span>

        {/* Inline metrics */}
        {inlineMetrics.length > 0 && (
          <span className="shrink-0 flex items-center gap-2 font-mono text-[10px]">
            {inlineMetrics.map((m, i) => (
              <span key={i} className={m.color} title={m.label}>
                {m.value}{m.label ? ` ${m.label}` : ''}
              </span>
            ))}
          </span>
        )}

        {/* Expand indicator */}
        <span className={`shrink-0 text-[10px] text-gray-300 transition-transform ${expanded ? 'rotate-90' : ''}`}>
          &#9656;
        </span>
      </button>

      {/* Expanded detail with copy button */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 relative">
          <button
            type="button"
            onClick={handleCopyDetail}
            className="absolute top-2 right-3 rounded bg-white border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <pre className="overflow-x-auto font-mono text-xs text-gray-600 whitespace-pre-wrap pr-16">
            {detailJson}
          </pre>
        </div>
      )}
    </div>
  );
}

// -- Main component --

type EventsViewerProps = {
  events: KeboolaEvent[];
  isLoading?: boolean;
  error?: Error | null;
  title?: string;
  showSearch?: boolean;
  maxHeight?: string;
  emptyMessage?: string;
};

export function EventsViewer({
  events,
  isLoading,
  error,
  title = 'Events',
  showSearch = true,
  maxHeight = '600px',
  emptyMessage = 'No events.',
}: EventsViewerProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'component' | 'storage'>('all');
  const [copied, setCopied] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Ctrl+F / Cmd+F focuses search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filtered = useMemo(() => {
    let result = events;
    if (typeFilter) {
      result = result.filter((e) => e.type === typeFilter);
    }
    if (sourceFilter === 'storage') {
      result = result.filter(isStorageEvent);
    } else if (sourceFilter === 'component') {
      result = result.filter((e) => !isStorageEvent(e));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.message.toLowerCase().includes(q) ||
        e.event.toLowerCase().includes(q) ||
        e.component.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        JSON.stringify(e.params).toLowerCase().includes(q),
      );
    }
    return result;
  }, [events, search, typeFilter, sourceFilter]);

  const handleCopy = useCallback((withDetails: boolean) => {
    const text = filtered.map((e) => eventToText(e, withDetails)).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [filtered]);

  const handleDownload = useCallback((withDetails: boolean) => {
    const text = filtered.map((e) => eventToText(e, withDetails)).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events-${new Date().toISOString().slice(0, 19)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  // Count by type
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    let storageCount = 0;
    let componentCount = 0;
    for (const e of events) {
      c[e.type] = (c[e.type] ?? 0) + 1;
      if (isStorageEvent(e)) storageCount++;
      else componentCount++;
    }
    return { ...c, _storage: storageCount, _component: componentCount } as Record<string, number>;
  }, [events]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <span className="text-xs text-gray-400">{filtered.length}</span>

          {/* Type filter pills */}
          <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
            {Object.entries(TYPE_STYLES).map(([type, s]) => {
              const count = counts[type] ?? 0;
              if (count === 0) return null;
              const active = typeFilter === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(active ? null : type)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                    active ? `${s.bg} ${s.text} ring-1 ring-current` : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title={`${s.label}: ${count} events`}
                >
                  {s.label} {count}
                </button>
              );
            })}
          </div>

          {/* Source filter */}
          <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
            <button
              type="button"
              onClick={() => setSourceFilter(sourceFilter === 'component' ? 'all' : 'component')}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                sourceFilter === 'component' ? 'bg-purple-50 text-purple-600 ring-1 ring-purple-300' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Component events only"
            >
              Component {counts._component}
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter(sourceFilter === 'storage' ? 'all' : 'storage')}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                sourceFilter === 'storage' ? 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-300' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Storage events only"
            >
              Storage {counts._storage}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {copied ? (
            <span className="px-2 py-1 text-[10px] text-green-600">Copied!</span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleCopy(false)}
                className="rounded px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100 transition-colors"
                title="Copy messages only"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => handleCopy(true)}
                className="rounded px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100 transition-colors"
                title="Copy with full event details (params, results, context)"
              >
                Copy+Detail
              </button>
            </>
          )}
          <span className="text-gray-200">|</span>
          <button
            type="button"
            onClick={() => handleDownload(false)}
            className="rounded px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100 transition-colors"
            title="Download messages only"
          >
            .log
          </button>
          <button
            type="button"
            onClick={() => handleDownload(true)}
            className="rounded px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100 transition-colors"
            title="Download with full event details"
          >
            .log+Detail
          </button>
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="border-b border-gray-100 px-3 py-1.5 flex items-center gap-2">
          <kbd className="rounded border border-gray-200 px-1 py-0.5 text-[9px] text-gray-400">
            {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}F
          </kbd>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="w-full bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-300"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="text-gray-300 hover:text-gray-500 text-xs">
              &#10005;
            </button>
          )}
        </div>
      )}

      {/* Event stream */}
      <div className="overflow-y-auto" style={{ maxHeight }}>
        {isLoading && events.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-gray-400">Loading events...</div>
        )}

        {error && (
          <div className="px-4 py-3 text-xs text-red-600">{error.message}</div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-gray-400">{emptyMessage}</div>
        )}

        {filtered.map((event) => (
          <EventRow key={event.uuid ?? event.id ?? event.created} event={event} search={search} />
        ))}
      </div>
    </div>
  );
}
