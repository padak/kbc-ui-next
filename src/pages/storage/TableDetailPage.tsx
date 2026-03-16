// file: pages/storage/TableDetailPage.tsx
// Table detail: shows columns, metadata, and data preview.
// Displays table stats (rows, size, primary key) in header.
// Used by: App.tsx route /storage/:bucketId/:tableId.
// Data from: hooks/useStorage.ts (useTable, useTablePreview).

import { useParams, useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { useTable } from '@/hooks/useStorage';
import { formatBytes, formatNumber, formatDate } from '@/lib/formatters';

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
      <div className="mb-6 overflow-hidden rounded-lg border border-gray-200">
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

      {/* Metadata */}
      {table.metadata.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Metadata</h2>
          <div className="overflow-hidden rounded-lg border border-gray-200">
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
