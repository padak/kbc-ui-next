// file: components/FlowBuilder.tsx
// Visual flow builder: renders phases as nodes with tasks, connected by edges.
// Uses @xyflow/react for graph rendering + elkjs for auto-layout.
// Used by: ConfigurationDetailPage when component is keboola.orchestrator or keboola.flow.
// Read-only visualization for now, edit via JSON toggle.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
  MarkerType,
  type NodeTypes,
  type NodeProps,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';

// -- Types --

type TaskData = {
  id: number;
  name: string;
  componentId: string;
  configId: string;
  mode: string;
  continueOnFailure: boolean;
  enabled: boolean;
  componentName: string;
  configName: string;
  icon: string | null;
};

type PhaseData = {
  name: string;
  tasks: TaskData[];
};

type PhaseNodeData = Record<string, unknown> & PhaseData;

type FlowBuilderProps = {
  configuration: Record<string, unknown>;
  componentLookup?: {
    getComponentName: (id: string) => string;
    getComponentIcon: (id: string) => string | null;
    getConfigName: (componentId: string, configId: string) => string;
  };
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

// -- ELK Layout --

const elk = new ELK();

const TASK_COLS = 3; // tasks per row in grid
const TASK_WIDTH = 200;
const TASK_HEIGHT = 48;
const TASK_GAP = 8;
const PHASE_NODE_HEADER_HEIGHT = 36;
const PHASE_NODE_PADDING = 16;
const PHASE_NODE_EMPTY_HEIGHT = 40;

function estimateNodeWidth(taskCount: number): number {
  const cols = Math.min(taskCount, TASK_COLS);
  if (cols === 0) return TASK_WIDTH + PHASE_NODE_PADDING * 2;
  return cols * TASK_WIDTH + (cols - 1) * TASK_GAP + PHASE_NODE_PADDING * 2;
}

function estimateNodeHeight(taskCount: number): number {
  if (taskCount === 0) return PHASE_NODE_HEADER_HEIGHT + PHASE_NODE_EMPTY_HEIGHT + PHASE_NODE_PADDING;
  const rows = Math.ceil(taskCount / TASK_COLS);
  return PHASE_NODE_HEADER_HEIGHT + rows * TASK_HEIGHT + (rows - 1) * TASK_GAP + PHASE_NODE_PADDING;
}

async function getLayoutedElements(
  nodes: Node<PhaseNodeData>[],
  edges: Edge[],
): Promise<Node<PhaseNodeData>[]> {
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '50',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: estimateNodeWidth(n.data.tasks?.length ?? 0),
      height: estimateNodeHeight(n.data.tasks?.length ?? 0),
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const layout = await elk.layout(graph);

  return nodes.map((node) => {
    const pos = layout.children?.find((c: { id: string }) => c.id === node.id);
    return {
      ...node,
      position: { x: pos?.x ?? 0, y: pos?.y ?? 0 },
    };
  });
}

// -- Phase Node Component --

function PhaseNode({ data }: NodeProps<Node<PhaseNodeData>>) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-md">
      <Handle type="target" position={Position.Top} className="!bg-gray-300 !w-2 !h-2" />
      <div className="rounded-t-lg bg-gray-800 px-3 py-1.5 text-center text-[10px] font-semibold text-white">
        {data.name}
      </div>
      <div className="p-2">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(data.tasks.length, TASK_COLS)}, ${TASK_WIDTH}px)` }}>
          {data.tasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-2 rounded-md border border-gray-100 bg-white px-2.5 py-2 shadow-sm ${
                task.enabled ? '' : 'opacity-40'
              }`}
              style={{ width: TASK_WIDTH }}
            >
              {task.icon && <img src={task.icon} className="h-5 w-5 shrink-0 rounded" alt="" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-gray-900">{task.configName}</p>
                <p className="truncate text-[9px] text-gray-400">{task.componentName}</p>
              </div>
            </div>
          ))}
        </div>
        {data.tasks.length === 0 && (
          <p className="py-2 text-center text-[10px] text-gray-400">No tasks</p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-300 !w-2 !h-2" />
    </div>
  );
}

// -- Parsing --

