// file: pages/components/ConfigurationRowPage.tsx
// Single configuration row detail: shows row JSON and metadata.
// Finds the row within the parent configuration's rows array.
// Used by: App.tsx route /components/:componentId/:configId/rows/:rowId.
// Data from: hooks/useComponents.ts (useConfiguration).

import { useState, useCallback } from 'react';
import { useParams } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { ConfigEditor } from '@/components/ConfigEditor';
import { DescriptionDisplay } from '@/components/DescriptionDisplay';
import { DescriptionEditor } from '@/components/DescriptionEditor';
import { useConfiguration, useComponent } from '@/hooks/useComponents';
import { useUpdateConfigurationRow } from '@/hooks/useMutations';

export function ConfigurationRowPage() {
  const { componentId, configId, rowId } = useParams<{
    componentId: string;
    configId: string;
    rowId: string;
  }>();
  const { data: config, isLoading, error } = useConfiguration(componentId ?? '', configId ?? '');
  const { data: component } = useComponent(componentId ?? '');
  const updateRow = useUpdateConfigurationRow(componentId ?? '', configId ?? '');
  const [editingDescription, setEditingDescription] = useState(false);

  const handleDescriptionChange = useCallback((description: string) => {
    updateRow.mutate({
      rowId: rowId ?? '',
      description,
      changeDescription: 'Updated row description via kbc-ui-next',
    });
  }, [updateRow, rowId]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-gray-400">Loading...</div>;
  }

  if (error) {
    return <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>;
  }

  const row = config?.rows.find((r) => r.id === rowId);

  const isTransformation = component?.type === 'transformation';
  const isFlow = componentId === 'keboola.orchestrator' || componentId === 'keboola.flow';
  const parentLabel = isTransformation ? 'Transformations' : isFlow ? 'Flows' : 'Components';
  const parentHref = isTransformation ? '/transformations' : isFlow ? '/flows' : '/components';

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
        breadcrumbs={[
          { label: parentLabel, href: parentHref },
          { label: component?.name ?? componentId ?? '', href: `/components/${encodeURIComponent(componentId ?? '')}` },
          { label: config?.name ?? configId ?? '', href: `/components/${encodeURIComponent(componentId ?? '')}/${configId}` },
        ]}
        title={row.name || row.id}
        description={
          editingDescription ? (
            <DescriptionEditor
              value={row.description}
              onSave={(desc) => {
                handleDescriptionChange(desc);
                setEditingDescription(false);
              }}
              onCancel={() => setEditingDescription(false)}
              isSaving={updateRow.isPending}
            />
          ) : (
            <DescriptionDisplay
              content={row.description || `Row ${row.id}`}
              title={row.name || row.id}
              onEdit={() => setEditingDescription(true)}
            />
          )
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

      {/* Row Configuration Editor */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Row Configuration</h2>
      <div className="mb-6">
        <ConfigEditor
          schema={component?.configurationRowSchema ?? null}
          values={row.configuration as Record<string, unknown>}
          onSave={async (newValues) => {
            await updateRow.mutateAsync({
              rowId: rowId ?? '',
              configuration: newValues,
              changeDescription: 'Updated via kbc-ui-next',
            });
          }}
          isSaving={updateRow.isPending}
        />
      </div>

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
