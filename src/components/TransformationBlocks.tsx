// file: components/TransformationBlocks.tsx
// Renders transformation code organized by phases and blocks (collapsible tree).
// Supports: edit SQL, add/remove phases & blocks, disable/enable, copy all SQL.
// Used by: ConfigurationDetailPage for transformation components.
// Disable works by moving script to _savedScript and setting script to [].

import { useState, useCallback, useMemo, lazy, Suspense } from 'react';

const SqlEditor = lazy(() => import('@/components/SqlEditor').then((m) => ({ default: m.SqlEditor })));

// -- Types matching the Keboola configuration structure --
// blocks[].codes[] only allows "name" and "script" — no extra fields.
// Disable works by commenting out SQL with a marker comment.
// Runner executes comments as NOP. UI detects the marker and shows disabled state.

const DISABLED_MARKER = '-- [DISABLED BY KBC-UI]';

type RawCode = {
  name: string;
  script: string[];
};

type RawBlock = {
  name: string;
  codes: RawCode[];
};

type CodeBlock = {
  name: string;
  script: string;
  disabled: boolean;
  _outputMappingsToRestore?: Array<{ source: string; destination: string }>;
};

type Phase = {
  name: string;
  codes: CodeBlock[];
  disabled: boolean;
  _outputMappingsToRestore?: Array<{ source: string; destination: string }>;
};

// -- Disable helpers: comment/uncomment SQL with marker --

// Comment out a single SQL statement, preserving content as comments.
// Optionally embed output mapping data for restoration on enable.
export function disableStatement(
  stmt: string,
  outputMappings?: Array<{ source: string; destination: string }>,
): string {
  const lines = stmt.split('\n');
  const commented = lines.map((line) => `-- ${line}`);
  const parts = [DISABLED_MARKER, ...commented];
  if (outputMappings && outputMappings.length > 0) {
    parts.push(...encodeOutputMappings(outputMappings));
  }
  return parts.join('\n');
}

// Restore a disabled statement by stripping marker, output mapping markers, and comment prefixes
export function enableStatement(stmt: string): string {
  const lines = stmt.split('\n');
  // Remove marker line and output mapping lines
  const codeLines = lines.filter((line) => {
    const trimmed = line.trim();
    return trimmed !== DISABLED_MARKER.trim() && !trimmed.startsWith(OUTPUT_MAPPING_MARKER.trim());
  });
  // Remove "-- " prefix from each line
  const uncommented = codeLines.map((line) => {
    if (line.startsWith('-- ')) return line.slice(3);
    if (line === '--') return '';
    return line;
  });
  return uncommented.join('\n');
}

// Check if a statement is disabled (starts with our marker)
export function isStatementDisabled(stmt: string): boolean {
  return stmt.trimStart().startsWith(DISABLED_MARKER.trim());
}

// Check if ALL statements in a script array are disabled
function isCodeDisabled(script: unknown): boolean {
  if (!Array.isArray(script) || script.length === 0) return false;
  return script.every((s) => typeof s === 'string' && isStatementDisabled(s));
}

// -- Output mapping markers in disabled scripts --
// When disabling a block, we store its related output mappings as special comments
// so we can restore them on re-enable. Format:
// -- [KBC-UI-OUTPUT] {"source":"out1","destination":"out.c-bucket.out1"}

const OUTPUT_MAPPING_MARKER = '-- [KBC-UI-OUTPUT] ';

export function encodeOutputMappings(mappings: Array<{ source: string; destination: string }>): string[] {
  return mappings.map((m) => `${OUTPUT_MAPPING_MARKER}${JSON.stringify(m)}`);
}

export function decodeOutputMappings(script: string[]): Array<{ source: string; destination: string }> {
  const results: Array<{ source: string; destination: string }> = [];
  // Script elements may contain multiple lines (\n), so split each element into lines
  for (const element of script) {
    for (const line of element.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith(OUTPUT_MAPPING_MARKER.trim())) {
        try {
          const json = trimmed.slice(OUTPUT_MAPPING_MARKER.trim().length);
          results.push(JSON.parse(json));
        } catch { /* skip malformed */ }
      }
    }
  }
  return results;
}

