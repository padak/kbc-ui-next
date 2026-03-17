// file: pages/storage/BucketDetailPage.tsx
// Bucket detail: lists tables in a specific bucket with sizes and row counts.
// Navigates to table detail on row click.
// Used by: App.tsx route /storage/:bucketId.
// Data from: hooks/useStorage.ts (useBucket, useBucketTables).

import { useParams, useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { useBucket, useBucketTables } from '@/hooks/useStorage';
import { useConnectionStore } from '@/stores/connection';
import { formatBytes, formatDate, formatNumber } from '@/lib/formatters';
import type { Table } from '@/api/schemas';

const COLUMNS = [
  {
    key: 'name',
    label: 'Name',
    render: (t: Table) => <span className="font-medium">{t.displayName || t.name}</span>,
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

  const sourceProjectEntry = projects.find(
    (p) => p.projectId === bucket?.sourceBucket?.project?.id,
  );

  const title = bucket ? `${bucket.displayName || bucket.name}` : 'Bucket';

  return (
    <div>
      <PageHeader
        title={title}
        description={`${tables?.length ?? 0} tables`}
        actions={
          <button
            onClick={() => navigate('/storage')}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Back to Storage
          </button>
        }
      />

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

      <DataTable
        columns={COLUMNS}
        data={tables ?? []}
        keyFn={(t) => t.id}
        searchFn={(t, q) =>
          t.name.toLowerCase().includes(q) ||
          t.displayName.toLowerCase().includes(q)
        }
        onRowClick={(t) => navigate(`/storage/${encodeURIComponent(bucketId ?? '')}/${encodeURIComponent(t.id)}`)}
        isLoading={isLoading}
        emptyMessage="No tables in this bucket"
      />
    </div>
  );
}
