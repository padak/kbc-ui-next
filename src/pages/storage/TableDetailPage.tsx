// file: pages/storage/TableDetailPage.tsx
// Table detail: data preview first, columns with sample values, advanced details.
// Optimized for data engineers: show data first, structure second, metadata on demand.
// Used by: App.tsx route /storage/:bucketId/:tableId.
// Data from: hooks/useStorage.ts (useTable, useTablePreview).

import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { useTable, useTablePreview } from '@/hooks/useStorage';
import { formatBytes, formatNumber, formatDate, formatRelativeTime } from '@/lib/formatters';

// -- Reusable collapsible section --

function CollapsibleSection({ title, count, badge, defaultOpen = true, children }: {
  title: string;
  count?: number;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900"
      >
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
        </svg>
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">{count}</span>
        )}
        {badge}
      </button>
      {open && children}
    </div>
  );
}

// -- Data Preview (auto-loads on mount) --

function DataPreview({ tableId, columns }: { tableId: string; columns: string[] }) {
  const { data, isLoading, error } = useTablePreview(tableId);

  type Cell = { columnName: string; value: string | null };
  const rows = useMemo(() => {
    if (!data) return [];
    const obj = data as Record<string, unknown>;
    const raw = (Array.isArray(obj.rows) ? obj.rows : Array.isArray(data) ? data : []) as Cell[][];
    return raw.map((row) => {
      const record: Record<string, string | null> = {};
      for (const cell of row) record[cell.columnName] = cell.value;
      return record;
    });
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
        Loading data preview...
      </div>
    );
  }

  if (error) {
    return <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
        No data in this table.
      </div>
    );
  }

  return (
    <div className="max-h-[400px] overflow-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            {columns.map((col) => (
              <th key={col} className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 bg-gray-50">
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
                const isNull = val === null || val === undefined;
                const text = isNull ? 'NULL' : String(val);
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
  );
}

// -- Columns with sample values --

// Compute basic column profile from sample data
function profileColumn(values: Array<string | null | undefined>) {
  const total = values.length;
  const nullCount = values.filter((v) => v === null || v === undefined).length;
  const nonNull = values.filter((v): v is string => v !== null && v !== undefined);
  const distinct = new Set(nonNull).size;
  const samples = nonNull.filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 5);

  // Detect if numeric (all non-null values parse as numbers)
  const nums = nonNull.map(Number).filter((n) => !isNaN(n));
  const isNumeric = nonNull.length > 0 && nums.length === nonNull.length;
  const min = isNumeric && nums.length > 0 ? Math.min(...nums) : null;
  const max = isNumeric && nums.length > 0 ? Math.max(...nums) : null;

  return { total, nullCount, distinct, samples, isNumeric, min, max };
}

