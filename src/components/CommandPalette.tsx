// file: components/CommandPalette.tsx
// Global search modal triggered by Cmd+K / Ctrl+K.
// Searches across all registered projects' cached metadata.
// Used by: AppLayout.tsx (always rendered, hidden until activated).
// Keyboard: arrows to navigate, Enter to select, Esc to close.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useConnectionStore } from '@/stores/connection';
import { useGlobalSearch, type SearchResult } from '@/hooks/useGlobalSearch';

const TYPE_ICONS: Record<string, string> = {
  bucket: '\u26C1',
  component: '\u29BB',
  configuration: '\u2699',
};

const TYPE_COLORS: Record<string, string> = {
  bucket: 'bg-green-50 text-green-700',
  component: 'bg-blue-50 text-blue-700',
  configuration: 'bg-purple-50 text-purple-700',
};

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const setActiveProject = useConnectionStore((s) => s.setActiveProject);
  const projects = useConnectionStore((s) => s.projects);

  const results = useGlobalSearch(query);

  // Cmd+K / Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setActiveProject(result.projectId);
      navigate(result.navigateTo);
      setIsOpen(false);
    },
    [setActiveProject, navigate],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="kbc-command-backdrop fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="kbc-command-dialog w-full max-w-xl rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center border-b border-gray-200 px-4">
          <span className="text-gray-400 mr-2">&#128269;</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Search across ${projects.length} project${projects.length !== 1 ? 's' : ''}...`}
            className="flex-1 border-0 bg-transparent py-3 text-sm outline-none placeholder:text-gray-400"
          />
          <kbd className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-400">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {query.length < 2 ? (
            <p className="px-4 py-8 text-center text-xs text-gray-400">
              Type at least 2 characters to search
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-gray-400">
              No results for &quot;{query}&quot;
            </p>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.projectId}-${result.type}-${result.id}`}
                onClick={() => handleSelect(result)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                  index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <span className="text-base">{TYPE_ICONS[result.type] ?? '?'}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-900">{result.name}</p>
                  <p className="truncate text-xs text-gray-400">{result.detail}</p>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_COLORS[result.type] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {result.type}
                </span>
                <span className="shrink-0 truncate max-w-[120px] text-[10px] text-gray-400">
                  {result.projectName}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4 text-[10px] text-gray-400">
          <span>
            <kbd className="rounded border border-gray-200 px-1 py-0.5">&#8593;&#8595;</kbd>{' '}
            navigate
          </span>
          <span>
            <kbd className="rounded border border-gray-200 px-1 py-0.5">&#9166;</kbd> select
          </span>
          <span>
            <kbd className="rounded border border-gray-200 px-1 py-0.5">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
