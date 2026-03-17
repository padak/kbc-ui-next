// file: lib/flowToMermaid.ts
// Converts Keboola flow configuration JSON to Mermaid diagram text.
// Useful for AI context: agent gets a readable DAG representation.
// Used by: FlowBuilder (export), future AI-driven flow editing.
// Supports both keboola.orchestrator (dependsOn) and keboola.flow formats.

type Phase = { id: number | string; name: string; dependsOn?: (number | string)[] };
type Task = {
  id: number | string;
  name: string;
  phase: number | string;
  enabled?: boolean;
  task?: { componentId?: string; configId?: string; mode?: string };
};

type ComponentLookup = {
  getComponentName?: (id: string) => string;
  getConfigName?: (componentId: string, configId: string) => string;
};

export function flowToMermaid(
  configuration: Record<string, unknown>,
  lookup?: ComponentLookup,
): string {
  const phases = (configuration.phases as Phase[] | undefined) ?? [];
  const tasks = (configuration.tasks as Task[] | undefined) ?? [];

  if (phases.length === 0) return 'graph TD\n  empty[No phases defined]';

  // Group tasks by phase
  const tasksByPhase = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = String(task.phase);
    if (!tasksByPhase.has(key)) tasksByPhase.set(key, []);
    tasksByPhase.get(key)!.push(task);
  }

  const lines: string[] = ['graph TD'];

  // Generate phase nodes with task details
  for (const phase of phases) {
    const pid = `phase_${phase.id}`;
    const phaseTasks = tasksByPhase.get(String(phase.id)) ?? [];
    const enabledTasks = phaseTasks.filter((t) => t.enabled !== false);

    if (enabledTasks.length === 0) {
      lines.push(`  ${pid}["${esc(phase.name)}<br/><i>no tasks</i>"]`);
    } else {
      const taskLines = enabledTasks.map((t) => {
        const compId = t.task?.componentId ?? '';
        const cfgId = t.task?.configId ?? '';
        const compName = lookup?.getComponentName?.(compId) ?? compId;
        const cfgName = cfgId ? (lookup?.getConfigName?.(compId, cfgId) ?? cfgId) : '';
        return cfgName ? `${compName}: ${cfgName}` : compName;
      });
      const label = `${esc(phase.name)}<br/>${taskLines.map(esc).join('<br/>')}`;
      lines.push(`  ${pid}["${label}"]`);
    }
  }

  // Generate edges
  for (const phase of phases) {
    const deps = phase.dependsOn ?? [];
    if (deps.length > 0) {
      for (const dep of deps) {
        lines.push(`  phase_${dep} --> phase_${phase.id}`);
      }
    }
  }

  // If no dependsOn found anywhere, create sequential edges
  const hasDeps = phases.some((p) => p.dependsOn && p.dependsOn.length > 0);
  if (!hasDeps && phases.length > 1) {
    for (let i = 1; i < phases.length; i++) {
      lines.push(`  phase_${phases[i - 1]!.id} --> phase_${phases[i]!.id}`);
    }
  }

  return lines.join('\n');
}

function esc(s: string): string {
  return s.replace(/"/g, "'").replace(/[<>]/g, '');
}

// Compact text representation for AI context (no Mermaid syntax, just structure)
export function flowToText(
  configuration: Record<string, unknown>,
  lookup?: ComponentLookup,
): string {
  const phases = (configuration.phases as Phase[] | undefined) ?? [];
  const tasks = (configuration.tasks as Task[] | undefined) ?? [];

  if (phases.length === 0) return 'Empty flow (no phases)';

  const tasksByPhase = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = String(task.phase);
    if (!tasksByPhase.has(key)) tasksByPhase.set(key, []);
    tasksByPhase.get(key)!.push(task);
  }

  const lines: string[] = [];
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i]!;
    const phaseTasks = tasksByPhase.get(String(phase.id)) ?? [];
    lines.push(`Phase ${i + 1}: ${phase.name}`);
    if (phaseTasks.length === 0) {
      lines.push('  (no tasks)');
    } else {
      for (const t of phaseTasks) {
        const compId = t.task?.componentId ?? 'unknown';
        const cfgId = t.task?.configId ?? '';
        const compName = lookup?.getComponentName?.(compId) ?? compId;
        const cfgName = cfgId ? (lookup?.getConfigName?.(compId, cfgId) ?? cfgId) : '';
        const status = t.enabled === false ? ' [DISABLED]' : '';
        lines.push(`  - ${compName}${cfgName ? `: ${cfgName}` : ''}${status}`);
      }
    }
  }
  return lines.join('\n');
}
