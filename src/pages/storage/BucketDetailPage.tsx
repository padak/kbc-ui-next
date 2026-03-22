// file: pages/storage/BucketDetailPage.tsx
// Bucket detail: info card + tables list with sizes and row counts.
// Shows bucket properties (backend, schema, sharing) and linked bucket info.
// Used by: App.tsx route /storage/:bucketId.
// Data from: hooks/useStorage.ts (useBucket, useBucketTables).

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { useBucket, useBucketTables } from '@/hooks/useStorage';
import { useConnectionStore } from '@/stores/connection';
import { formatBytes, formatDate, formatNumber } from '@/lib/formatters';
import type { Table } from '@/api/schemas';

const TABLE_COLUMNS = [
  {
    key: 'name',
    label: 'Name',
    render: (t: Table) => (
      <span className="flex items-center gap-2">
        <span className="font-medium">{t.displayName || t.name}</span>
        {t.isTyped && <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] font-medium text-blue-600">TYPED</span>}
        {t.isAlias && <span className="rounded bg-purple-50 px-1 py-0.5 text-[10px] font-medium text-purple-600">ALIAS</span>}
      </span>
    ),
    sortValue: (t: Table) => t.displayName || t.name,
  },
  {
    key: 'columns',
    label: 'Columns',
    render: (t: Table) => t.columns?.length ?? '-',
    sortValue: (t: Table) => t.columns?.length ?? 0,
  },
  {
    key: 'rows',
    label: 'Rows',
    render: (t: Table) => formatNumber(t.rowsCount),
    sortValue: (t: Table) => t.rowsCount ?? 0,
  },
  {
    key: 'size',
    label: 'Size',
    render: (t: Table) => formatBytes(t.dataSizeBytes),
    sortValue: (t: Table) => t.dataSizeBytes ?? 0,
  },
  {
    key: 'lastImport',
    label: 'Last Import',
    render: (t: Table) => t.lastImportDate ? formatDate(t.lastImportDate) : '-',
    sortValue: (t: Table) => t.lastImportDate ?? '',
  },
];

export function BucketDetailPage() {
  const { bucketId } = useParams<{ bucketId: string }>();
  const navigate = useNavigate();
  const { data: bucket } = useBucket(bucketId ?? '');
  const { data: tables, isLoading, error } = useBucketTables(bucketId ?? '');
  const { projects, setActiveProject } = useConnectionStore();
  const [showDetails, setShowDetails] = useState(false);

  const sourceProjectEntry = projects.find(
    (p) => p.projectId === bucket?.sourceBucket?.project?.id,
  );

  const title = bucket ? `${bucket.displayName || bucket.name}` : 'Bucket';
  const totalRows = tables?.reduce((sum, t) => sum + (t.rowsCount ?? 0), 0) ?? 0;
  const totalSize = tables?.reduce((sum, t) => sum + (t.dataSizeBytes ?? 0), 0) ?? 0;

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'Storage', href: '/storage' },
        ]}
        title={title}
        description={
          bucket ? (
            <span className="flex items-center gap-2">
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">{bucket.stage.toUpperCase()}</span>
              {bucket.backend && (
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-600">{bucket.backend}</span>
              )}
              <span className="font-mono text-xs text-gray-400">{bucket.id}</span>
            </span>
          ) : undefined
        }
      />

      {/* Stats bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Tables</p>
          <p className="text-lg font-semibold">{tables?.length ?? 0}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Total Rows</p>
          <p className="text-lg font-semibold">{formatNumber(totalRows)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Total Size</p>
          <p className="text-lg font-semibold">{formatBytes(totalSize)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Created</p>
          <p className="text-sm font-semibold">{bucket ? formatDate(bucket.created) : '-'}</p>
        </div>
      </div>

      {/* Linked bucket info */}
      {bucket?.sourceBucket?.project && (
        <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-900">
                Linked from project: {bucket.sourceBucket.project.name}
              </p>
              <p className="mt-0.5 text-xs text-purple-600">
                Source bucket: {bucket.sourceBucket.id}
                {bucket.sourceBucket.sharedBy && (
                  <> &middot; Shared by {bucket.sourceBucket.sharedBy.name}</>
                )}
              </p>
            </div>
            {sourceProjectEntry && (
              <button
                onClick={() => {
                  setActiveProject(sourceProjectEntry.id);
                  navigate(`/storage/${encodeURIComponent(bucket.sourceBucket!.id)}`);
                }}
                className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
              >
                Go to source project
              </button>
            )}
          </div>
        </div>
      )}

      {bucket?.sharing && !bucket?.sourceBucket && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-900">
            This bucket is shared ({bucket.sharing})
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </div>
      )}

      {/* Tables list */}
      <DataTable
        columns={TABLE_COLUMNS}
        data={tables ?? []}
        keyFn={(t) => t.id}
        searchFn={(t, q) =>
          t.name.toLowerCase().includes(q) ||
          t.displayName.toLowerCase().includes(q) ||
          t.columns.some((c) => c.toLowerCase().includes(q))
        }
        onRowClick={(t) => navigate(`/storage/${encodeURIComponent(bucketId ?? '')}/${encodeURIComponent(t.id)}`)}
        isLoading={isLoading}
        emptyMessage="No tables in this bucket"
      />

      {/* Details (collapsible) */}
      {bucket && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform ${showDetails ? 'rotate-90' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
            Bucket Details
            {bucket.metadata.length > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{bucket.metadata.length} metadata</span>
            )}
          </button>
          {showDetails && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-white">
              <dl className="divide-y divide-gray-100">
                <div className="flex justify-between px-4 py-2">
                  <dt className="text-sm text-gray-500">Bucket ID</dt>
                  <dd className="font-mono text-sm text-gray-800">{bucket.id}</dd>
                </div>
                <div className="flex justify-between px-4 py-2">
                  <dt className="text-sm text-gray-500">Stage</dt>
                  <dd className="text-sm text-gray-800">{bucket.stage.toUpperCase()}</dd>
                </div>
                {bucket.backend && (
                  <div className="flex justify-between px-4 py-2">
                    <dt className="text-sm text-gray-500">Backend</dt>
                    <dd className="text-sm text-gray-800">{bucket.backend}</dd>
                  </div>
                )}
                <div className="flex justify-between px-4 py-2">
                  <dt className="text-sm text-gray-500">Created</dt>
                  <dd className="text-sm text-gray-800">{formatDate(bucket.created)}</dd>
                </div>
                {bucket.lastChangeDate && (
                  <div className="flex justify-between px-4 py-2">
                    <dt className="text-sm text-gray-500">Last Change</dt>
                    <dd className="text-sm text-gray-800">{formatDate(bucket.lastChangeDate)}</dd>
                  </div>
                )}
                {bucket.description && (
                  <div className="flex justify-between px-4 py-2">
                    <dt className="text-sm text-gray-500">Description</dt>
                    <dd className="text-sm text-gray-800">{bucket.description}</dd>
                  </div>
                )}
              </dl>
              {bucket.metadata.length > 0 && (
                <div className="border-t border-gray-200 p-4">
                  <h4 className="mb-2 text-xs font-medium uppercase text-gray-500">Metadata</h4>
                  <div className="space-y-1">
                    {bucket.metadata.map((m) => (
                      <div key={m.id} className="flex items-baseline gap-2 text-sm">
                        <span className="font-medium text-gray-700">{m.key}</span>
                        <span className="text-gray-400">=</span>
                        <span className="text-gray-600">{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
