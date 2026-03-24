// file: src/lib/transformationAnalysis.ts
// Parses transformation job events into a structured analysis with phases and timings.
// Exports analyzeTransformation() and types for each phase (setup, input, SQL, output, cleanup).
// Used by: components/TransformationAnalyzer.tsx for rendering detailed transformation breakdown.
// Events arrive newest-first from API — this module reverses them before processing.

import type { KeboolaEvent } from '@/api/events';
import type { Job } from '@/api/schemas';
import {
  TRANSFORMATION_EVENTS,
  TRANSFORMATION_MESSAGES,
  INFRASTRUCTURE_SQL_PREFIXES,
  SQL_TABLE_PATTERNS,
  TRANSFORMATION_DISPLAY,
  CLONE_MESSAGE_PATTERN,
  IMPORT_MESSAGE_PATTERN,
  BLOCK_NAME_PATTERN,
  CODE_NAME_PATTERN,
} from '@/config/transformation';

// -- Types --

export type InputTable = {
  name: string;
  source: string;
  method: 'clone' | 'copy';
  durationSeconds?: number;
};

export type SqlQuery = {
  /** Truncated SQL for UI display */
  sql: string;
  /** Full SQL text for export/analysis */
  fullSql: string;
  startTime: string;
  durationMs: number;
  tableName?: string;
};

export type SqlBlock = {
  name: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  queries: SqlQuery[];
};

export type OutputTable = {
  name: string;
  rowsCount?: number;
  sizeBytes?: number;
  durationSeconds?: number;
};

export type PhaseTimings = {
  startTime: string;
  endTime: string;
  durationMs: number;
};

export type TransformationAnalysis = {
  isTransformation: boolean;
  setup: PhaseTimings | null;
  input: (PhaseTimings & {
    tables: InputTable[];
    cloneCount: number;
    copyCount: number;
  }) | null;
  sql: (PhaseTimings & {
    blocks: SqlBlock[];
    totalQueries: number;
  }) | null;
  output: (PhaseTimings & {
    tables: OutputTable[];
  }) | null;
  cleanup: PhaseTimings | null;
  totalDurationMs: number;
};

// -- Helpers --

function msGap(a: string, b: string): number {
  return Math.max(0, new Date(b).getTime() - new Date(a).getTime());
}

