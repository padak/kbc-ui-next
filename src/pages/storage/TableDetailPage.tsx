// file: pages/storage/TableDetailPage.tsx
// Table detail: shows columns, metadata, and data preview.
// Displays table stats (rows, size, primary key) in header.
// Used by: App.tsx route /storage/:bucketId/:tableId.
// Data from: hooks/useStorage.ts (useTable, useTablePreview).

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { useTable, useTablePreview } from '@/hooks/useStorage';
import { formatBytes, formatNumber, formatDate } from '@/lib/formatters';

function DataPreview({ tableId, columns }: { tableId: string; columns: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, error } = useTablePreview(expanded ? tableId : '');

  // Parse response: API returns { rows: [{ col1: val1, ... }, ...] } or array directly
  const rows = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.rows)) return obj.rows as Array<Record<string, unknown>>;
    return [];
  })();

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900"
      >
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
        Data Preview
        {rows.length > 0 && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            {rows.length} rows
          </span>
        )}
      </button>

      {expanded && isLoading && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
          Loading data preview...
        </div>
      )}

      {expanded && error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>
      )}

      {expanded && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {columns.map((col) => {
                    const val = row[col];
                    const text = val === null ? 'NULL' : String(val ?? '');
                    const isNull = val === null;
                    return (
                      <td
                        key={col}
                        className={`max-w-xs truncate whitespace-nowrap px-3 py-1.5 font-mono text-xs ${
                          isNull ? 'italic text-gray-300' : 'text-gray-700'
                        }`}
                        title={text}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {expanded && !isLoading && !error && rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
          No data in this table.
        </div>
      )}
    </div>
  );
}

export function TableDetailPage() {
  const { bucketId, tableId } = useParams<{ bucketId: string; tableId: string }>();
  const navigate = useNavigate();
  const { data: table, isLoading, error } = useTable(tableId ?? '');

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-gray-400">Loading table...</div>;
  }

  if (error) {
    return <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>;
  }

  if (!table) return null;

  return (
    <div>
      <PageHeader
        title={table.displayName || table.name}
        description={table.bucket ? `${table.bucket.stage}.${table.bucket.name}` : ''}
        actions={
          <button
            onClick={() => navigate(`/storage/${encodeURIComponent(bucketId ?? '')}`)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Back to Bucket
          </button>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Rows</p>
          <p className="text-lg font-semibold">{formatNumber(table.rowsCount)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Size</p>
          <p className="text-lg font-semibold">{formatBytes(table.dataSizeBytes)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Columns</p>
          <p className="text-lg font-semibold">{table.columns.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Primary Key</p>
          <p className="text-lg font-semibold">{table.primaryKey.length > 0 ? table.primaryKey.join(', ') : 'None'}</p>
        </div>
      </div>

      {/* Columns */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Columns</h2>
      <div className="mb-6 overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">PK</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {table.columns.map((col, i) => (
              <tr key={col}>
                <td className="px-4 py-2 text-sm text-gray-400">{i + 1}</td>
                <td className="px-4 py-2 text-sm font-mono text-gray-700">{col}</td>
                <td className="px-4 py-2 text-sm">
                  {table.primaryKey.includes(col) && (
                    <span className="rounded bg-yellow-50 px-1.5 py-0.5 text-xs text-yellow-700">PK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Data Preview */}
      <DataPreview tableId={tableId ?? ''} columns={table.columns} />

      {/* Metadata */}
      {table.metadata.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Metadata</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {table.metadata.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-700">{m.key}</td>
                    <td className="max-w-md truncate px-4 py-2 text-sm text-gray-600">{m.value}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{m.provider}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{formatDate(m.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
