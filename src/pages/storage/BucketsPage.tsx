// file: pages/storage/BucketsPage.tsx
// Storage page: lists all buckets with their tables, sizes, and metadata.
// Navigates to table detail on row click. Groups by stage (in/out).
// Used by: App.tsx route /storage.
// Data from: hooks/useStorage.ts (useBuckets, useTables).

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { CreateModal } from '@/components/CreateModal';
import { useBuckets } from '@/hooks/useStorage';
import { useCreateBucket } from '@/hooks/useMutations';
import { formatBytes, formatDate, formatNumber } from '@/lib/formatters';
import type { Bucket } from '@/api/schemas';

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
    render: (b: Bucket) => (
      <div>
        <span className="font-medium">{b.displayName || b.name}</span>
        {b.sourceBucket?.project && (
          <span className="ml-2 inline-flex items-center rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
            Linked from {b.sourceBucket.project.name}
          </span>
        )}
        {b.sharing && !b.sourceBucket && (
          <span className="ml-2 inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
            Shared
          </span>
        )}
      </div>
    ),
    sortValue: (b: Bucket) => b.displayName || b.name,
  },
  {
    key: 'rows',
    label: 'Rows',
    render: (b: Bucket) => formatNumber(b.rowsCount),
    sortValue: (b: Bucket) => b.rowsCount ?? 0,
  },
  {
    key: 'size',
    label: 'Size',
    render: (b: Bucket) => formatBytes(b.dataSizeBytes),
    sortValue: (b: Bucket) => b.dataSizeBytes ?? 0,
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
  const createBucket = useCreateBucket();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBucketStage, setNewBucketStage] = useState('in');

  return (
    <div>
      <PageHeader
        title="Storage"
        description={`${buckets?.length ?? 0} buckets`}
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Create Bucket
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

      <CreateModal
        title="New Bucket"
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (data) => {
          await createBucket.mutateAsync({ name: data.name, stage: newBucketStage, description: data.description });
          setShowCreateModal(false);
        }}
        isPending={createBucket.isPending}
        error={createBucket.error instanceof Error ? createBucket.error : null}
        extraFields={
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Stage</label>
            <select
              value={newBucketStage}
              onChange={(e) => setNewBucketStage(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="in">in</option>
              <option value="out">out</option>
            </select>
          </div>
        }
      />
    </div>
  );
}