// -- Dependency analysis --

// Extract table names created by SQL (CREATE TABLE "name")
const CREATE_TABLE_RE = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMPORARY\s+|TEMP\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|([a-zA-Z_]\w*))/gi;

export function extractCreatedTablesFromSql(sql: string): string[] {
  const tables = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(CREATE_TABLE_RE.source, CREATE_TABLE_RE.flags);
  while ((match = re.exec(sql)) !== null) {
    const name = match[1] ?? match[2];
    if (name) tables.add(name);
  }
  return [...tables];
}

// Extract table names read by SQL (FROM "name" / JOIN "name")
const FROM_TABLE_RE = /(?:FROM|JOIN)\s+(?:"([^"]+)"|([a-zA-Z_]\w*))/gi;

export function extractReadTablesFromSql(sql: string): string[] {
  const tables = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(FROM_TABLE_RE.source, FROM_TABLE_RE.flags);
  while ((match = re.exec(sql)) !== null) {
    const name = match[1] ?? match[2];
    if (name) tables.add(name);
  }
  return [...tables];
}

// Analyze impact of disabling a code block
export type DisableImpact = {
  createdTables: string[];
  dependentBlocks: Array<{ phaseName: string; codeName: string; readsTable: string }>;
  affectedOutputMappings: Array<{ source: string; destination: string }>;
};

export function analyzeDisableImpact(
  phases: Phase[],
  phaseIdx: number,
  codeIdx: number,
  outputMappings: Array<{ source: string; destination: string }>,
): DisableImpact {
  const block = phases[phaseIdx]?.codes[codeIdx];
  if (!block) return { createdTables: [], dependentBlocks: [], affectedOutputMappings: [] };

  const createdTables = extractCreatedTablesFromSql(block.script);
  const createdSet = new Set(createdTables);

  // Find blocks that read from these tables
  const dependentBlocks: DisableImpact['dependentBlocks'] = [];
  for (let pi = 0; pi < phases.length; pi++) {
    const phaseObj = phases[pi]!;
    for (let ci = 0; ci < phaseObj.codes.length; ci++) {
      if (pi === phaseIdx && ci === codeIdx) continue; // skip self
      const other = phaseObj.codes[ci]!;
      if (other.disabled) continue;
      const reads = extractReadTablesFromSql(other.script);
      for (const t of reads) {
        if (createdSet.has(t)) {
          dependentBlocks.push({ phaseName: phaseObj.name, codeName: other.name, readsTable: t });
        }
      }
    }
  }

  // Find output mappings whose source matches created tables
  const affectedOutputMappings = outputMappings.filter((m) => createdSet.has(m.source));

  return { createdTables, dependentBlocks, affectedOutputMappings };
}

// Analyze impact of disabling an entire phase
export function analyzePhaseDisableImpact(
  phases: Phase[],
  phaseIdx: number,
  outputMappings: Array<{ source: string; destination: string }>,
): DisableImpact {
  const phase = phases[phaseIdx];
  if (!phase) return { createdTables: [], dependentBlocks: [], affectedOutputMappings: [] };

  // Combine impact of all codes in the phase
  const allCreated = new Set<string>();
  const allDeps: DisableImpact['dependentBlocks'] = [];
  const allMappings: DisableImpact['affectedOutputMappings'] = [];

  for (let ci = 0; ci < phase.codes.length; ci++) {
    if (phase.codes[ci]!.disabled) continue;
    const impact = analyzeDisableImpact(phases, phaseIdx, ci, outputMappings);
    impact.createdTables.forEach((t) => allCreated.add(t));
    // Filter deps to only external blocks (not within the same phase)
    allDeps.push(...impact.dependentBlocks.filter((d) => d.phaseName !== phase.name));
    allMappings.push(...impact.affectedOutputMappings);
  }

  return {
    createdTables: [...allCreated],
    dependentBlocks: allDeps,
    affectedOutputMappings: [...new Map(allMappings.map((m) => [m.source, m])).values()],
  };
}

// -- Pure helpers (exported for testing) --

