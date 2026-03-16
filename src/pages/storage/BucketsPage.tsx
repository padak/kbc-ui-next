// file: pages/storage/BucketsPage.tsx
// Storage page: lists all buckets with their tables, sizes, and metadata.
// Navigates to table detail on row click. Groups by stage (in/out).
// Used by: App.tsx route /storage.
// Data from: hooks/useStorage.ts (useBuckets, useTables).

import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { useBuckets } from '@/hooks/useStorage';
import { formatBytes, formatDate } from '@/lib/formatters';
import type { Bucket } from '@/api/types';

const COLUMNS = [
  {
    key: 'stage',
    label: 'Stage',
    render: (b: Bucket) => (
      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
        b.stage === 'in' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
      }`}>
        {b.stage}
      </span>
    ),
    sortValue: (b: Bucket) => b.stage,
  },
  {
    key: 'name',
    label: 'Name',
    render: (b: Bucket) => <span className="font-medium">{b.displayName || b.name}</span>,
    sortValue: (b: Bucket) => b.displayName || b.name,
  },
  {
    key: 'tables',
    label: 'Tables',
    render: (b: Bucket) => b.tables.length,
    sortValue: (b: Bucket) => b.tables.length,
  },
  {
    key: 'size',
    label: 'Size',
    render: (b: Bucket) => formatBytes(b.dataSizeBytes),
    sortValue: (b: Bucket) => b.dataSizeBytes,
  },
  {
    key: 'lastChange',
    label: 'Last Change',
    render: (b: Bucket) => b.lastChangeDate ? formatDate(b.lastChangeDate) : '-',
    sortValue: (b: Bucket) => b.lastChangeDate ?? '',
  },
];

export function BucketsPage() {
  const navigate = useNavigate();
  const { data: buckets, isLoading, error } = useBuckets();

  return (
    <div>
      <PageHeader
        title="Storage"
        description={`${buckets?.length ?? 0} buckets`}
      />

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </div>
      )}

      <DataTable
        columns={COLUMNS}
        data={buckets ?? []}
        keyFn={(b) => b.id}
        searchFn={(b, q) =>
          b.name.toLowerCase().includes(q) ||
          b.displayName.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q)
        }
        onRowClick={(b) => navigate(`/storage/${encodeURIComponent(b.id)}`)}
        isLoading={isLoading}
        emptyMessage="No buckets found"
      />
    </div>
  );
}
