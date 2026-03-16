// file: pages/storage/BucketDetailPage.tsx
// Bucket detail: lists tables in a specific bucket with sizes and row counts.
// Navigates to table detail on row click.
// Used by: App.tsx route /storage/:bucketId.
// Data from: hooks/useStorage.ts (useBucket, useBucketTables).

import { useParams, useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { useBucket, useBucketTables } from '@/hooks/useStorage';
import { formatBytes, formatDate, formatNumber } from '@/lib/formatters';
import type { Table } from '@/api/types';

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
    render: (t: Table) => t.columns.length,
    sortValue: (t: Table) => t.columns.length,
  },
  {
    key: 'rows',
    label: 'Rows',
    render: (t: Table) => formatNumber(t.rowsCount),
    sortValue: (t: Table) => t.rowsCount,
  },
  {
    key: 'size',
    label: 'Size',
    render: (t: Table) => formatBytes(t.dataSizeBytes),
    sortValue: (t: Table) => t.dataSizeBytes,
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