export function extractBlocks(config: Record<string, unknown>): Phase[] {
  const params = config?.parameters as Record<string, unknown> | undefined;
  const blocks = params?.blocks;

  if (Array.isArray(blocks) && blocks.length > 0) {
    return blocks.map((block) => {
      const b = block as Record<string, unknown>;
      const codes = (b.codes as Array<Record<string, unknown>>) ?? [];
      const mappedCodes = codes.map((code) => {
        const scriptRaw = code.script;
        const scriptArr = Array.isArray(scriptRaw) ? scriptRaw as string[] : [String(scriptRaw ?? '')];
        const disabled = isCodeDisabled(scriptRaw);
        // If disabled, uncomment for display; otherwise join normally
        const text = disabled
          ? scriptArr.map(enableStatement).join('\n\n')
          : scriptArr.join('\n\n');
        // Extract embedded output mappings from disabled scripts (for restore on enable)
        const embeddedMappings = disabled ? decodeOutputMappings(scriptArr) : undefined;
        return {
          name: (code.name as string) ?? 'Unnamed Block',
          script: text,
          disabled,
          _outputMappingsToRestore: embeddedMappings?.length ? embeddedMappings : undefined,
        };
      });
      const allDisabled = mappedCodes.length > 0 && mappedCodes.every((c) => c.disabled);
      return {
        name: (b.name as string) ?? 'Unnamed Phase',
        disabled: allDisabled,
        codes: mappedCodes,
      };
    });
  }

  // Fallback: queries at top level or parameters.queries (flat SQL)
  const queries = (config?.queries ?? params?.queries) as string[] | undefined;
  if (Array.isArray(queries) && queries.length > 0) {
    return [{
      name: 'Queries',
      disabled: false,
      codes: queries.map((q, i) => ({
        name: `Query ${i + 1}`,
        script: String(q),
        disabled: false,
      })),
    }];
  }

  return [];
}

export function hasBlockStructure(config: Record<string, unknown>): boolean {
  return extractBlocks(config).length > 0;
}

// Build all SQL as a single string for copy-all
export function allSqlAsText(phases: Phase[]): string {
  const parts: string[] = [];
  for (const phase of phases) {
    if (phase.disabled) continue;
    parts.push(`/* ===== PHASE: ${phase.name} ===== */`);
    for (const code of phase.codes) {
      if (code.disabled) continue;
      parts.push(`/* ===== CODE: ${code.name} ===== */`);
      parts.push(code.script);
    }
    parts.push('');
  }
  return parts.join('\n\n');
}

// Split SQL text into individual statements for Keboola runner.
// Runner executes each element of script[] as a separate statement.
// "actual statement count N did not match desired 1" error happens if we send multiple in one.
export function splitStatements(text: string): string[] {
  if (!text.trim()) return [];
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      current += ch;
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      current += ch;
      if (ch === '*' && next === '/') {
        current += '/';
        i++;
        inBlockComment = false;
      }
      continue;
    }
    if (inSingleQuote) {
      current += ch;
      if (ch === "'" && next === "'") { current += "'"; i++; } // escaped quote
      else if (ch === "'") inSingleQuote = false;
      continue;
    }
    if (inDoubleQuote) {
      current += ch;
      if (ch === '"') inDoubleQuote = false;
      continue;
    }

    // Not inside any quote/comment
    if (ch === "'" ) { inSingleQuote = true; current += ch; continue; }
    if (ch === '"') { inDoubleQuote = true; current += ch; continue; }
    if (ch === '-' && next === '-') { inLineComment = true; current += ch; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; current += ch; continue; }

    if (ch === ';') {
      current += ';';
      const trimmed = current.trim();
      if (trimmed && trimmed !== ';') statements.push(trimmed);
      current = '';
      continue;
    }

    current += ch;
  }

  // Remaining text without trailing semicolon
  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);

  return statements;
}

