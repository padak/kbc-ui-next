// file: pages/components/ConfigurationRowPage.tsx
// Single configuration row detail: shows row JSON and metadata.
// Finds the row within the parent configuration's rows array.
// Used by: App.tsx route /components/:componentId/:configId/rows/:rowId.
// Data from: hooks/useComponents.ts (useConfiguration).

import { useParams, useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { useConfiguration } from '@/hooks/useComponents';

export function ConfigurationRowPage() {
  const { componentId, configId, rowId } = useParams<{
    componentId: string;
    configId: string;
    rowId: string;
  }>();
  const navigate = useNavigate();
  const { data: config, isLoading, error } = useConfiguration(componentId ?? '', configId ?? '');

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-gray-400">Loading...</div>;
  }

  if (error) {
    return <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>;
  }

  const row = config?.rows.find((r) => r.id === rowId);

  if (!row) {
    return (
      <div>
        <PageHeader title="Row not found" />
        <p className="text-sm text-gray-500">Row {rowId} was not found in this configuration.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={row.name || row.id}
        description={row.description || `Row ${row.id}`}
        actions={
          <button
            onClick={() => navigate(`/components/${encodeURIComponent(componentId ?? '')}/${configId}`)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Back to Configuration
          </button>
        }
      />

      {/* Row Info */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Row ID</p>
          <p className="text-sm font-mono font-semibold">{row.id}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Status</p>
          <p className="text-lg font-semibold">{row.isDisabled ? 'Disabled' : 'Active'}</p>
        </div>
      </div>

      {/* Row Configuration JSON */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Row Configuration</h2>
      <pre className="mb-6 overflow-x-auto rounded-lg border border-gray-200 bg-gray-900 p-4 text-sm text-green-400">
        {JSON.stringify(row.configuration, null, 2)}
      </pre>

      {/* Row State */}
      {Object.keys(row.state).length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Row State</h2>
          <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-900 p-4 text-sm text-yellow-400">
            {JSON.stringify(row.state, null, 2)}
          </pre>
        </>
      )}
    </div>
  );
}
