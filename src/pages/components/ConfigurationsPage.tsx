// file: pages/components/ConfigurationsPage.tsx
// Configurations list for a specific component.
// Shows all configs with version, status, last change.
// Used by: App.tsx route /components/:componentId.
// Data from: hooks/useComponents.ts (useComponent, useConfigurations).

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { CreateModal } from '@/components/CreateModal';
import { useComponent, useConfigurations } from '@/hooks/useComponents';
import { useCreateConfiguration } from '@/hooks/useMutations';
import { formatDate } from '@/lib/formatters';
import { stripMarkdown } from '@/lib/stripMarkdown';
import type { Configuration } from '@/api/schemas';

const COLUMNS = [
  {
    key: 'name',
    label: 'Name',
    render: (c: Configuration) => (
      <div>
        <span className="font-medium">{c.name}</span>
        {c.description && <p className="mt-0.5 text-xs text-gray-400">{stripMarkdown(c.description)}</p>}
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
  const createConfig = useCreateConfiguration(componentId ?? '');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isTransformation = component?.type === 'transformation';
  const isFlow = componentId === 'keboola.orchestrator' || componentId === 'keboola.flow';
  const parentLabel = isTransformation ? 'Transformations' : isFlow ? 'Flows' : 'Components';
  const parentHref = isTransformation ? '/transformations' : isFlow ? '/flows' : '/components';

  return (
    <div>
      <PageHeader
        title={component?.name ?? componentId ?? ''}
        description={`${configs?.length ?? 0} configurations`}
        breadcrumbs={[
          { label: parentLabel, href: parentHref },
        ]}
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New Configuration
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

      <CreateModal
        title={`New ${component?.name ?? ''} Configuration`}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (data) => {
          const newConfig = await createConfig.mutateAsync(data);
          setShowCreateModal(false);
          navigate(`/components/${encodeURIComponent(componentId ?? '')}/${newConfig.id}`);
        }}
        isPending={createConfig.isPending}
        error={createConfig.error instanceof Error ? createConfig.error : null}
      />
    </div>
  );
}
