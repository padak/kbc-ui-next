// file: components/DataTable.tsx
// Generic data table with sorting, search, and loading states.
// Accepts typed columns and rows - no business logic here.
// Used by: BucketsPage, ComponentsPage, JobsPage, ConfigurationsPage.
// Tailwind-styled, no external table library needed.

import { useState, useMemo, type ReactNode } from 'react';

type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyFn: (row: T) => string;
  searchFn?: (row: T, query: string) => boolean;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
};

export function DataTable<T>({
  columns,
  data,
  keyFn,
  searchFn,
  onRowClick,
  emptyMessage = 'No data',
  isLoading = false,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    let rows = data;
    if (search && searchFn) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => searchFn(r, q));
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        const sv = col.sortValue;
        rows = [...rows].sort((a, b) => {
          const va = sv(a);
          const vb = sv(b);
          const cmp = va < vb ? -1 : va > vb ? 1 : 0;
          return sortAsc ? cmp : -cmp;
        });
      }
    }
    return rows;
  }, [data, search, searchFn, sortKey, sortAsc, columns]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div>
      {searchFn && (
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortValue && handleSort(col.key)}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 ${
                    col.sortValue ? 'cursor-pointer select-none hover:text-gray-700' : ''
                  }`}
                >
                  {col.label}
                  {sortKey === col.key && (sortAsc ? ' \u2191' : ' \u2193')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={keyFn(row)}
                  onClick={() => onRowClick?.(row)}
                  className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
