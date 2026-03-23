// file: pages/jobs/JobsPage.tsx
// Jobs listing with comprehensive search/filter system and sortable columns.
// All filters are URL-driven via useSearchParams for bookmarkable/shareable state.
// Used by: App.tsx route /jobs.
// Data from: hooks/useJobs.ts, hooks/useComponentLookup.ts, config/jobFilters.ts.

import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { FilterDropdown, type FilterOption } from '@/components/FilterDropdown';
import { useJobs } from '@/hooks/useJobs';
import { useComponentLookup } from '@/hooks/useComponentLookup';
import { useComponents, useConfigurations } from '@/hooks/useComponents';
import { useConnectionStore } from '@/stores/connection';
import { formatRelativeTime } from '@/lib/formatters';
import { ROUTES } from '@/lib/constants';
import { calculateJobCredits, formatCredits, getContainerSize } from '@/config/credits';
import {
  JOB_STATUS_OPTIONS,
  TIME_RANGE_PRESETS,
  DURATION_PRESETS,
  JOB_TYPE_OPTIONS,
  COMPONENT_TYPE_LABELS,
  STATUS_PILL_COLORS,
  JOBS_PAGE_SIZE,
  SORTABLE_COLUMNS,
  type SortableColumn,
} from '@/config/jobFilters';
import type { JobSearchParams } from '@/api/jobs';
import type { Job } from '@/api/schemas';

// ── URL param helpers ──────────────────────────────────────────────────

function getArrayParam(sp: URLSearchParams, key: string): string[] {
  const val = sp.get(key);
  if (!val) return [];
  return val.split(',').filter(Boolean);
}

function setArrayParam(sp: URLSearchParams, key: string, values: string[]): void {
  if (values.length === 0) {
    sp.delete(key);
  } else {
    sp.set(key, values.join(','));
  }
}

// ── Duration format ────────────────────────────────────────────────────

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds === 0) return '-';
  if (seconds < 60) return `${seconds} sec`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min < 60) return sec > 0 ? `${min} min ${sec} sec` : `${min} min`;
  const hrs = Math.floor(min / 60);
  const remainMin = min % 60;
  return `${hrs} hr ${remainMin} min`;
}

// ── Component type labels ──────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  extractor: 'Data Source',
  writer: 'Data Destination',
  application: 'Application',
  transformation: 'Transformation',
  other: '',
};

// ── Sort icon component ────────────────────────────────────────────────

