// file: src/components/EventsViewer.tsx
// Terminal-style event log viewer. Shows events as a searchable, scrollable stream.
// Supports live polling (new events appear at top), type-based color coding,
// copy all to clipboard, and expand individual events for full detail.
// Used by: EventsPage (global), JobDetailPage (per-job), TableDetailPage (per-table).
// Design: clean monospace log, not a table. Optimized for data engineers.

import { useState, useMemo, useRef, useCallback } from 'react';
import type { KeboolaEvent } from '@/api/events';
// formatDate available but using custom formatTime for compact display

// -- Event type colors --

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  success: { bg: 'bg-green-50', text: 'text-green-700', label: 'OK' },
  error: { bg: 'bg-red-50', text: 'text-red-700', label: 'ERR' },
  warn: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'WARN' },
  info: { bg: 'bg-blue-50', text: 'text-blue-600', label: 'INFO' },
};

// -- Format event as plain text for copy --

function eventToText(e: KeboolaEvent): string {
  const time = new Date(e.created).toISOString();
  const type = e.type.toUpperCase().padEnd(7);
  const comp = e.component ? ` [${e.component}]` : '';
  const msg = e.message || e.event;
  const desc = e.description ? `\n    ${e.description}` : '';
  return `${time} ${type}${comp} ${msg}${desc}`;
}

// -- Single event row --

function EventRow({ event }: { event: KeboolaEvent }) {
  const [expanded, setExpanded] = useState(false);
  const style = TYPE_STYLES[event.type] ?? TYPE_STYLES.info!;
  const hasDetails = event.description || Object.keys(event.params).length > 0 || Object.keys(event.results).length > 0;

  return (
    <div className={`border-b border-gray-100 last:border-b-0 ${event.type === 'error' ? 'bg-red-50/30' : ''}`}>
      <button
        type="button"
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={`flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-50 transition-colors ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
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
          <span className="shrink-0 truncate font-mono text-gray-400" style={{ maxWidth: '180px' }} title={event.component}>
            {shortenComponentId(event.component)}
          </span>
        )}

        {/* Message */}
        <span className={`min-w-0 flex-1 font-mono ${event.type === 'error' ? 'text-red-700' : 'text-gray-800'}`}>
          {event.message || event.event}
        </span>

        {/* Expand indicator */}
        {hasDetails && (
          <span className={`shrink-0 text-gray-300 transition-transform ${expanded ? 'rotate-90' : ''}`}>
            &#9656;
          </span>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 font-mono text-xs">
          {event.description && (
            <div className="mb-2 whitespace-pre-wrap text-gray-600">{event.description}</div>
          )}
          {Object.keys(event.params).length > 0 && (
            <div className="mb-2">
              <span className="text-gray-400">params: </span>
              <pre className="mt-0.5 overflow-x-auto rounded bg-white p-2 text-gray-700 border border-gray-200">
                {JSON.stringify(event.params, null, 2)}
              </pre>
            </div>
          )}
          {Object.keys(event.results).length > 0 && (
            <div className="mb-2">
              <span className="text-gray-400">results: </span>
              <pre className="mt-0.5 overflow-x-auto rounded bg-white p-2 text-gray-700 border border-gray-200">
                {JSON.stringify(event.results, null, 2)}
              </pre>
            </div>
          )}
          {event.performance && Object.keys(event.performance).length > 0 && (
            <div>
              <span className="text-gray-400">performance: </span>
              <pre className="mt-0.5 overflow-x-auto rounded bg-white p-2 text-gray-700 border border-gray-200">
                {JSON.stringify(event.performance, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
  // keboola.ex-db-mysql -> ex-db-mysql
  return id.replace(/^keboola\./, '');
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
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let result = events;
    if (typeFilter) {
      result = result.filter((e) => e.type === typeFilter);
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
  }, [events, search, typeFilter]);

  const handleCopyAll = useCallback(() => {
    const text = filtered.map(eventToText).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [filtered]);

  const handleDownload = useCallback(() => {
    const text = filtered.map(eventToText).join('\n');
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
    for (const e of events) c[e.type] = (c[e.type] ?? 0) + 1;
    return c;
  }, [events]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <span className="text-xs text-gray-400">{filtered.length} events</span>

          {/* Type filter pills */}
          <div className="flex items-center gap-1">
            {Object.entries(TYPE_STYLES).map(([type, style]) => {
              const count = counts[type] ?? 0;
              if (count === 0) return null;
              const active = typeFilter === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(active ? null : type)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                    active ? `${style.bg} ${style.text} ring-1 ring-current` : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {style.label} {count}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyAll}
            className="rounded px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy All'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="rounded px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100 transition-colors"
          >
            Download .log
          </button>
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="border-b border-gray-100 px-3 py-1.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events... (message, component, params)"
            className="w-full bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-300"
          />
        </div>
      )}

      {/* Event stream */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight }}>
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
          <EventRow key={event.uuid ?? event.id ?? event.created} event={event} />
        ))}
      </div>
    </div>
  );
}
