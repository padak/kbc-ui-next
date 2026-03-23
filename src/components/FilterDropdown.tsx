// file: components/FilterDropdown.tsx
// Generic dropdown component for filter controls: searchable, single/multi-select, grouped.
// Renders a trigger button with badge + a positioned dropdown panel.
// Used by: JobsPage for Component, Time Range, Duration, Config, Token, Type filters.
// Click outside or Escape closes the dropdown.

import { useState, useRef, useEffect, useMemo } from 'react';

export type FilterOption = {
  value: string;
  label: string;
  group?: string;
  icon?: string;
};

type FilterDropdownProps = {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  searchable?: boolean;
  multiple?: boolean;
  grouped?: boolean;
};

export function FilterDropdown({
  label,
  options,
  selected,
  onChange,
  searchable = false,
  multiple = false,
  grouped = false,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  // Focus search on open
  useEffect(() => {
    if (open && searchable && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open, searchable]);

  // Filter options by search
  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, search]);

  // Group options
  const groups = useMemo(() => {
    if (!grouped) return null;
    const map = new Map<string, FilterOption[]>();
    for (const opt of filtered) {
      const g = opt.group ?? '';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(opt);
    }
    return map;
  }, [filtered, grouped]);

  function handleSelect(value: string) {
    if (multiple) {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        onChange([...selected, value]);
      }
    } else {
      // Single select: toggle off if already selected
      if (selected.includes(value)) {
        onChange([]);
      } else {
        onChange([value]);
      }
      setOpen(false);
      setSearch('');
    }
  }

  const hasSelection = selected.length > 0;
  const triggerLabel = hasSelection
    ? `${label} (${selected.length})`
    : label;

  function renderOption(opt: FilterOption) {
    const isSelected = selected.includes(opt.value);
    return (
      <button
        key={opt.value}
        type="button"
        onClick={() => handleSelect(opt.value)}
        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
          isSelected
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        {multiple && (
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
              isSelected
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-gray-300'
            }`}
          >
            {isSelected && (
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        )}
        {opt.icon && (
          <img src={opt.icon} alt="" className="h-4 w-4 rounded" />
        )}
        <span className="truncate">{opt.label}</span>
      </button>
    );
  }

  function renderGrouped() {
    if (!groups) return null;
    const entries = Array.from(groups.entries());
    return entries.map(([groupName, opts]) => (
      <div key={groupName}>
        {groupName && (
          <div className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-gray-400">
            {groupName}
          </div>
        )}
        {opts.map(renderOption)}
      </div>
    ));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
          hasSelection
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <span>{triggerLabel}</span>
        <svg
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {searchable && (
            <div className="border-b border-gray-100 p-2">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
            ) : grouped ? (
              renderGrouped()
            ) : (
              filtered.map(renderOption)
            )}
          </div>
          {multiple && selected.length > 0 && (
            <div className="border-t border-gray-100 p-2">
              <button
                type="button"
                onClick={() => {
                  onChange([]);
                  setSearch('');
                }}
                className="w-full rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
