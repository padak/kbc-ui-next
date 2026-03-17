// file: components/MappingEditor.tsx
// Input/Output table mapping editor for transformations.
// Shows source -> destination pairs with add/remove functionality.
// Used by: ConfigurationDetailPage for transformation components.
// Reads available tables from Storage API via useTables hook.

import { useState } from 'react';
import { useTables } from '@/hooks/useStorage';

type MappingEditorProps = {
  configuration: Record<string, unknown>;
  onSave: (newConfig: Record<string, unknown>) => Promise<void>;
  isSaving: boolean;
};

type InputMapping = {
  source: string;
  destination: string;
};

type OutputMapping = {
  source: string;
  destination: string;
  incremental?: boolean;
};

// -- Pure helpers (exported for testing) --

export function getInputMappings(config: Record<string, unknown>): InputMapping[] {
  const storage = config.storage as Record<string, unknown> | undefined;
  const input = storage?.input as Record<string, unknown> | undefined;
  return (input?.tables as InputMapping[]) ?? [];
}

export function getOutputMappings(config: Record<string, unknown>): OutputMapping[] {
  const storage = config.storage as Record<string, unknown> | undefined;
  const output = storage?.output as Record<string, unknown> | undefined;
  return (output?.tables as OutputMapping[]) ?? [];
}

export function setInputMappings(config: Record<string, unknown>, mappings: InputMapping[]): Record<string, unknown> {
  const storage = (config.storage as Record<string, unknown>) ?? {};
  const input = (storage.input as Record<string, unknown>) ?? {};
  return {
    ...config,
    storage: {
      ...storage,
      input: {
        ...input,
        tables: mappings,
      },
    },
  };
}

export function setOutputMappings(config: Record<string, unknown>, mappings: OutputMapping[]): Record<string, unknown> {
  const storage = (config.storage as Record<string, unknown>) ?? {};
  const output = (storage.output as Record<string, unknown>) ?? {};
  return {
    ...config,
    storage: {
      ...storage,
      output: {
        ...output,
        tables: mappings,
      },
    },
  };
}

// -- Inline add-mapping form --

