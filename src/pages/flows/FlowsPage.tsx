// file: pages/flows/FlowsPage.tsx
// Flows listing: orchestration flows (placeholder for Phase 2).
// Will show flow configs from the "keboola.orchestrator" component.
// Used by: App.tsx route /flows.
// TODO: Implement with useConfigurations('keboola.orchestrator').

import { PageHeader } from '@/components/PageHeader';
import { useConfigurations } from '@/hooks/useComponents';
import { DataTable } from '@/components/DataTable';
import { formatDate } from '@/lib/formatters';
import type { Configuration } from '@/api/types';
import { useNavigate } from 'react-router';

const ORCHESTRATOR_ID = 'keboola.orchestrator';

const COLUMNS = [
  {
    key: 'name',
    label: 'Name',
    render: (c: Configuration) => <span className="font-medium">{c.name}</span>,
    sortValue: (c: Configuration) => c.name,
  },
  {
    key: 'description',
    label: 'Description',
    render: (c: Configuration) => c.description || '-',
  },
  {
    key: 'version',
    label: 'Version',
    render: (c: Configuration) => `v${c.version}`,
    sortValue: (c: Configuration) => c.version,
  },
  {
    key: 'changed',
    label: 'Last Change',
    render: (c: Configuration) => formatDate(c.currentVersion.created),
    sortValue: (c: Configuration) => c.currentVersion.created,
  },
];

export function FlowsPage() {
  const navigate = useNavigate();
  const { data: flows, isLoading, error } = useConfigurations(ORCHESTRATOR_ID);

  return (
    <div>
      <PageHeader
        title="Flows"
        description="Orchestration flows"
      />

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>
      )}

      <DataTable
        columns={COLUMNS}
        data={flows ?? []}
        keyFn={(c) => c.id}
        searchFn={(c, q) => c.name.toLowerCase().includes(q)}
        onRowClick={(c) => navigate(`/components/${ORCHESTRATOR_ID}/${c.id}`)}
        isLoading={isLoading}
        emptyMessage="No flows configured"
      />
    </div>
  );
}
