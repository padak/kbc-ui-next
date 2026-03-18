// file: pages/components/ConfigurationDetailPage.tsx
// Single configuration detail: JSON view, rows list, flow builder, code editor.
// Generic page that works for ALL component types (extractors, writers, etc.).
// Used by: App.tsx route /components/:componentId/:configId.
// Data from: hooks/useComponents.ts (useConfiguration), hooks/useComponentLookup.ts.

import { useState, memo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { RunButton } from '@/components/RunButton';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ConfigEditor } from '@/components/ConfigEditor';
import { FlowBuilder } from '@/components/FlowBuilder';
import { FlowEditor } from '@/components/FlowEditor';
import { MappingEditor } from '@/components/MappingEditor';
import { CodeEditor, extractCode } from '@/components/CodeEditor';
import { TransformationBlocks, hasBlockStructure } from '@/components/TransformationBlocks';
import { useConfiguration, useComponent } from '@/hooks/useComponents';
import { useDeleteConfiguration } from '@/hooks/useComponents';
import { useUpdateConfiguration, useUpdateConfigurationRow, useCopyConfiguration } from '@/hooks/useMutations';
import { useComponentLookup } from '@/hooks/useComponentLookup';
import { flowToMermaid, flowToText } from '@/lib/flowToMermaid';
import { formatDate } from '@/lib/formatters';
import type { ConfigurationRow } from '@/api/schemas';

// Inline editable text — click to edit, Enter/blur to save, Escape to cancel.
// Draft state only exists while editing. When not editing, always shows current prop value.
function EditableText({ value, onSave, placeholder, className }: {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;

  function commit() {
    if (draft === null) return;
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed);
    setDraft(null);
  }

  if (editing) {
    return (
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          // Delay to avoid conflict with Enter keydown
          setTimeout(() => {
            // Only commit if still in editing mode (draft not null)
            if (draft !== null) commit();
          }, 0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.preventDefault(); setDraft(null); }
        }}
        onClick={(e) => e.stopPropagation()}
        className={`rounded border border-blue-400 bg-white px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 ${className ?? ''}`}
        autoFocus
      />
    );
  }

  return (
    <span
      className={`cursor-pointer rounded px-1 hover:bg-gray-100 ${className ?? ''} ${!value && placeholder ? 'italic text-gray-300' : ''}`}
      onClick={() => setDraft(value)}
      title="Click to edit"
    >
      {value || placeholder || ''}
    </span>
  );
}

// Isolated component to prevent FlowBuilder re-render on copy state change
const FlowCopyButtons = memo(function FlowCopyButtons({ configuration, lookup }: {
  configuration: Record<string, unknown>;
  lookup: { getComponentName: (id: string) => string; getConfigName: (cid: string, cfgId: string) => string };
}) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(format: 'mermaid' | 'text') {
    const text = format === 'mermaid'
      ? flowToMermaid(configuration, lookup)
      : flowToText(configuration, lookup);
    navigator.clipboard.writeText(text);
    setCopied(format);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => copy('mermaid')} className="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">
        {copied === 'mermaid' ? 'Copied!' : 'Copy Mermaid'}
      </button>
      <button onClick={() => copy('text')} className="rounded border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">
        {copied === 'text' ? 'Copied!' : 'Copy as Text'}
      </button>
    </div>
  );
});

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
  const updateRow = useUpdateConfigurationRow(componentId ?? '', configId ?? '');
  const copyConfig = useCopyConfiguration(componentId ?? '');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyName, setCopyName] = useState('');

  const handleRename = useCallback((name: string) => {
    updateConfig.mutate({ name, changeDescription: 'Renamed via kbc-ui-next' });
  }, [updateConfig]);

  const handleDescriptionChange = useCallback((description: string) => {
    updateConfig.mutate({ description, changeDescription: 'Updated description via kbc-ui-next' });
  }, [updateConfig]);

  const handleToggleDisable = useCallback(() => {
    if (!config) return;
    updateConfig.mutate({
      isDisabled: !config.isDisabled,
      changeDescription: config.isDisabled ? 'Enabled via kbc-ui-next' : 'Disabled via kbc-ui-next',
    });
  }, [updateConfig, config]);

  const handleToggleRowDisable = useCallback((rowId: string, currentlyDisabled: boolean) => {
    updateRow.mutate({
      rowId,
      isDisabled: !currentlyDisabled,
      changeDescription: currentlyDisabled ? 'Enabled row via kbc-ui-next' : 'Disabled row via kbc-ui-next',
    });
  }, [updateRow]);

  const handleCopy = useCallback(async () => {
    if (!copyName.trim()) return;
    const result = await copyConfig.mutateAsync({ configId: configId ?? '', newName: copyName.trim() });
    setShowCopyModal(false);
    setCopyName('');
    navigate(`/components/${encodeURIComponent(componentId ?? '')}/${result.id}`);
  }, [copyConfig, configId, copyName, componentId, navigate]);
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
        title={
          <EditableText
            value={config.name}
            onSave={handleRename}
            className="text-xl font-bold text-gray-900 md:text-2xl"
          />
        }
        description={
          <EditableText
            value={config.description}
            onSave={handleDescriptionChange}
            placeholder="Add description..."
            className="text-sm text-gray-500"
          />
        }
        actions={
          <div className="flex items-center gap-2">
            <RunButton componentId={componentId ?? ''} configId={configId ?? ''} label="Run Component" />
            <button
              onClick={handleToggleDisable}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                config.isDisabled
                  ? 'border-green-300 text-green-600 hover:bg-green-50'
                  : 'border-orange-300 text-orange-600 hover:bg-orange-50'
              }`}
            >
              {config.isDisabled ? 'Enable' : 'Disable'}
            </button>
            <button
              onClick={() => { setCopyName(`Copy of ${config.name}`); setShowCopyModal(true); }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Copy
            </button>
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
            <FlowCopyButtons
              configuration={config.configuration as Record<string, unknown>}
              lookup={{ getComponentName, getConfigName }}
            />
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

      {/* Transformation code: phases & blocks (structured) or flat code editor (fallback) */}
      {isTransformation && hasBlockStructure(config.configuration as Record<string, unknown>) && (
        <TransformationBlocks
          configuration={config.configuration as Record<string, unknown>}
          language={componentId?.includes('python') ? 'python' : 'sql'}
          onSave={async (newConfig) => {
            await updateConfig.mutateAsync({
              configuration: newConfig,
              changeDescription: 'Updated queries via kbc-ui-next',
            });
          }}
          isSaving={updateConfig.isPending}
        />
      )}
      {isTransformation && !hasBlockStructure(config.configuration as Record<string, unknown>) && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-neutral-900">Code</h2>
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
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleToggleRowDisable(row.id, row.isDisabled); }}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                          row.isDisabled ? 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-700' : 'bg-green-50 text-green-700 hover:bg-orange-50 hover:text-orange-600'
                        }`}
                        title={row.isDisabled ? 'Click to enable' : 'Click to disable'}
                      >
                        {row.isDisabled ? 'Disabled' : 'Active'}
                      </button>
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

      {/* Copy Configuration Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Copy Configuration</h3>
            <label className="mb-1 block text-sm font-medium text-gray-600">New name</label>
            <input
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCopy(); }}
              className="mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!copyName.trim() || copyConfig.isPending}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-gray-300"
              >
                {copyConfig.isPending ? 'Copying...' : 'Copy'}
              </button>
            </div>
            {copyConfig.error instanceof Error && (
              <p className="mt-3 text-sm text-red-600">{copyConfig.error.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