function AddMappingForm({
  type,
  tableIds,
  onAdd,
  onCancel,
}: {
  type: 'input' | 'output';
  tableIds: string[];
  onAdd: (source: string, destination: string) => void;
  onCancel: () => void;
}) {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!source.trim() || !destination.trim()) return;
    onAdd(source.trim(), destination.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-md border border-blue-200 bg-blue-50 p-3">
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          {type === 'input' ? 'Source (storage table)' : 'Source (output name)'}
        </label>
        {type === 'input' ? (
          <>
            <input
              list="table-options"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. in.c-data.sales"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <datalist id="table-options">
              {tableIds.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
          </>
        ) : (
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g. output"
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
        )}
      </div>
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          {type === 'input' ? 'Destination (alias)' : 'Destination (storage table)'}
        </label>
        {type === 'output' ? (
          <>
            <input
              list="table-options-output"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. out.c-results.aggregated"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <datalist id="table-options-output">
              {tableIds.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
          </>
        ) : (
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. sales"
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        )}
      </div>
      <button
        type="submit"
        disabled={!source.trim() || !destination.trim()}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
      >
        Add
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
      >
        Cancel
      </button>
    </form>
  );
}

// -- Mapping table section --

function MappingSection({
  title,
  type,
  mappings,
  tableIds,
  onAdd,
  onRemove,
}: {
  title: string;
  type: 'input' | 'output';
  mappings: Array<{ source: string; destination: string; incremental?: boolean }>;
  tableIds: string[];
  onAdd: (source: string, destination: string) => void;
  onRemove: (index: number) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            + Add Mapping
          </button>
        )}
      </div>

      {mappings.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  {type === 'input' ? 'Source (Storage Table)' : 'Source (Output Name)'}
                </th>
                <th className="px-3 py-2 text-center text-xs text-gray-400">{' '}</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  {type === 'input' ? 'Destination (Alias)' : 'Destination (Storage Table)'}
                </th>
                {type === 'output' && (
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Incremental</th>
                )}
                <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">{' '}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {mappings.map((mapping, index) => (
                <tr key={`${mapping.source}-${mapping.destination}-${index}`}>
                  <td className="px-3 py-2 font-mono text-sm text-gray-700">
                    {type === 'input' && (
                      <span className="mr-1 inline-block rounded bg-blue-50 px-1 py-0.5 text-[10px] font-medium text-blue-600">
                        {mapping.source.startsWith('out.') ? 'out' : 'in'}
                      </span>
                    )}
                    {mapping.source}
                  </td>
                  <td className="px-1 py-2 text-center text-gray-400">&#8594;</td>
                  <td className="px-3 py-2 font-mono text-sm text-gray-700">
                    {type === 'output' && (
                      <span className="mr-1 inline-block rounded bg-green-50 px-1 py-0.5 text-[10px] font-medium text-green-600">
                        {mapping.destination.startsWith('out.') ? 'out' : 'in'}
                      </span>
                    )}
                    {mapping.destination}
                  </td>
                  {type === 'output' && (
                    <td className="px-3 py-2 text-sm text-gray-500">
                      {mapping.incremental ? 'Yes' : 'No'}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      className="text-red-400 hover:text-red-600"
                      title="Remove mapping"
                    >
                      &#10005;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mappings.length === 0 && !showAddForm && (
        <p className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-sm text-gray-400">
          No mappings configured.
        </p>
      )}

      {showAddForm && (
        <div className="mt-2">
          <AddMappingForm
            type={type}
            tableIds={tableIds}
            onAdd={(source, destination) => {
              onAdd(source, destination);
              setShowAddForm(false);
            }}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}
    </div>
  );
}

// -- Main component --

export function MappingEditor({ configuration, onSave, isSaving }: MappingEditorProps) {
  const { data: tables } = useTables();
  const [pendingConfig, setPendingConfig] = useState<Record<string, unknown> | null>(null);

  const config = pendingConfig ?? configuration;
  const inputMappings = getInputMappings(config);
  const outputMappings = getOutputMappings(config);

  const tableIds = (tables ?? []).map((t) => t.id);

  const hasChanges = pendingConfig !== null;

  function updateConfig(newConfig: Record<string, unknown>) {
    setPendingConfig(newConfig);
  }

  function handleAddInput(source: string, destination: string) {
    const updated = setInputMappings(config, [...inputMappings, { source, destination }]);
    updateConfig(updated);
  }

  function handleRemoveInput(index: number) {
    const updated = setInputMappings(config, inputMappings.filter((_, i) => i !== index));
    updateConfig(updated);
  }

  function handleAddOutput(source: string, destination: string) {
    const updated = setOutputMappings(config, [...outputMappings, { source, destination, incremental: false }]);
    updateConfig(updated);
  }

  function handleRemoveOutput(index: number) {
    const updated = setOutputMappings(config, outputMappings.filter((_, i) => i !== index));
    updateConfig(updated);
  }

  async function handleSave() {
    if (!pendingConfig) return;
    await onSave(pendingConfig);
    setPendingConfig(null);
  }

  function handleDiscard() {
    setPendingConfig(null);
  }

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Table Mapping</h2>
        {hasChanges && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
            >
              {isSaving ? 'Saving...' : 'Save Mappings'}
            </button>
          </div>
        )}
      </div>

      <MappingSection
        title="Table Input Mapping"
        type="input"
        mappings={inputMappings}
        tableIds={tableIds}
        onAdd={handleAddInput}
        onRemove={handleRemoveInput}
      />

      <MappingSection
        title="Table Output Mapping"
        type="output"
        mappings={outputMappings}
        tableIds={tableIds}
        onAdd={handleAddOutput}
        onRemove={handleRemoveOutput}
      />
    </div>
  );
}