// Apply phases back to configuration JSON (returns new config).
// IMPORTANT: script[] is an array where each element = one SQL statement.
// Runner executes each separately. We must split by ";" respecting quotes/comments.
// Disabled blocks have their SQL commented out with a marker — runner sees comments as NOP.
// Output mappings for disabled blocks are embedded as marker comments and removed from config.
function applyBlocks(config: Record<string, unknown>, phases: Phase[]): Record<string, unknown> {
  // Collect output mappings to remove (from blocks being disabled)
  // and to restore (from blocks being re-enabled)
  const mappingsToRemove = new Set<string>();
  const mappingsToRestore: Array<{ source: string; destination: string }> = [];

  for (const phase of phases) {
    for (const code of phase.codes) {
      const savedMappings = code._outputMappingsToRestore ?? [];
      if (savedMappings.length === 0) continue;

      if (code.disabled) {
        // Block is disabled — remove its output mappings from config
        savedMappings.forEach((m) => mappingsToRemove.add(m.source));
      } else {
        // Block was re-enabled — restore its output mappings
        mappingsToRestore.push(...savedMappings);
      }
    }
    // Phase-level mappings (when entire phase is disabled/enabled)
    const phaseMappings = phase._outputMappingsToRestore ?? [];
    if (phaseMappings.length > 0) {
      if (phase.disabled) {
        phaseMappings.forEach((m) => mappingsToRemove.add(m.source));
      } else {
        mappingsToRestore.push(...phaseMappings);
      }
    }
  }

  const rawBlocks: RawBlock[] = phases.map((phase) => ({
    name: phase.name,
    codes: phase.codes.map((code): RawCode => {
      const scriptArray = splitStatements(code.script);
      if (code.disabled) {
        // Collect output mappings to embed in the disabled comment
        const embeddedMappings = [
          ...(code._outputMappingsToRestore ?? []),
          ...(phase._outputMappingsToRestore ?? []),
        ];
        // Comment out each statement, embedding output mapping info in the first one
        return {
          name: code.name,
          script: scriptArray.map((stmt, i) =>
            disableStatement(stmt, i === 0 ? embeddedMappings : undefined),
          ),
        };
      }
      return { name: code.name, script: scriptArray };
    }),
  }));

  const params = (config.parameters ?? {}) as Record<string, unknown>;
  let result: Record<string, unknown> = {
    ...config,
    parameters: { ...params, blocks: rawBlocks },
  };

  // Modify output mappings: remove disabled, restore re-enabled
  if (mappingsToRemove.size > 0 || mappingsToRestore.length > 0) {
    const storage = (config.storage ?? {}) as Record<string, unknown>;
    const output = (storage.output ?? {}) as Record<string, unknown>;
    let currentTables = (output.tables ?? []) as Array<{ source: string; destination: string }>;

    // Remove mappings from disabled blocks
    if (mappingsToRemove.size > 0) {
      currentTables = currentTables.filter((t) => !mappingsToRemove.has(t.source));
    }

    // Restore mappings from re-enabled blocks (avoid duplicates)
    if (mappingsToRestore.length > 0) {
      const existingSources = new Set(currentTables.map((t) => t.source));
      for (const m of mappingsToRestore) {
        if (!existingSources.has(m.source)) {
          currentTables = [...currentTables, m];
          existingSources.add(m.source);
        }
      }
    }

    result = {
      ...result,
      storage: {
        ...storage,
        output: { ...output, tables: currentTables },
      },
    };
  }

  return result;
}

// -- Chevron icon --

function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''} ${className ?? 'text-neutral-400'}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  );
}

// -- Copy button --

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded bg-neutral-700 px-2 py-1 text-[10px] text-neutral-300 hover:bg-neutral-600 transition-colors"
    >
      {copied ? 'Copied!' : (label ?? 'Copy')}
    </button>
  );
}

// -- Inline name editor --

