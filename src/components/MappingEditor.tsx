// file: components/MappingEditor.tsx
// Input/Output table mapping editor for transformations.
// Collapsible sections with item count badges for compact overview.
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

// Threshold: auto-collapse mapping sections with more items than this
const COLLAPSE_THRESHOLD = 8;

// Extract table names created in SQL blocks (CREATE TABLE "name" / CREATE TABLE name)
// Used to suggest output mapping sources from code.
export function extractCreatedTables(config: Record<string, unknown>): string[] {
  const params = config?.parameters as Record<string, unknown> | undefined;
  const blocks = params?.blocks as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(blocks)) return [];

  const tables = new Set<string>();
  const pattern = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMPORARY\s+|TEMP\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|([a-zA-Z_]\w*))/gi;

  for (const block of blocks) {
    if (block.disabled) continue;
    const codes = block.codes as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(codes)) continue;
    for (const code of codes) {
      if (code.disabled) continue;
      const script = code.script ?? code._savedScript;
      const text = Array.isArray(script) ? script.join('\n') : String(script ?? '');
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1] ?? match[2];
        if (name) tables.add(name);
      }
    }
  }

  return [...tables].sort();
}

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

// -- Chevron icon --

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  );
}

// -- Inline add-mapping form --

function AddMappingForm({
  type,
  tableIds,
  outputSuggestions,
  onAdd,
  onCancel,
}: {
  type: 'input' | 'output';
  tableIds: string[];
  outputSuggestions?: string[];
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
        <label className="mb-1 block text-xs font-medium text-neutral-600">
          {type === 'input' ? 'Source (storage table)' : 'Source (output name)'}
        </label>
        {type === 'input' ? (
          <>
            <input
              list="table-options"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. in.c-data.sales"
              className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <datalist id="table-options">
              {tableIds.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
          </>
        ) : (
          <>
            <input
              list={outputSuggestions?.length ? 'output-source-options' : undefined}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. output"
              className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            {outputSuggestions && outputSuggestions.length > 0 && (
              <datalist id="output-source-options">
                {outputSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            )}
          </>
        )}
      </div>
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-neutral-600">
          {type === 'input' ? 'Destination (alias)' : 'Destination (storage table)'}
        </label>
        {type === 'output' ? (
          <>
            <input
              list="table-options-output"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. out.c-results.aggregated"
              className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
      >
        Cancel
      </button>
    </form>
  );
}

// -- Collapsible mapping table section --

function MappingSection({
  title,
  type,
  mappings,
  tableIds,
  outputSuggestions,
  onAdd,
  onRemove,
}: {
  title: string;
  type: 'input' | 'output';
  mappings: Array<{ source: string; destination: string; incremental?: boolean }>;
  tableIds: string[];
  outputSuggestions?: string[];
  onAdd: (source: string, destination: string) => void;
  onRemove: (index: number) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [expanded, setExpanded] = useState(mappings.length <= COLLAPSE_THRESHOLD);

  return (
    <div className="mb-3">
      {/* Collapsible header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 py-1.5 text-left"
        >
          <Chevron open={expanded} />
          <h3 className="text-sm font-semibold text-neutral-700">{title}</h3>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
            {mappings.length}
          </span>
        </button>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => { setShowAddForm(true); setExpanded(true); }}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            + Add Mapping
          </button>
        )}
      </div>

      {/* Expanded table */}
      {expanded && mappings.length > 0 && (
        <div className="mt-1 overflow-x-auto rounded-md border border-neutral-200">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-3 py-1.5 text-left text-xs font-medium uppercase text-neutral-500">
                  {type === 'input' ? 'Source (Storage Table)' : 'Source (Output Name)'}
                </th>
                <th className="w-8 px-1 py-1.5 text-center text-xs text-neutral-400"> </th>
                <th className="px-3 py-1.5 text-left text-xs font-medium uppercase text-neutral-500">
                  {type === 'input' ? 'Destination (Alias)' : 'Destination (Storage Table)'}
                </th>
                {type === 'output' && (
                  <th className="px-3 py-1.5 text-left text-xs font-medium uppercase text-neutral-500">Incr.</th>
                )}
                <th className="w-8 px-3 py-1.5 text-right text-xs font-medium uppercase text-neutral-500"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {mappings.map((mapping, index) => (
                <tr key={`${mapping.source}-${mapping.destination}-${index}`} className="hover:bg-neutral-50">
                  <td className="px-3 py-1.5 font-mono text-xs text-neutral-700">
                    {type === 'input' && (
                      <span className={`mr-1.5 inline-block rounded px-1 py-0.5 text-[10px] font-medium ${
                        mapping.source.startsWith('out.') ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {mapping.source.startsWith('out.') ? 'out' : 'in'}
                      </span>
                    )}
                    {mapping.source}
                  </td>
                  <td className="px-1 py-1.5 text-center text-neutral-300">&rarr;</td>
                  <td className="px-3 py-1.5 font-mono text-xs text-neutral-700">
                    {type === 'output' && (
                      <span className="mr-1.5 inline-block rounded bg-green-50 px-1 py-0.5 text-[10px] font-medium text-green-600">
                        {mapping.destination.startsWith('out.') ? 'out' : 'in'}
                      </span>
                    )}
                    {mapping.destination}
                  </td>
                  {type === 'output' && (
                    <td className="px-3 py-1.5 text-xs text-neutral-500">
                      {mapping.incremental ? 'Yes' : 'No'}
                    </td>
                  )}
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      className="text-neutral-300 hover:text-red-500 transition-colors"
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

      {/* Collapsed summary */}
      {!expanded && mappings.length > 0 && (
        <p className="mt-1 pl-6 text-xs text-neutral-400">
          {mappings.length} {type === 'input' ? 'input' : 'output'} table{mappings.length !== 1 ? 's' : ''} mapped
        </p>
      )}

      {mappings.length === 0 && !showAddForm && (
        <p className="mt-1 rounded-md border border-dashed border-neutral-200 px-3 py-3 text-center text-xs text-neutral-400">
          No {type} mappings configured.
        </p>
      )}

      {showAddForm && (
        <div className="mt-2">
          <AddMappingForm
            type={type}
            tableIds={tableIds}
            outputSuggestions={outputSuggestions}
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
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">Table Mapping</h2>
        {hasChanges && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-md bg-green-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600 disabled:bg-green-300"
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
        outputSuggestions={extractCreatedTables(config)}
        onAdd={handleAddOutput}
        onRemove={handleRemoveOutput}
      />
    </div>
  );
}