function parseConfiguration(
  configuration: Record<string, unknown>,
  componentLookup?: FlowBuilderProps['componentLookup'],
): { nodes: Node<PhaseNodeData>[]; edges: Edge[] } {
  const phases = (configuration.phases as RawPhase[] | undefined) ?? [];
  const tasks = (configuration.tasks as RawTask[] | undefined) ?? [];

  // Group tasks by phase
  const tasksByPhase = new Map<number, TaskData[]>();
  for (const task of tasks) {
    const phaseId = task.phase;
    if (!tasksByPhase.has(phaseId)) {
      tasksByPhase.set(phaseId, []);
    }
    const componentId = task.task?.componentId ?? '';
    const configId = task.task?.configId ?? '';
    tasksByPhase.get(phaseId)!.push({
      id: task.id,
      name: task.name,
      componentId,
      configId,
      mode: task.task?.mode ?? 'run',
      continueOnFailure: task.continueOnFailure ?? false,
      enabled: task.enabled ?? true,
      componentName: componentLookup?.getComponentName(componentId) ?? componentId,
      configName: componentLookup?.getConfigName(componentId, configId) ?? configId,
      icon: componentLookup?.getComponentIcon(componentId) ?? null,
    });
  }

  // Build nodes
  const nodes: Node<PhaseNodeData>[] = phases.map((phase) => ({
    id: String(phase.id),
    type: 'phaseNode',
    position: { x: 0, y: 0 }, // will be set by ELK
    data: {
      name: phase.name,
      tasks: tasksByPhase.get(phase.id) ?? [],
    },
  }));

  // Build edges from dependsOn
  const edges: Edge[] = [];
  for (const phase of phases) {
    if (phase.dependsOn && phase.dependsOn.length > 0) {
      for (const depId of phase.dependsOn) {
        edges.push({
          id: `e-${depId}-${phase.id}`,
          source: String(depId),
          target: String(phase.id),
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
          style: { stroke: '#94a3b8', strokeWidth: 1.5 },
        });
      }
    }
  }

  // If no dependsOn edges exist, create sequential edges (fallback for keboola.flow)
  if (edges.length === 0 && phases.length > 1) {
    for (let i = 0; i < phases.length - 1; i++) {
      const current = phases[i]!;
      const next = phases[i + 1]!;
      edges.push({
        id: `e-seq-${current.id}-${next.id}`,
        source: String(current.id),
        target: String(next.id),
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
        style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      });
    }
  }

  return { nodes, edges };
}

// Export for testing
export { parseConfiguration, estimateNodeHeight };
export type { PhaseNodeData, FlowBuilderProps, TaskData, RawPhase, RawTask };

// -- Main Component --

const nodeTypes: NodeTypes = { phaseNode: PhaseNode };

export function FlowBuilder({ configuration, componentLookup }: FlowBuilderProps) {
  const { nodes: initialNodes, edges } = useMemo(
    () => parseConfiguration(configuration, componentLookup),
    [configuration, componentLookup],
  );

  const [layoutedNodes, setLayoutedNodes] = useState<Node<PhaseNodeData>[]>([]);
  const [isLayouting, setIsLayouting] = useState(true);

  const computeLayout = useCallback(async () => {
    if (initialNodes.length === 0) {
      setLayoutedNodes([]);
      setIsLayouting(false);
      return;
    }
    setIsLayouting(true);
    try {
      const positioned = await getLayoutedElements(initialNodes, edges);
      setLayoutedNodes(positioned);
    } catch {
      // Fallback: stack nodes vertically
      setLayoutedNodes(
        initialNodes.map((node, index) => ({
          ...node,
          position: { x: 0, y: index * 200 },
        })),
      );
    }
    setIsLayouting(false);
  }, [initialNodes, edges]);

  useEffect(() => {
    void computeLayout();
  }, [computeLayout]);

  if (initialNodes.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
        No phases defined in this flow configuration.
      </div>
    );
  }

  if (isLayouting) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 py-12 text-gray-400">
        Computing layout...
      </div>
    );
  }

  return (
    <div className="h-[500px] rounded-lg border border-gray-200 bg-gray-50">
      <ReactFlow
        nodes={layoutedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
