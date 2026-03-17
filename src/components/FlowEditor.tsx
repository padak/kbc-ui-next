// file: components/FlowEditor.tsx
// Flow phase/task editor: add/remove/reorder phases and tasks.
// Works alongside FlowBuilder visualization.
// Used by: ConfigurationDetailPage for flow components.
// Edits phases[] and tasks[] arrays, saves via onSave callback.

import { useState } from 'react';
import { useComponents } from '@/hooks/useComponents';

type FlowEditorProps = {
  configuration: Record<string, unknown>;
  onSave: (newConfig: Record<string, unknown>) => Promise<void>;
  isSaving: boolean;
};

type RawPhase = {
  id: number;
  name: string;
  dependsOn: number[];
};

type RawTask = {
  id: number;
  name: string;
  phase: number;
  task: {
    componentId: string;
    configId: string;
    mode: string;
  };
  continueOnFailure: boolean;
  enabled: boolean;
};

// -- Pure helpers (exported for testing) --

export function getPhases(config: Record<string, unknown>): RawPhase[] {
  return (config.phases as RawPhase[] | undefined) ?? [];
}

export function getTasks(config: Record<string, unknown>): RawTask[] {
  return (config.tasks as RawTask[] | undefined) ?? [];
}

function nextId(existingIds: number[]): number {
  if (existingIds.length === 0) return 1;
  return Math.max(...existingIds) + 1;
}

export function addPhase(config: Record<string, unknown>, name: string): Record<string, unknown> {
  const phases = getPhases(config);
  const tasks = getTasks(config);
  const allIds = [...phases.map((p) => p.id), ...tasks.map((t) => t.id)];
  const newId = nextId(allIds);
  // New phase depends on the last existing phase (sequential by default)
  const dependsOn = phases.length > 0 ? [phases[phases.length - 1]!.id] : [];
  return {
    ...config,
    phases: [...phases, { id: newId, name, dependsOn }],
  };
}

export function removePhase(config: Record<string, unknown>, phaseId: number): Record<string, unknown> {
  const phases = getPhases(config);
  const tasks = getTasks(config);
  return {
    ...config,
    phases: phases.filter((p) => p.id !== phaseId).map((p) => ({
      ...p,
      dependsOn: p.dependsOn.filter((d) => d !== phaseId),
    })),
    tasks: tasks.filter((t) => t.phase !== phaseId),
  };
}

export function updatePhaseName(config: Record<string, unknown>, phaseId: number, name: string): Record<string, unknown> {
  const phases = getPhases(config);
  return {
    ...config,
    phases: phases.map((p) => (p.id === phaseId ? { ...p, name } : p)),
  };
}

export function addTask(
  config: Record<string, unknown>,
  phaseId: number,
  componentId: string,
  configId: string,
): Record<string, unknown> {
  const phases = getPhases(config);
  const tasks = getTasks(config);
  const allIds = [...phases.map((p) => p.id), ...tasks.map((t) => t.id)];
  const newId = nextId(allIds);
  const newTask: RawTask = {
    id: newId,
    name: `Task ${newId}`,
    phase: phaseId,
    task: { componentId, configId, mode: 'run' },
    continueOnFailure: false,
    enabled: true,
  };
  return {
    ...config,
    tasks: [...tasks, newTask],
  };
}

export function removeTask(config: Record<string, unknown>, taskId: number): Record<string, unknown> {
  const tasks = getTasks(config);
  return {
    ...config,
    tasks: tasks.filter((t) => t.id !== taskId),
  };
}

export function toggleTask(config: Record<string, unknown>, taskId: number): Record<string, unknown> {
  const tasks = getTasks(config);
  return {
    ...config,
    tasks: tasks.map((t) => (t.id === taskId ? { ...t, enabled: !t.enabled } : t)),
  };
}

// -- Add Task inline form --