function ColumnsWithSamples({ columns, primaryKey, sampleData }: {
  columns: string[];
  primaryKey: string[];
  sampleData: Array<Record<string, string | null>>;
}) {
  const hasData = sampleData.length > 0;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="w-10 px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">#</th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Column</th>
            <th className="w-10 px-3 py-2 text-center text-xs font-medium uppercase text-gray-500">PK</th>
            {hasData && (
              <>
                <th className="w-16 px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Distinct</th>
                <th className="w-16 px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Nulls</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Sample Values
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {columns.map((col, i) => {
            const values = sampleData.map((row) => row[col]);
            const profile = hasData ? profileColumn(values) : null;

            return (
              <tr key={col} className="hover:bg-gray-50">
                <td className="px-3 py-1.5 text-xs text-gray-400">{i + 1}</td>
                <td className="px-3 py-1.5 font-mono text-sm text-gray-800">{col}</td>
                <td className="px-3 py-1.5 text-center">
                  {primaryKey.includes(col) && (
                    <span className="rounded bg-yellow-50 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700">PK</span>
                  )}
                </td>
                {profile && (
                  <>
                    <td className="px-3 py-1.5 text-right text-xs text-gray-600">{profile.distinct}</td>
                    <td className="px-3 py-1.5 text-right text-xs">
                      {profile.nullCount > 0 ? (
                        <span className="text-orange-500">{profile.nullCount}</span>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="max-w-md px-3 py-1.5 text-xs text-gray-500">
                      {profile.isNumeric && profile.min !== null ? (
                        <span>
                          <span className="text-gray-400">min:</span> {profile.min}
                          <span className="mx-1 text-gray-300">|</span>
                          <span className="text-gray-400">max:</span> {profile.max}
                          {profile.samples.length > 0 && (
                            <>
                              <span className="mx-1 text-gray-300">|</span>
                              <span className="truncate" title={profile.samples.join(', ')}>
                                {profile.samples.join(', ')}
                              </span>
                            </>
                          )}
                        </span>
                      ) : profile.samples.length > 0 ? (
                        <span className="truncate" title={profile.samples.join(', ')}>
                          {profile.samples.join(', ')}
                        </span>
                      ) : (
                        <span className="italic text-gray-300">-</span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// -- Main page --

export function TableDetailPage() {
  const { bucketId, tableId } = useParams<{ bucketId: string; tableId: string }>();
  const navigate = useNavigate();
  const { data: table, isLoading, error } = useTable(tableId ?? '');
  const { data: previewData } = useTablePreview(tableId ?? '');

  // Parse preview data for sample values in columns
  type Cell = { columnName: string; value: string | null };
  const sampleRows = useMemo(() => {
    if (!previewData) return [];
    const obj = previewData as Record<string, unknown>;
    const raw = (Array.isArray(obj.rows) ? obj.rows : Array.isArray(previewData) ? previewData : []) as Cell[][];
    return raw.map((row) => {
      const record: Record<string, string | null> = {};
      for (const cell of row) record[cell.columnName] = cell.value;
      return record;
    });
  }, [previewData]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-gray-400">Loading table...</div>;
  }

  if (error) {
    return <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>;
  }

  if (!table) return null;

  const hasMetadata = table.metadata.length > 0;
  const lastImport = table.lastImportDate ? formatRelativeTime(table.lastImportDate) : null;

  return (
    <div>
      <PageHeader
        title={table.displayName || table.name}
        description={
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs">{table.id}</span>
            {table.isTyped && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">TYPED</span>}
            {table.isAlias && <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-600">ALIAS</span>}
          </span>
        }
        actions={
          <button
            onClick={() => navigate(`/storage/${encodeURIComponent(bucketId ?? '')}`)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Back to Bucket
          </button>
        }
      />

      {/* Stats bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
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
          <p className="text-sm font-semibold">{table.primaryKey.length > 0 ? table.primaryKey.join(', ') : 'None'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Last Import</p>
          <p className="text-sm font-semibold" title={table.lastImportDate ?? undefined}>
            {lastImport ?? 'Never'}
          </p>
        </div>
      </div>

      {/* 1. Data Preview — what the data engineer came here for */}
      <CollapsibleSection
        title="Data Preview"
        count={sampleRows.length > 0 ? sampleRows.length : undefined}
        badge={sampleRows.length === 0 && !previewData ? undefined :
          <span className="text-xs font-normal text-gray-400">first 100 rows</span>
        }
      >
        <DataPreview tableId={tableId ?? ''} columns={table.columns} />
      </CollapsibleSection>

      {/* 2. Columns — with sample values from preview data */}
      <CollapsibleSection
        title="Columns"
        count={table.columns.length}
        defaultOpen={table.columns.length <= 30}
      >
        <ColumnsWithSamples
          columns={table.columns}
          primaryKey={table.primaryKey}
          sampleData={sampleRows}
        />
      </CollapsibleSection>

      {/* 3. Details — metadata, timestamps, technical info */}
      <CollapsibleSection
        title="Details"
        defaultOpen={false}
        badge={hasMetadata ?
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            {table.metadata.length} metadata
          </span> : undefined
        }
      >
        {/* Technical info */}
        <div className="mb-4 rounded-lg border border-gray-200 bg-white">
          <dl className="divide-y divide-gray-100">
            <div className="flex justify-between px-4 py-2">
              <dt className="text-sm text-gray-500">Table ID</dt>
              <dd className="font-mono text-sm text-gray-800">{table.id}</dd>
            </div>
            <div className="flex justify-between px-4 py-2">
              <dt className="text-sm text-gray-500">Created</dt>
              <dd className="text-sm text-gray-800">{formatDate(table.created)}</dd>
            </div>
            {table.lastImportDate && (
              <div className="flex justify-between px-4 py-2">
                <dt className="text-sm text-gray-500">Last Import</dt>
                <dd className="text-sm text-gray-800">{formatDate(table.lastImportDate)}</dd>
              </div>
            )}
            {table.lastChangeDate && (
              <div className="flex justify-between px-4 py-2">
                <dt className="text-sm text-gray-500">Last Change</dt>
                <dd className="text-sm text-gray-800">{formatDate(table.lastChangeDate)}</dd>
              </div>
            )}
            {table.bucket && (
              <div className="flex justify-between px-4 py-2">
                <dt className="text-sm text-gray-500">Bucket</dt>
                <dd className="text-sm text-gray-800">{table.bucket.stage}.{table.bucket.name}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Metadata table */}
        {hasMetadata && (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Key</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Value</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Provider</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {table.metadata.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-1.5 text-sm font-medium text-gray-700">{m.key}</td>
                    <td className="max-w-md truncate px-3 py-1.5 text-sm text-gray-600">{m.value}</td>
                    <td className="px-3 py-1.5 text-sm text-gray-500">{m.provider}</td>
                    <td className="px-3 py-1.5 text-sm text-gray-500">{formatDate(m.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
