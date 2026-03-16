// file: pages/components/ConfigurationsPage.tsx
// Configurations list for a specific component.
// Shows all configs with version, status, last change.
// Used by: App.tsx route /components/:componentId.
// Data from: hooks/useComponents.ts (useComponent, useConfigurations).

import { useParams, useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { useComponent, useConfigurations } from '@/hooks/useComponents';
import { formatDate } from '@/lib/formatters';
import type { Configuration } from '@/api/schemas';

const COLUMNS = [
  {
    key: 'name',
    label: 'Name',
    render: (c: Configuration) => (
      <div>
        <span className="font-medium">{c.name}</span>
        {c.description && <p className="mt-0.5 text-xs text-gray-400">{c.description}</p>}
      </div>
    ),
    sortValue: (c: Configuration) => c.name,
  },
  {
    key: 'version',
    label: 'Version',
    render: (c: Configuration) => `v${c.version}`,
    sortValue: (c: Configuration) => c.version,
  },
  {
    key: 'rows',
    label: 'Rows',
    render: (c: Configuration) => c.rows.length,
    sortValue: (c: Configuration) => c.rows.length,
  },
  {
    key: 'status',
    label: 'Status',
    render: (c: Configuration) => (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        c.isDisabled ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-700'
      }`}>
        {c.isDisabled ? 'Disabled' : 'Active'}
      </span>
    ),
  },
  {
    key: 'changed',
    label: 'Last Change',
    render: (c: Configuration) => formatDate(c.currentVersion.created),
    sortValue: (c: Configuration) => c.currentVersion.created,
  },
];

export function ConfigurationsPage() {
  const { componentId } = useParams<{ componentId: string }>();
  const navigate = useNavigate();
  const { data: component } = useComponent(componentId ?? '');
  const { data: configs, isLoading, error } = useConfigurations(componentId ?? '');

  return (
    <div>
      <PageHeader
        title={component?.name ?? componentId ?? ''}
        description={`${configs?.length ?? 0} configurations`}
        actions={
          <button
            onClick={() => navigate('/components')}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Back to Components
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>
      )}

      <DataTable
        columns={COLUMNS}
        data={configs ?? []}
        keyFn={(c) => c.id}
        searchFn={(c, q) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
        }
        onRowClick={(c) => navigate(`/components/${encodeURIComponent(componentId ?? '')}/${c.id}`)}
        isLoading={isLoading}
        emptyMessage="No configurations"
      />
    </div>
  );
}