function AddTaskForm({
  components,
  onAdd,
  onCancel,
}: {
  components: Array<{ id: string; name: string; configurations?: Array<{ id: string; name: string }> }>;
  onAdd: (componentId: string, configId: string) => void;
  onCancel: () => void;
}) {
  const [selectedComponent, setSelectedComponent] = useState('');
  const [selectedConfig, setSelectedConfig] = useState('');

  const selectedComponentData = components.find((c) => c.id === selectedComponent);
  const configs = selectedComponentData?.configurations ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedComponent || !selectedConfig) return;
    onAdd(selectedComponent, selectedConfig);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex items-end gap-2 rounded-md border border-blue-200 bg-blue-50 p-3">
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-600">Component</label>
        <select
          value={selectedComponent}
          onChange={(e) => {
            setSelectedComponent(e.target.value);
            setSelectedConfig('');
          }}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          autoFocus
        >
          <option value="">Select component...</option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-600">Configuration</label>
        <select
          value={selectedConfig}
          onChange={(e) => setSelectedConfig(e.target.value)}
          disabled={!selectedComponent || configs.length === 0}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        >
          <option value="">Select configuration...</option>
          {configs.map((cfg) => (
            <option key={cfg.id} value={cfg.id}>
              {cfg.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={!selectedComponent || !selectedConfig}
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

// -- Phase section --

function PhaseSection({
  phase,
  tasks,
  components,
  onRemovePhase,
  onUpdateName,
  onAddTask,
  onRemoveTask,
  onToggleTask,
  componentLookup,
}: {
  phase: RawPhase;
  tasks: RawTask[];
  components: Array<{ id: string; name: string; configurations?: Array<{ id: string; name: string }> }>;
  onRemovePhase: () => void;
  onUpdateName: (name: string) => void;
  onAddTask: (componentId: string, configId: string) => void;
  onRemoveTask: (taskId: number) => void;
  onToggleTask: (taskId: number) => void;
  componentLookup: Map<string, string>;
}) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(phase.name);

  function handleDeletePhase() {
    if (tasks.length > 0 && !showConfirmDelete) {
      setShowConfirmDelete(true);
      return;
    }
    onRemovePhase();
  }

  function handleSaveName() {
    if (editName.trim()) {
      onUpdateName(editName.trim());
    }
    setIsEditingName(false);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <div className="flex items-center gap-2">
          {isEditingName ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') {
                  setEditName(phase.name);
                  setIsEditingName(false);
                }
              }}
              className="rounded border border-gray-300 px-2 py-0.5 text-sm font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditName(phase.name);
                setIsEditingName(true);
              }}
              className="text-sm font-semibold text-gray-900 hover:text-blue-600"
              title="Click to rename"
            >
              {phase.name}
            </button>
          )}
          <span className="text-xs text-gray-400">ID: {phase.id}</span>
          {phase.dependsOn.length > 0 && (
            <span className="text-xs text-gray-400">
              depends on: [{phase.dependsOn.join(', ')}]
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!showAddTask && (
            <button
              type="button"
              onClick={() => setShowAddTask(true)}
              className="rounded-md border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              + Add Task
            </button>
          )}
          <button
            type="button"
            onClick={handleDeletePhase}
            className="rounded-md border border-red-200 px-2 py-0.5 text-xs text-red-500 hover:bg-red-50"
          >
            Remove Phase
          </button>
        </div>
      </div>

      {showConfirmDelete && (
        <div className="border-b border-yellow-200 bg-yellow-50 px-4 py-2 text-sm">
          <span className="text-yellow-800">This phase has {tasks.length} task(s). Remove anyway?</span>
          <button
            type="button"
            onClick={() => {
              onRemovePhase();
              setShowConfirmDelete(false);
            }}
            className="ml-2 text-sm font-medium text-red-600 hover:text-red-800"
          >
            Yes, remove
          </button>
          <button
            type="button"
            onClick={() => setShowConfirmDelete(false)}
            className="ml-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="p-3">
        {tasks.length > 0 ? (
          <div className="space-y-1">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 ${
                  task.enabled ? 'bg-white' : 'bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onToggleTask(task.id)}
                    className={`h-4 w-4 rounded border ${
                      task.enabled
                        ? 'border-green-500 bg-green-500'
                        : 'border-gray-300 bg-white'
                    }`}
                    title={task.enabled ? 'Enabled - click to disable' : 'Disabled - click to enable'}
                  >
                    {task.enabled && (
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {componentLookup.get(task.task.componentId) ?? task.task.componentId}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">
                      config: {task.task.configId}
                    </span>
                    {task.continueOnFailure && (
                      <span className="ml-2 rounded bg-yellow-50 px-1 py-0.5 text-[10px] text-yellow-600">
                        continue on failure
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveTask(task.id)}
                  className="text-red-400 hover:text-red-600"
                  title="Remove task"
                >
                  &#10005;
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-2 text-center text-sm text-gray-400">No tasks in this phase.</p>
        )}

        {showAddTask && (
          <AddTaskForm
            components={components}
            onAdd={(componentId, configId) => {
              onAddTask(componentId, configId);
              setShowAddTask(false);
            }}
            onCancel={() => setShowAddTask(false)}
          />
        )}
      </div>
    </div>
  );
}

// -- Main component --

export function FlowEditor({ configuration, onSave, isSaving }: FlowEditorProps) {
  const { data: allComponents } = useComponents();
  const [pendingConfig, setPendingConfig] = useState<Record<string, unknown> | null>(null);

  const config = pendingConfig ?? configuration;
  const phases = getPhases(config);
  const tasks = getTasks(config);

  const hasChanges = pendingConfig !== null;

  // Build component list with configurations for the Add Task dropdown
  const componentsWithConfigs = (allComponents ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    configurations: ((c as Record<string, unknown>).configurations as Array<{ id: string; name: string }>) ?? [],
  }));

  // Component name lookup
  const componentLookup = new Map<string, string>();
  for (const c of componentsWithConfigs) {
    componentLookup.set(c.id, c.name);
  }

  function updateConfig(newConfig: Record<string, unknown>) {
    setPendingConfig(newConfig);
  }

  async function handleSave() {
    if (!pendingConfig) return;
    await onSave(pendingConfig);
    setPendingConfig(null);
  }

  function handleDiscard() {
    setPendingConfig(null);
  }

  function handleAddPhase() {
    const name = `Phase ${phases.length + 1}`;
    updateConfig(addPhase(config, name));
  }

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Flow Editor</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddPhase}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            + Add Phase
          </button>
          {hasChanges && (
            <>
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
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {phases.length === 0 && (
        <p className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-400">
          No phases defined. Click &quot;+ Add Phase&quot; to get started.
        </p>
      )}

      <div className="space-y-3">
        {phases.map((phase) => {
          const phaseTasks = tasks.filter((t) => t.phase === phase.id);
          return (
            <PhaseSection
              key={phase.id}
              phase={phase}
              tasks={phaseTasks}
              components={componentsWithConfigs}
              onRemovePhase={() => updateConfig(removePhase(config, phase.id))}
              onUpdateName={(name) => updateConfig(updatePhaseName(config, phase.id, name))}
              onAddTask={(componentId, configId) => updateConfig(addTask(config, phase.id, componentId, configId))}
              onRemoveTask={(taskId) => updateConfig(removeTask(config, taskId))}
              onToggleTask={(taskId) => updateConfig(toggleTask(config, taskId))}
              componentLookup={componentLookup}
            />
          );
        })}
      </div>
    </div>
  );
}