function InlineName({
  value,
  onRename,
  className,
}: {
  value: string;
  onRename: (name: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onRename(trimmed);
    else setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        className={`rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-blue-400 ${className ?? ''}`}
        autoFocus
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className={`cursor-pointer rounded px-1 hover:bg-neutral-100 ${className ?? ''}`}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
      title="Double-click to rename"
    >
      {value}
    </span>
  );
}

// -- Single code block with expandable editor --

function CodeBlockItem({
  block,
  onEdit,
  onDelete,
  onToggleDisable,
  onRename,
  configuration,
}: {
  block: CodeBlock;
  onEdit: (script: string) => void;
  onDelete: () => void;
  onToggleDisable: () => void;
  onRename: (name: string) => void;
  configuration?: Record<string, unknown>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(block.script);
  const lineCount = block.script.split('\n').length;

  const hasChanges = draft !== block.script;

  function handleSaveCode() {
    onEdit(draft);
    setEditMode(false);
  }

  function handleCancelEdit() {
    setDraft(block.script);
    setEditMode(false);
  }

  return (
    <div className={`border-b border-neutral-100 last:border-b-0 ${block.disabled ? 'opacity-50' : ''}`}>
      <div className="flex w-full items-center gap-2 px-4 py-2 text-sm">
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 flex-1 text-left hover:bg-neutral-50 rounded transition-colors py-0.5 -ml-1 pl-1">
          <Chevron open={expanded} />
          <svg className={`h-4 w-4 shrink-0 ${block.disabled ? 'text-neutral-300' : 'text-blue-500'}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6.28 5.22a.75.75 0 010 1.06L2.56 10l3.72 3.72a.75.75 0 01-1.06 1.06L.97 10.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0zm7.44 0a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L17.44 10l-3.72-3.72a.75.75 0 010-1.06z" clipRule="evenodd" />
          </svg>
          <InlineName
            value={block.name}
            onRename={onRename}
            className={`font-medium ${block.disabled ? 'text-neutral-400 line-through' : 'text-neutral-800'}`}
          />
          {block.disabled && (
            <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">DISABLED</span>
          )}
        </button>
        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-400 mr-2">{lineCount} lines</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleDisable(); }}
            className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
              block.disabled
                ? 'bg-green-50 text-green-600 hover:bg-green-100'
                : 'bg-neutral-100 text-neutral-500 hover:bg-orange-50 hover:text-orange-600'
            }`}
            title={block.disabled ? 'Enable this block' : 'Disable this block'}
          >
            {block.disabled ? 'Enable' : 'Disable'}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="rounded px-1.5 py-0.5 text-[10px] text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete block"
          >
            Delete
          </button>
        </div>
      </div>
      {expanded && !block.disabled && (
        <div className="relative">
          <div className="absolute top-2 right-3 z-10 flex gap-1">
            {!editMode && (
              <>
                <button
                  type="button"
                  onClick={() => { setDraft(block.script); setEditMode(true); }}
                  className="rounded bg-blue-600 px-2 py-1 text-[10px] text-white hover:bg-blue-700 transition-colors"
                >
                  Edit
                </button>
                <CopyButton text={block.script} />
              </>
            )}
            {editMode && (
              <>
                <button
                  type="button"
                  onClick={handleSaveCode}
                  disabled={!hasChanges}
                  className="rounded bg-green-600 px-2 py-1 text-[10px] text-white hover:bg-green-700 disabled:bg-neutral-500 transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded bg-neutral-600 px-2 py-1 text-[10px] text-neutral-300 hover:bg-neutral-500 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
          <Suspense fallback={<pre className="bg-neutral-900 p-4 font-mono text-xs text-green-400">{editMode ? draft : block.script}</pre>}>
            <SqlEditor
              value={editMode ? draft : block.script}
              onChange={editMode ? setDraft : () => {}}
              readOnly={!editMode}
              configuration={configuration}
              minHeight={editMode ? '300px' : '100px'}
            />
          </Suspense>
        </div>
      )}
      {expanded && block.disabled && (
        <div className="bg-neutral-50 px-4 py-3 text-xs text-neutral-400 italic">
          This block is disabled and will be skipped during execution. Enable it to view and edit the code.
        </div>
      )}
    </div>
  );
}

// -- Phase section --

function PhaseSection({
  phase,
  defaultOpen,
  onUpdate,
  onDelete,
  configuration,
  onRequestDisableCode,
  onRequestDisablePhase,
}: {
  phase: Phase;
  defaultOpen: boolean;
  onUpdate: (phase: Phase) => void;
  configuration?: Record<string, unknown>;
  onDelete: () => void;
  onRequestDisableCode?: (codeIdx: number) => void;
  onRequestDisablePhase?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const blockCount = phase.codes.length;
  const enabledCount = phase.codes.filter((c) => !c.disabled).length;

  function updateCode(codeIndex: number, updates: Partial<CodeBlock>) {
    const newCodes = [...phase.codes];
    newCodes[codeIndex] = { ...newCodes[codeIndex], ...updates } as CodeBlock;
    onUpdate({ ...phase, codes: newCodes });
  }

  function deleteCode(codeIndex: number) {
    onUpdate({ ...phase, codes: phase.codes.filter((_, i) => i !== codeIndex) });
  }

  function addCode() {
    onUpdate({
      ...phase,
      codes: [...phase.codes, { name: 'New Code', script: '-- Your code goes here', disabled: false }],
    });
    setOpen(true);
  }

  function togglePhaseDisable() {
    if (phase.disabled) {
      // Enable — direct, no confirmation
      onUpdate({
        ...phase,
        disabled: false,
        codes: phase.codes.map((c) => ({ ...c, disabled: false })),
      });
    } else if (onRequestDisablePhase) {
      onRequestDisablePhase();
    } else {
      onUpdate({
        ...phase,
        disabled: true,
        codes: phase.codes.map((c) => ({ ...c, disabled: true })),
      });
    }
  }

  return (
    <div className={`rounded-lg border bg-white overflow-hidden ${phase.disabled ? 'border-neutral-200 opacity-60' : 'border-neutral-200'}`}>
      {/* Phase header */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center gap-2 px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
        >
          <Chevron open={open} />
          <InlineName
            value={phase.name}
            onRename={(name) => onUpdate({ ...phase, name })}
            className={`text-sm font-semibold ${phase.disabled ? 'text-neutral-400 line-through' : 'text-neutral-900'}`}
          />
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
            {enabledCount !== blockCount ? `${enabledCount}/${blockCount}` : blockCount} {blockCount === 1 ? 'block' : 'blocks'}
          </span>
          {phase.disabled && (
            <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">DISABLED</span>
          )}
        </button>
        <div className="flex items-center gap-1 px-3">
          <button
            type="button"
            onClick={addCode}
            className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 transition-colors"
          >
            + New Code
          </button>
          <button
            type="button"
            onClick={togglePhaseDisable}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              phase.disabled
                ? 'text-green-600 hover:bg-green-50'
                : 'text-neutral-500 hover:bg-orange-50 hover:text-orange-600'
            }`}
          >
            {phase.disabled ? 'Enable' : 'Disable'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
      {/* Phase codes */}
      {open && (
        <div className="border-t border-neutral-200">
          {phase.codes.length === 0 && (
            <div className="px-4 py-4 text-center text-xs text-neutral-400">
              No code blocks in this phase.{' '}
              <button type="button" onClick={addCode} className="text-blue-600 hover:underline">Add one</button>
            </div>
          )}
          {phase.codes.map((block, i) => (
            <CodeBlockItem
              key={`${block.name}-${i}`}
              block={block}
              onEdit={(script) => updateCode(i, { script })}
              onDelete={() => deleteCode(i)}
              onToggleDisable={() => {
                if (block.disabled) {
                  // Enable is always direct (no confirmation needed)
                  updateCode(i, { disabled: false });
                } else if (onRequestDisableCode) {
                  onRequestDisableCode(i);
                } else {
                  updateCode(i, { disabled: true });
                }
              }}
              onRename={(name) => updateCode(i, { name })}
              configuration={configuration}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// -- Main component --

// -- Disable confirmation modal --

type DisableModalState = {
  type: 'code' | 'phase';
  phaseIdx: number;
  codeIdx?: number;
  impact: DisableImpact;
} | null;

function DisableConfirmModal({
  state,
  onConfirm,
  onCancel,
}: {
  state: DisableModalState;
  onConfirm: (disableOutputMappings: boolean) => void;
  onCancel: () => void;
}) {
  const [disableMappings, setDisableMappings] = useState(true);

  if (!state) return null;
  const { impact } = state;
  const hasImpact = impact.createdTables.length > 0 || impact.dependentBlocks.length > 0 || impact.affectedOutputMappings.length > 0;

  if (!hasImpact) {
    // No impact — just confirm quickly
    onConfirm(false);
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40">
      <div className="w-full max-w-lg rounded-lg border border-neutral-200 bg-white p-6 shadow-dialog">
        <h3 className="mb-3 text-lg font-semibold text-neutral-900">Disable Impact</h3>

        {impact.createdTables.length > 0 && (
          <div className="mb-3">
            <p className="text-sm text-neutral-600">Tables that will <strong>not be created</strong>:</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {impact.createdTables.map((t) => (
                <span key={t} className="rounded bg-orange-100 px-2 py-0.5 font-mono text-xs text-orange-700">{t}</span>
              ))}
            </div>
          </div>
        )}

        {impact.dependentBlocks.length > 0 && (
          <div className="mb-3">
            <p className="text-sm text-neutral-600">Blocks that <strong>read from these tables</strong> (will fail):</p>
            <ul className="mt-1 list-inside list-disc text-sm text-red-600">
              {impact.dependentBlocks.map((d, i) => (
                <li key={i}>
                  <span className="font-medium">{d.codeName}</span>
                  <span className="text-neutral-400"> in {d.phaseName}</span>
                  <span className="text-neutral-400"> reads </span>
                  <code className="text-xs">{d.readsTable}</code>
                </li>
              ))}
            </ul>
          </div>
        )}

        {impact.affectedOutputMappings.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-neutral-600">Output mappings that will <strong>fail</strong> (source table missing):</p>
            <ul className="mt-1 space-y-0.5">
              {impact.affectedOutputMappings.map((m) => (
                <li key={m.source} className="font-mono text-xs text-neutral-700">
                  {m.source} &rarr; {m.destination}
                </li>
              ))}
            </ul>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={disableMappings}
                onChange={(e) => setDisableMappings(e.target.checked)}
                className="rounded border-neutral-300"
              />
              <span>Also disable these output mappings (will be restored when you re-enable this block)</span>
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(disableMappings)}
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            Disable
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Main component --

type TransformationBlocksProps = {
  configuration: Record<string, unknown>;
  language: string;
  onSave?: (newConfig: Record<string, unknown>) => Promise<void>;
  isSaving?: boolean;
};

export function TransformationBlocks({ configuration, language: _language, onSave, isSaving }: TransformationBlocksProps) {
  const originalPhases = extractBlocks(configuration);
  const [pendingPhases, setPendingPhases] = useState<Phase[] | null>(null);
  const [disableModal, setDisableModal] = useState<DisableModalState>(null);

  const phases = pendingPhases ?? originalPhases;
  const hasChanges = pendingPhases !== null;

  const totalBlocks = phases.reduce((sum, p) => sum + p.codes.length, 0);
  const disabledBlocks = phases.reduce((sum, p) => sum + p.codes.filter((c) => c.disabled).length, 0);

  // Get current output mappings from configuration
  const outputMappings = useMemo(() => {
    const storage = configuration?.storage as Record<string, unknown> | undefined;
    const output = storage?.output as Record<string, unknown> | undefined;
    return (output?.tables as Array<{ source: string; destination: string }>) ?? [];
  }, [configuration]);

  const updatePhase = useCallback((index: number, phase: Phase) => {
    const next = [...(pendingPhases ?? originalPhases)];
    next[index] = phase;
    setPendingPhases(next);
  }, [pendingPhases, originalPhases]);

  const deletePhase = useCallback((index: number) => {
    const next = [...(pendingPhases ?? originalPhases)];
    next.splice(index, 1);
    setPendingPhases(next);
  }, [pendingPhases, originalPhases]);

  // Smart disable: show impact modal, then disable with output mapping handling
  const requestDisableCode = useCallback((phaseIdx: number, codeIdx: number) => {
    const impact = analyzeDisableImpact(phases, phaseIdx, codeIdx, outputMappings);
    if (impact.createdTables.length === 0 && impact.affectedOutputMappings.length === 0) {
      const next = [...phases];
      const phase = next[phaseIdx]!;
      const phaseCopy = { ...phase, codes: [...phase.codes] };
      phaseCopy.codes[codeIdx] = { ...phaseCopy.codes[codeIdx]!, disabled: true };
      phaseCopy.disabled = phaseCopy.codes.every((c) => c.disabled);
      next[phaseIdx] = phaseCopy;
      setPendingPhases(next);
    } else {
      setDisableModal({ type: 'code', phaseIdx, codeIdx, impact });
    }
  }, [phases, outputMappings]);

  const requestDisablePhase = useCallback((phaseIdx: number) => {
    const impact = analyzePhaseDisableImpact(phases, phaseIdx, outputMappings);
    if (impact.createdTables.length === 0 && impact.affectedOutputMappings.length === 0) {
      const next = [...phases];
      const phase = next[phaseIdx]!;
      next[phaseIdx] = { ...phase, disabled: true, codes: phase.codes.map((c) => ({ ...c, disabled: true })) };
      setPendingPhases(next);
    } else {
      setDisableModal({ type: 'phase', phaseIdx, impact });
    }
  }, [phases, outputMappings]);

  function handleDisableConfirm(disableOutputMappings: boolean) {
    if (!disableModal) return;
    const next = [...phases];
    const pi = disableModal.phaseIdx;
    const phase = next[pi]!;

    if (disableModal.type === 'code' && disableModal.codeIdx !== undefined) {
      const ci = disableModal.codeIdx;
      const phaseCopy = { ...phase, codes: [...phase.codes] };
      phaseCopy.codes[ci] = {
        ...phaseCopy.codes[ci]!,
        disabled: true,
        _outputMappingsToRestore: disableOutputMappings ? disableModal.impact.affectedOutputMappings : undefined,
      };
      phaseCopy.disabled = phaseCopy.codes.every((c) => c.disabled);
      next[pi] = phaseCopy;
    } else if (disableModal.type === 'phase') {
      next[pi] = {
        ...phase,
        disabled: true,
        codes: phase.codes.map((c) => ({ ...c, disabled: true })),
        _outputMappingsToRestore: disableOutputMappings ? disableModal.impact.affectedOutputMappings : undefined,
      };
    }

    setPendingPhases(next);
    setDisableModal(null);
  }

  function addPhase() {
    const next = [...phases, { name: `Phase ${phases.length + 1}`, codes: [], disabled: false }];
    setPendingPhases(next);
  }

  async function handleSave() {
    if (!pendingPhases || !onSave) return;
    const newConfig = applyBlocks(configuration, pendingPhases);
    await onSave(newConfig);
    setPendingPhases(null);
  }

  function handleDiscard() {
    setPendingPhases(null);
  }

  if (phases.length === 0 && !hasChanges) {
    return (
      <div className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">Queries</h2>
        <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-400">
          No code blocks found.{' '}
          {onSave && (
            <button type="button" onClick={addPhase} className="text-blue-600 hover:underline">Add a phase</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">Queries</h2>
          <span className="text-xs text-neutral-400">
            {phases.length} {phases.length === 1 ? 'phase' : 'phases'}, {totalBlocks} {totalBlocks === 1 ? 'block' : 'blocks'}
            {disabledBlocks > 0 && ` (${disabledBlocks} disabled)`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton text={allSqlAsText(phases)} label="Copy All SQL" />
          {onSave && (
            <button
              type="button"
              onClick={addPhase}
              className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              + New Phase
            </button>
          )}
        </div>
      </div>

      {/* Save bar */}
      {hasChanges && onSave && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
          <span className="text-sm text-blue-700">You have unsaved changes to queries.</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-md bg-green-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-600 disabled:bg-green-300"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Phase list */}
      <div className="flex flex-col gap-2">
        {phases.map((phase, i) => (
          <PhaseSection
            key={`${phase.name}-${i}`}
            phase={phase}
            defaultOpen={phases.length <= 3}
            onUpdate={(p) => updatePhase(i, p)}
            onDelete={() => deletePhase(i)}
            configuration={configuration}
            onRequestDisableCode={(codeIdx) => requestDisableCode(i, codeIdx)}
            onRequestDisablePhase={() => requestDisablePhase(i)}
          />
        ))}
      </div>

      {/* Disable impact confirmation modal */}
      <DisableConfirmModal
        state={disableModal}
        onConfirm={handleDisableConfirm}
        onCancel={() => setDisableModal(null)}
      />
    </div>
  );
}