function isInfrastructureSql(sql: string): boolean {
  const trimmed = sql.trimStart();
  return INFRASTRUCTURE_SQL_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

function extractTableName(sql: string): string | undefined {
  for (const pattern of SQL_TABLE_PATTERNS) {
    const match = sql.match(pattern);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function stripTablePrefix(name: string): string {
  // "in.c-kds-team-ex-salesforce-v2-723966296.user" -> "user"
  const parts = name.split('.');
  return parts.length > 2 ? parts[parts.length - 1]! : name;
}

// -- Main analysis function --

export function analyzeTransformation(
  job: Job,
  events: KeboolaEvent[],
): TransformationAnalysis {
  // Events come newest-first from API — reverse to chronological
  const chronological = [...events].reverse();

  // Detection: is this a transformation job?
  const hasWorkspaceCreated = chronological.some(
    (e) => e.event === TRANSFORMATION_EVENTS.workspaceCreated,
  );
  if (!hasWorkspaceCreated) {
    return {
      isTransformation: false,
      setup: null,
      input: null,
      sql: null,
      output: null,
      cleanup: null,
      totalDurationMs: job.durationSeconds ? job.durationSeconds * 1000 : 0,
    };
  }

  // -- Phase detection --

  const workspaceCreatedEvent = chronological.find(
    (e) => e.event === TRANSFORMATION_EVENTS.workspaceCreated,
  );

  // SETUP: job created -> workspace created
  const setupStartTime = job.createdTime;
  const setupEndTime = workspaceCreatedEvent?.created ?? job.startTime ?? job.createdTime;
  const setup: PhaseTimings = {
    startTime: setupStartTime,
    endTime: setupEndTime,
    durationMs: msGap(setupStartTime, setupEndTime),
  };

  // INPUT: workspace table clone/load events
  const inputTableEvents = chronological.filter(
    (e) =>
      e.event === TRANSFORMATION_EVENTS.workspaceCloned ||
      e.event === TRANSFORMATION_EVENTS.workspaceLoaded,
  );

  const allTablesFetchedEvent = chronological.find(
    (e) => e.message.includes(TRANSFORMATION_MESSAGES.allTablesFetched),
  );

  let input: TransformationAnalysis['input'] = null;
  if (inputTableEvents.length > 0) {
    const inputTables: InputTable[] = inputTableEvents.map((e) => {
      const isClone = e.event === TRANSFORMATION_EVENTS.workspaceCloned;
      const match = e.message.match(CLONE_MESSAGE_PATTERN);
      const source = match?.[1] ?? '';
      const name = match?.[2] ?? stripTablePrefix(source);
      const exportDuration = e.performance?.exportDuration;
      return {
        name,
        source,
        method: isClone ? 'clone' as const : 'copy' as const,
        durationSeconds: typeof exportDuration === 'number' ? exportDuration : undefined,
      };
    });

    const firstInputEvent = inputTableEvents[0]!;
    const lastInputEvent = inputTableEvents[inputTableEvents.length - 1]!;
    const inputStartTime = firstInputEvent.created;
    const inputEndTime = allTablesFetchedEvent?.created ?? lastInputEvent.created;

    input = {
      startTime: inputStartTime,
      endTime: inputEndTime,
      durationMs: msGap(inputStartTime, inputEndTime),
      tables: inputTables,
      cloneCount: inputTables.filter((t) => t.method === 'clone').length,
      copyCount: inputTables.filter((t) => t.method === 'copy').length,
    };
  }

  // SQL EXECUTION: block and query events
  const blocks: SqlBlock[] = [];
  let currentBlock: {
    name: string;
    startTime: string;
    queries: SqlQuery[];
  } | null = null;

  // Track all "Running query" events for duration inference
  const queryEvents: { event: KeboolaEvent; blockIndex: number; queryIndex: number }[] = [];

  for (let i = 0; i < chronological.length; i++) {
    const e = chronological[i]!;

    // Detect block start
    if (e.message.includes(TRANSFORMATION_MESSAGES.processingBlock)) {
      // Close previous block if open
      if (currentBlock && currentBlock.queries.length > 0) {
        blocks.push({
          name: currentBlock.name,
          startTime: currentBlock.startTime,
          endTime: e.created,
          durationMs: msGap(currentBlock.startTime, e.created),
          queries: currentBlock.queries,
        });
      } else if (currentBlock) {
        blocks.push({
          name: currentBlock.name,
          startTime: currentBlock.startTime,
          endTime: e.created,
          durationMs: msGap(currentBlock.startTime, e.created),
          queries: [],
        });
      }

      const blockMatch = e.message.match(BLOCK_NAME_PATTERN);
      const codeMatch = e.message.match(CODE_NAME_PATTERN);
      const blockName = blockMatch?.[1] ?? 'Unknown Block';
      const codeName = codeMatch?.[1];
      const fullName = codeName ? `${blockName} / ${codeName}` : blockName;

      currentBlock = {
        name: fullName,
        startTime: e.created,
        queries: [],
      };
      continue;
    }

    // Detect queries within a block
    if (e.message.includes(TRANSFORMATION_MESSAGES.runningQuery) && currentBlock) {
      // Extract the SQL from the message: "Running query #N: <sql>"
      // Or just "Running query: <sql>"
      const queryPrefixMatch = e.message.match(/Running query(?:\s*#?\d*)?[:\s]+([\s\S]*)/);
      const rawSql = queryPrefixMatch?.[1]?.trim() ?? e.message;

      // Skip infrastructure queries
      if (isInfrastructureSql(rawSql)) continue;

      const sqlPreview = rawSql.length > TRANSFORMATION_DISPLAY.sqlPreviewLength
        ? rawSql.substring(0, TRANSFORMATION_DISPLAY.sqlPreviewLength) + '...'
        : rawSql;
      const tableName = extractTableName(rawSql);

      const query: SqlQuery = {
        sql: sqlPreview,
        fullSql: rawSql,
        startTime: e.created,
        durationMs: 0, // Will be inferred below
        tableName,
      };
      const queryIndex = currentBlock.queries.length;
      currentBlock.queries.push(query);
      queryEvents.push({ event: e, blockIndex: blocks.length, queryIndex });
    }
  }

  // Close the last open block
  if (currentBlock) {
    // Find the end time: first non-query event after the last query, or first output/loading event
    const lastQueryEvent = queryEvents[queryEvents.length - 1];
    let blockEndTime = lastQueryEvent?.event.created ?? currentBlock.startTime;

    // Look for the first event after the last query that isn't a "Running query"
    if (lastQueryEvent) {
      const lastQueryIdx = chronological.indexOf(lastQueryEvent.event);
      for (let j = lastQueryIdx + 1; j < chronological.length; j++) {
        const nextEvent = chronological[j]!;
        if (!nextEvent.message.includes(TRANSFORMATION_MESSAGES.runningQuery)) {
          blockEndTime = nextEvent.created;
          break;
        }
      }
    }

    blocks.push({
      name: currentBlock.name,
      startTime: currentBlock.startTime,
      endTime: blockEndTime,
      durationMs: msGap(currentBlock.startTime, blockEndTime),
      queries: currentBlock.queries,
    });
  }

  // Infer query durations from timestamp gaps
  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi]!;
    for (let qi = 0; qi < block.queries.length; qi++) {
      const query = block.queries[qi]!;
      const nextQuery = block.queries[qi + 1];
      if (nextQuery) {
        query.durationMs = msGap(query.startTime, nextQuery.startTime);
      } else {
        // Last query in block: duration is gap to block end
        query.durationMs = msGap(query.startTime, block.endTime);
      }
    }
  }

  let sql: TransformationAnalysis['sql'] = null;
  if (blocks.length > 0) {
    const firstBlock = blocks[0]!;
    const lastBlock = blocks[blocks.length - 1]!;
    const totalQueries = blocks.reduce((sum, b) => sum + b.queries.length, 0);

    sql = {
      startTime: firstBlock.startTime,
      endTime: lastBlock.endTime,
      durationMs: msGap(firstBlock.startTime, lastBlock.endTime),
      blocks,
      totalQueries,
    };
  }

  // OUTPUT: table import events
  const importDoneEvents = chronological.filter(
    (e) => e.event === TRANSFORMATION_EVENTS.tableImportDone,
  );
  const loadingTableEvent = chronological.find(
    (e) => e.message.includes(TRANSFORMATION_MESSAGES.loadingTable),
  );
  const importStartedEvent = chronological.find(
    (e) => e.event === TRANSFORMATION_EVENTS.tableImportStarted,
  );
  const outputMappingDoneEvent = chronological.find(
    (e) => e.message.includes(TRANSFORMATION_MESSAGES.outputMappingDone),
  );

  let output: TransformationAnalysis['output'] = null;
  if (importDoneEvents.length > 0) {
    const outputTables: OutputTable[] = importDoneEvents.map((e) => {
      const nameMatch = e.message.match(IMPORT_MESSAGE_PATTERN);
      const name = nameMatch?.[1] ?? '';
      const rowsCount = typeof e.results.rowsCount === 'number'
        ? e.results.rowsCount
        : typeof e.results.rowsCount === 'string'
          ? parseInt(e.results.rowsCount, 10)
          : undefined;
      const sizeBytes = typeof e.results.sizeBytes === 'number'
        ? e.results.sizeBytes
        : typeof e.results.sizeBytes === 'string'
          ? parseInt(e.results.sizeBytes, 10)
          : undefined;
      const importDuration = e.performance?.importDuration;
      return {
        name,
        rowsCount: rowsCount != null && !isNaN(rowsCount) ? rowsCount : undefined,
        sizeBytes: sizeBytes != null && !isNaN(sizeBytes) ? sizeBytes : undefined,
        durationSeconds: typeof importDuration === 'number' ? importDuration : undefined,
      };
    });

    const outputStartTime =
      loadingTableEvent?.created ??
      importStartedEvent?.created ??
      importDoneEvents[0]!.created;
    const outputEndTime =
      outputMappingDoneEvent?.created ??
      importDoneEvents[importDoneEvents.length - 1]!.created;

    output = {
      startTime: outputStartTime,
      endTime: outputEndTime,
      durationMs: msGap(outputStartTime, outputEndTime),
      tables: outputTables,
    };
  }

  // CLEANUP: after output end -> job end
  const cleanupStartTime = output?.endTime ?? sql?.endTime ?? input?.endTime ?? setupEndTime;
  const cleanupEndTime = job.endTime ?? cleanupStartTime;
  const cleanup: PhaseTimings | null =
    cleanupStartTime && cleanupEndTime
      ? {
          startTime: cleanupStartTime,
          endTime: cleanupEndTime,
          durationMs: msGap(cleanupStartTime, cleanupEndTime),
        }
      : null;

  // Total duration
  const totalDurationMs = job.durationSeconds
    ? job.durationSeconds * 1000
    : job.endTime && job.startTime
      ? msGap(job.startTime, job.endTime)
      : 0;

  return {
    isTransformation: true,
    setup,
    input,
    sql,
    output,
    cleanup,
    totalDurationMs,
  };
}

// Re-export helper for use in components
export { stripTablePrefix };
