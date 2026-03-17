// file: pages/components/ConfigurationDetailPage.tsx
// Single configuration detail: JSON view, rows list, flow builder, code editor.
// Generic page that works for ALL component types (extractors, writers, etc.).
// Used by: App.tsx route /components/:componentId/:configId.
// Data from: hooks/useComponents.ts (useConfiguration), hooks/useComponentLookup.ts.

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { RunButton } from '@/components/RunButton';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ConfigEditor } from '@/components/ConfigEditor';
import { FlowBuilder } from '@/components/FlowBuilder';
import { FlowEditor } from '@/components/FlowEditor';
import { MappingEditor } from '@/components/MappingEditor';
import { CodeEditor, extractCode } from '@/components/CodeEditor';
import { useConfiguration, useComponent } from '@/hooks/useComponents';
import { useDeleteConfiguration } from '@/hooks/useComponents';
import { useUpdateConfiguration } from '@/hooks/useMutations';
import { useComponentLookup } from '@/hooks/useComponentLookup';
import { flowToMermaid, flowToText } from '@/lib/flowToMermaid';
import { formatDate } from '@/lib/formatters';
import type { ConfigurationRow } from '@/api/schemas';

// Extract source/destination info from row configuration JSON.
// DB extractors use parameters.table.{schema,tableName} for source
// and parameters.outputTable for destination.
// This is a best-effort extraction - not all components use this structure.
function extractRowMeta(row: ConfigurationRow) {
  const params = (row.configuration as Record<string, unknown>)?.parameters as Record<string, unknown> | undefined;
  if (!params) return { source: null, destination: null, primaryKey: null };

  // Source: table.schema.tableName (DB extractors)
  const table = params.table as Record<string, unknown> | undefined;
  const schema = table?.schema as string | undefined;
  const tableName = table?.tableName as string | undefined;
  const source = schema && tableName ? `${schema}.${tableName}` : null;

  // Destination: outputTable
  const outputTable = params.outputTable as string | undefined;
  const destination = outputTable ?? null;

  // Primary key
  const pk = params.primaryKey as string[] | undefined;
  const primaryKey = pk?.length ? pk.join(', ') : null;

  return { source, destination, primaryKey };
}