function SortIcon({ direction }: { direction: 'asc' | 'desc' | null }) {
  if (!direction) {
    return (
      <svg className="ml-1 inline h-3 w-3 text-gray-300" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 1.5l3 4H3l3-4zM6 10.5l-3-4h6l-3 4z" />
      </svg>
    );
  }
  return (
    <svg className="ml-1 inline h-3 w-3 text-blue-500" viewBox="0 0 12 12" fill="currentColor">
      {direction === 'asc' ? (
        <path d="M6 2l4 5H2l4-5z" />
      ) : (
        <path d="M6 10L2 5h8l-4 5z" />
      )}
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────

export function JobsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projects = useConnectionStore((s) => s.projects);
  const isMultiProject = projects.length > 1;
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  // Read filters from URL
  const selectedStatuses = getArrayParam(searchParams, 'status');
  const selectedComponents = getArrayParam(searchParams, 'component');
  const timeRange = searchParams.get('timeRange') ?? '';
  const duration = searchParams.get('duration') ?? '';
  const searchQuery = searchParams.get('q') ?? '';
  const selectedConfigs = getArrayParam(searchParams, 'config');
  const selectedTokens = getArrayParam(searchParams, 'token');
  const selectedType = searchParams.get('type') ?? '';
  const sortParam = searchParams.get('sort') ?? '';

  // Parse sort param (format: "field:direction")
  const [sortBy, sortOrder] = useMemo((): [string, 'asc' | 'desc'] => {
    if (!sortParam) return ['createdTime', 'desc'];
    const [field, dir] = sortParam.split(':');
    return [field || 'createdTime', (dir as 'asc' | 'desc') || 'desc'];
  }, [sortParam]);

  // Build API params from URL
  const apiParams = useMemo((): JobSearchParams => {
    const params: JobSearchParams = {
      limit: JOBS_PAGE_SIZE,
      sortBy,
      sortOrder,
    };

    // Status filter
    if (selectedStatuses.length > 0) {
      params.status = selectedStatuses;
    }

    // Component filter
    if (selectedComponents.length > 0) {
      params.componentId = selectedComponents;
    }

    // Config filter
    if (selectedConfigs.length > 0) {
      params.configId = selectedConfigs;
    }

    // Token filter
    if (selectedTokens.length > 0) {
      params.tokenDescription = selectedTokens;
    }

    // Job type
    if (selectedType) {
      params.type = selectedType;
    }

    // Time range
    if (timeRange) {
      const preset = TIME_RANGE_PRESETS.find((p) => p.value === timeRange);
      if (preset) {
        const from = new Date(Date.now() - preset.hours * 3600 * 1000);
        params.createdTimeFrom = from.toISOString();
      }
    }

    // Duration range
    if (duration) {
      const preset = DURATION_PRESETS.find((p) => p.value === duration);
      if (preset) {
        params.durationSecondsFrom = preset.from;
        if (preset.to != null) {
          params.durationSecondsTo = preset.to;
        }
      }
    }

    // Search query: detect job ID vs run ID vs text
    if (searchQuery) {
      const trimmed = searchQuery.trim();
      if (/^\d+$/.test(trimmed)) {
        params.id = [trimmed];
      } else if (trimmed.includes('.')) {
        params.runId = [trimmed];
      }
      // Text search is handled client-side (filter by component/config name)
    }

    return params;
  }, [selectedStatuses, selectedComponents, selectedConfigs, selectedTokens, selectedType, timeRange, duration, searchQuery, sortBy, sortOrder]);

  // Fetch jobs
  const { data: jobs, isLoading, error } = useJobs(apiParams);
  const { data: components } = useComponents();
  const { getComponentName, getComponentType, getComponentIcon, getConfigName } = useComponentLookup();

  // Client-side text search filter (for component/config name matching)
  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    if (!searchQuery || /^\d+$/.test(searchQuery.trim()) || searchQuery.trim().includes('.')) {
      return jobs;
    }
    const q = searchQuery.toLowerCase();
    return jobs.filter((job) => {
      const compName = getComponentName(job.component).toLowerCase();
      const cfgName = job.config ? getConfigName(job.component, job.config).toLowerCase() : '';
      return compName.includes(q) || cfgName.includes(q);
    });
  }, [jobs, searchQuery, getComponentName, getConfigName]);

  // Credits total
  const totalCredits = filteredJobs.reduce(
    (sum, j) => sum + calculateJobCredits(j.durationSeconds, getContainerSize((j as Record<string, unknown>).metrics), j.component),
    0
  );

  // ── Filter option builders ───────────────────────────────────────────

  // Component options grouped by type
  const componentOptions = useMemo((): FilterOption[] => {
    if (!components) return [];
    const opts: FilterOption[] = [];
    for (const comp of components) {
      const groupLabel = COMPONENT_TYPE_LABELS[comp.type] ?? COMPONENT_TYPE_LABELS.other;
      opts.push({
        value: comp.id,
        label: comp.name,
        group: groupLabel,
        icon: comp.ico32 ?? undefined,
      });
    }
    // Sort by group then label
    opts.sort((a, b) => {
      const ga = a.group ?? '';
      const gb = b.group ?? '';
      if (ga !== gb) return ga.localeCompare(gb);
      return a.label.localeCompare(b.label);
    });
    return opts;
  }, [components]);

  // Time range options
  const timeRangeOptions = useMemo((): FilterOption[] => {
    return TIME_RANGE_PRESETS.map((p) => ({
      value: p.value,
      label: p.label,
    }));
  }, []);

  // Duration options
  const durationOptions = useMemo((): FilterOption[] => {
    return DURATION_PRESETS.map((p) => ({
      value: p.value,
      label: p.label,
    }));
  }, []);

  // Token description options (derived from loaded jobs)
  const tokenOptions = useMemo((): FilterOption[] => {
    if (!jobs) return [];
    const unique = new Set<string>();
    for (const job of jobs) {
      if (job.token.description) {
        unique.add(job.token.description);
      }
    }
    return Array.from(unique)
      .sort()
      .map((desc) => ({ value: desc, label: desc }));
  }, [jobs]);

  // Configuration options (depends on selected component — fetch configs for the first selected component)
  const singleComponentId = selectedComponents.length === 1 ? selectedComponents[0] : '';
  const { data: configs } = useConfigurations(singleComponentId ?? '');
  const configOptions = useMemo((): FilterOption[] => {
    if (!configs) return [];
    return configs.map((c) => ({ value: c.id, label: c.name || c.id }));
  }, [configs]);

  // Job type options
  const typeOptions = useMemo((): FilterOption[] => {
    return JOB_TYPE_OPTIONS.map((t) => ({ value: t.value, label: t.label }));
  }, []);

  // ── URL update helpers ───────────────────────────────────────────────

  function updateParam(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      return next;
    }, { replace: true });
  }

  function updateArrayParam(key: string, values: string[]) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      setArrayParam(next, key, values);
      return next;
    }, { replace: true });
  }

  // ── Status pill toggle ───────────────────────────────────────────────

  function toggleStatus(status: string) {
    const current = selectedStatuses;
    let next: string[];
    if (current.includes(status)) {
      next = current.filter((s) => s !== status);
    } else {
      next = [...current, status];
    }
    updateArrayParam('status', next);
  }

  // ── Sort toggle ──────────────────────────────────────────────────────

  function toggleSort(column: SortableColumn) {
    const field = SORTABLE_COLUMNS[column];
    let nextDir: 'asc' | 'desc';
    if (sortBy === field) {
      nextDir = sortOrder === 'desc' ? 'asc' : 'desc';
    } else {
      nextDir = 'desc';
    }
    updateParam('sort', `${field}:${nextDir}`);
  }

  function getSortDirection(column: SortableColumn): 'asc' | 'desc' | null {
    const field = SORTABLE_COLUMNS[column];
    if (sortBy === field) return sortOrder;
    return null;
  }

  // ── Active filter tags ───────────────────────────────────────────────

  type ActiveFilter = { key: string; label: string; onRemove: () => void };

  const activeFilters = useMemo((): ActiveFilter[] => {
    const filters: ActiveFilter[] = [];

    for (const compId of selectedComponents) {
      const name = getComponentName(compId);
      filters.push({
        key: `comp:${compId}`,
        label: `Component: ${name}`,
        onRemove: () => updateArrayParam('component', selectedComponents.filter((c) => c !== compId)),
      });
    }

    if (timeRange) {
      const preset = TIME_RANGE_PRESETS.find((p) => p.value === timeRange);
      filters.push({
        key: 'timeRange',
        label: `Time: Last ${preset?.label ?? timeRange}`,
        onRemove: () => updateParam('timeRange', ''),
      });
    }

    if (duration) {
      const preset = DURATION_PRESETS.find((p) => p.value === duration);
      filters.push({
        key: 'duration',
        label: `Duration: ${preset?.label ?? duration}`,
        onRemove: () => updateParam('duration', ''),
      });
    }

    for (const cfgId of selectedConfigs) {
      filters.push({
        key: `cfg:${cfgId}`,
        label: `Config: ${cfgId}`,
        onRemove: () => updateArrayParam('config', selectedConfigs.filter((c) => c !== cfgId)),
      });
    }

    for (const token of selectedTokens) {
      filters.push({
        key: `token:${token}`,
        label: `Triggered by: ${token}`,
        onRemove: () => updateArrayParam('token', selectedTokens.filter((t) => t !== token)),
      });
    }

    if (selectedType) {
      const typeLabel = JOB_TYPE_OPTIONS.find((t) => t.value === selectedType)?.label ?? selectedType;
      filters.push({
        key: 'type',
        label: `Type: ${typeLabel}`,
        onRemove: () => updateParam('type', ''),
      });
    }

    return filters;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedComponents, timeRange, duration, selectedConfigs, selectedTokens, selectedType, getComponentName]);

  // ── Clear all filters ────────────────────────────────────────────────

  function clearAllFilters() {
    setSearchParams({}, { replace: true });
  }

  const hasAnyFilter =
    selectedStatuses.length > 0 ||
    selectedComponents.length > 0 ||
    !!timeRange ||
    !!duration ||
    !!searchQuery ||
    selectedConfigs.length > 0 ||
    selectedTokens.length > 0 ||
    !!selectedType;

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Jobs"
        description={
          <span className="text-sm text-gray-400">
            Job execution history
            {filteredJobs.length > 0 && (
              <>
                {' '}&middot; {formatCredits(totalCredits)} credits ({filteredJobs.length} jobs shown)
              </>
            )}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                Clear filters
              </button>
            )}
            {isMultiProject && (
              <Link
                to={ROUTES.ALL_JOBS}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                All Projects
              </Link>
            )}
          </div>
        }
      />

      {/* Status pills */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {JOB_STATUS_OPTIONS.map((s) => {
          const isActive = selectedStatuses.includes(s.value);
          const pillColors = STATUS_PILL_COLORS[s.value];
          const activeClass = pillColors?.active ?? 'bg-gray-200 text-gray-700 ring-1 ring-gray-300';
          const inactiveClass = pillColors?.inactive ?? 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-600';
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => toggleStatus(s.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive ? activeClass : inactiveClass
              }`}
            >
              {s.label}
            </button>
          );
        })}
        {selectedStatuses.length > 0 && (
          <span className="ml-1 text-[10px] text-gray-400">
            {selectedStatuses.length} selected
            <button
              type="button"
              onClick={() => updateArrayParam('status', [])}
              className="ml-1 text-blue-500 hover:text-blue-700"
            >
              clear
            </button>
          </span>
        )}
      </div>

      {/* Search + filter bar */}
      <div className="mb-3 space-y-3">
        {/* Search input */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => updateParam('q', e.target.value)}
            placeholder="Search job ID, run ID, or config name..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-8 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
          />
          {/* Help tooltip */}
          {!searchQuery && (
            <div className="group absolute right-2 top-1/2 -translate-y-1/2">
              <span className="cursor-help rounded-full text-xs text-gray-300 hover:text-gray-500">?</span>
              <div className="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden w-56 rounded-lg border border-gray-200 bg-white p-2.5 text-xs text-gray-500 shadow-lg group-hover:block">
                <p className="mb-1 font-medium text-gray-700">Search examples:</p>
                <p><span className="font-mono text-blue-600">41440745</span> — job by ID</p>
                <p><span className="font-mono text-blue-600">41440745.123</span> — by run ID</p>
                <p><span className="font-mono text-blue-600">sfdc</span> — by component or config name</p>
              </div>
            </div>
          )}
          {searchQuery && (
            <button
              type="button"
              onClick={() => updateParam('q', '')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter dropdowns row */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            label="Component"
            options={componentOptions}
            selected={selectedComponents}
            onChange={(v) => {
              updateArrayParam('component', v);
              // Clear config filter when component changes
              if (v.length !== 1) updateArrayParam('config', []);
            }}
            searchable
            multiple
            grouped
          />

          {/* Configuration dropdown — visible when exactly 1 component is selected */}
          {singleComponentId && configOptions.length > 0 && (
            <FilterDropdown
              label="Configuration"
              options={configOptions}
              selected={selectedConfigs}
              onChange={(v) => updateArrayParam('config', v)}
              searchable
              multiple
            />
          )}

          <FilterDropdown
            label="Time Range"
            options={timeRangeOptions}
            selected={timeRange ? [timeRange] : []}
            onChange={(v) => updateParam('timeRange', v[0] ?? '')}
          />

          <FilterDropdown
            label="Duration"
            options={durationOptions}
            selected={duration ? [duration] : []}
            onChange={(v) => updateParam('duration', v[0] ?? '')}
          />

          <button
            type="button"
            onClick={() => setMoreFiltersOpen(!moreFiltersOpen)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
              moreFiltersOpen
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <svg
              className={`h-3 w-3 transition-transform ${moreFiltersOpen ? 'rotate-90' : ''}`}
              viewBox="0 0 12 12"
              fill="currentColor"
            >
              <path d="M4.5 2l5 4-5 4V2z" />
            </svg>
            More filters
          </button>
        </div>

        {/* Expanded "more" filters */}
        {moreFiltersOpen && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <FilterDropdown
              label="Triggered by"
              options={tokenOptions}
              selected={selectedTokens}
              onChange={(v) => updateArrayParam('token', v)}
              searchable
              multiple
            />

            <FilterDropdown
              label="Job Type"
              options={typeOptions}
              selected={selectedType ? [selectedType] : []}
              onChange={(v) => updateParam('type', v[0] ?? '')}
            />
          </div>
        )}
      </div>

      {/* Active filter tags */}
      {activeFilters.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400">Active:</span>
          {activeFilters.map((f) => (
            <span
              key={f.key}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
            >
              {f.label}
              <button
                type="button"
                onClick={f.onRemove}
                className="ml-0.5 rounded-full p-0.5 hover:bg-blue-100"
              >
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M3.05 3.05a.75.75 0 011.06 0L6 4.94l1.89-1.89a.75.75 0 111.06 1.06L7.06 6l1.89 1.89a.75.75 0 11-1.06 1.06L6 7.06 4.11 8.95a.75.75 0 01-1.06-1.06L4.94 6 3.05 4.11a.75.75 0 010-1.06z" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading jobs...</div>
      ) : (
        /* Jobs table */
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Component
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Configuration
                </th>
                <th
                  className="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 hover:text-gray-700"
                  onClick={() => toggleSort('durationSeconds')}
                >
                  Duration
                  <SortIcon direction={getSortDirection('durationSeconds')} />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Credits
                </th>
                <th
                  className="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 hover:text-gray-700"
                  onClick={() => toggleSort('createdTime')}
                >
                  Created
                  <SortIcon direction={getSortDirection('createdTime')} />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {!filteredJobs.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    {hasAnyFilter ? 'No jobs match the current filters' : 'No jobs found'}
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job: Job) => {
                  const compName = getComponentName(job.component);
                  const compType = getComponentType(job.component);
                  const compIcon = getComponentIcon(job.component);
                  const cfgName = job.config ? getConfigName(job.component, job.config) : 'Ad-hoc run';
                  const typeLabel = TYPE_LABELS[compType] ?? compType;

                  return (
                    <tr
                      key={job.id}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {compIcon && (
                            <img src={compIcon} alt="" className="h-6 w-6 rounded" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{compName}</p>
                            {typeLabel && (
                              <p className="text-xs text-gray-400">{typeLabel}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-700">{cfgName}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {formatDuration(job.durationSeconds)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-mono text-gray-600">
                        {formatCredits(calculateJobCredits(job.durationSeconds, getContainerSize((job as Record<string, unknown>).metrics), job.component))}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-600">{formatRelativeTime(job.createdTime)}</p>
                        <p className="text-xs text-gray-400">{job.token.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={job.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