export function ConfigurationDetailPage() {
  const { componentId, configId } = useParams<{ componentId: string; configId: string }>();
  const navigate = useNavigate();
  const { data: config, isLoading, error } = useConfiguration(componentId ?? '', configId ?? '');
  const { data: component } = useComponent(componentId ?? '');
  const deleteConfig = useDeleteConfiguration(componentId ?? '');
  const updateConfig = useUpdateConfiguration(componentId ?? '', configId ?? '');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const { getComponentName, getComponentIcon, getConfigName } = useComponentLookup();

  const isFlow = componentId === 'keboola.orchestrator' || componentId === 'keboola.flow';
  const isTransformation = component?.type === 'transformation';

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-gray-400">Loading configuration...</div>;
  }

  if (error) {
    return <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>;
  }

  if (!config) return null;

  // Check if any row has source/destination info (to show extra columns)
  const rowsMeta = config.rows.map((row) => ({ row, meta: extractRowMeta(row) }));
  const hasSourceInfo = rowsMeta.some((r) => r.meta.source || r.meta.destination);

  return (
    <div>
      <PageHeader
        title={config.name}
        description={config.description || `Version ${config.version}`}
        actions={
          <div className="flex items-center gap-2">
            <RunButton componentId={componentId ?? ''} configId={configId ?? ''} label="Run Component" />
            <button
              onClick={() => navigate(`/components/${encodeURIComponent(componentId ?? '')}`)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        }
      />

      {/* Info */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Version</p>
          <p className="text-lg font-semibold">{config.version}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Rows</p>
          <p className="text-lg font-semibold">{config.rows.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Status</p>
          <p className="text-lg font-semibold">{config.isDisabled ? 'Disabled' : 'Active'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Last Changed</p>
          <p className="text-sm font-semibold">{formatDate(config.currentVersion.created)}</p>
        </div>
      </div>

      {/* Flow Builder (for orchestrator/flow components) */}
      {isFlow && config.configuration && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Flow Builder</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const mermaid = flowToMermaid(config.configuration as Record<string, unknown>, { getComponentName, getConfigName });
                  navigator.clipboard.writeText(mermaid);
                  setCopiedFormat('mermaid');
                  setTimeout(() => setCopiedFormat(null), 2000);
                }}
                className="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                {copiedFormat === 'mermaid' ? 'Copied!' : 'Copy Mermaid'}
              </button>
              <button
                onClick={() => {
                  const text = flowToText(config.configuration as Record<string, unknown>, { getComponentName, getConfigName });
                  navigator.clipboard.writeText(text);
                  setCopiedFormat('text');
                  setTimeout(() => setCopiedFormat(null), 2000);
                }}
                className="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                {copiedFormat === 'text' ? 'Copied!' : 'Copy as Text'}
              </button>
            </div>
          </div>
          <FlowBuilder
            configuration={config.configuration as Record<string, unknown>}
            componentLookup={{ getComponentName, getComponentIcon, getConfigName }}
          />
        </div>
      )}

      {/* Flow Editor (for orchestrator/flow components) */}
      {isFlow && config.configuration && (
        <FlowEditor
          configuration={config.configuration as Record<string, unknown>}
          onSave={async (newConfig) => {
            await updateConfig.mutateAsync({
              configuration: newConfig,
              changeDescription: 'Updated flow via kbc-ui-next',
            });
          }}
          isSaving={updateConfig.isPending}
        />
      )}

      {/* Mapping Editor (for transformation components) */}
      {isTransformation && (
        <MappingEditor
          configuration={config.configuration as Record<string, unknown>}
          onSave={async (newConfig) => {
            await updateConfig.mutateAsync({
              configuration: newConfig,
              changeDescription: 'Updated mappings via kbc-ui-next',
            });
          }}
          isSaving={updateConfig.isPending}
        />
      )}

      {/* Code Editor (for transformation components) */}
      {isTransformation && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Code</h2>
          <CodeEditor
            value={extractCode(config.configuration as Record<string, unknown>)}
            onChange={() => {}}
            language={componentId?.includes('python') ? 'python' : 'sql'}
            readOnly
          />
        </div>
      )}

      {/* Configuration Rows */}
      {config.rows.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            {hasSourceInfo ? 'Tables' : 'Rows'}
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  {hasSourceInfo && (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Destination</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Load Options</th>
                    </>
                  )}
                  {!hasSourceInfo && (
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Description</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {rowsMeta.map(({ row, meta }) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/components/${encodeURIComponent(componentId ?? '')}/${configId}/rows/${row.id}`)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800">
                      {row.name || row.id}
                    </td>
                    {hasSourceInfo && (
                      <>
                        <td className="px-4 py-2 text-sm font-mono text-gray-500">{meta.source ?? '-'}</td>
                        <td className="px-4 py-2 text-sm font-mono text-gray-500">{meta.destination ?? '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {meta.primaryKey ? (
                            <span>
                              <span className="text-xs text-gray-400">PK: </span>
                              {meta.primaryKey}
                            </span>
                          ) : '-'}
                        </td>
                      </>
                    )}
                    {!hasSourceInfo && (
                      <td className="px-4 py-2 text-sm text-gray-500">{row.description || '-'}</td>
                    )}
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.isDisabled ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-700'
                      }`}>
                        {row.isDisabled ? 'Disabled' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Configuration Editor */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Configuration</h2>
      <ConfigEditor
        schema={component?.configurationSchema ?? null}
        values={config.configuration as Record<string, unknown>}
        onSave={async (newValues) => {
          await updateConfig.mutateAsync({
            configuration: newValues,
            changeDescription: 'Updated via kbc-ui-next',
          });
        }}
        isSaving={updateConfig.isPending}
        jsonOnly={isFlow}
      />

      <ConfirmModal
        title="Delete Configuration"
        message={`Are you sure you want to delete "${config.name}"? This action cannot be undone.`}
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async () => {
          await deleteConfig.mutateAsync(configId ?? '');
          navigate(`/components/${encodeURIComponent(componentId ?? '')}`);
        }}
        isPending={deleteConfig.isPending}
        error={deleteConfig.error instanceof Error ? deleteConfig.error : null}
      />
    </div>
  );
}
