// file: src/config/transformation.ts
// Constants for transformation analysis: event names, SQL parsing patterns, display limits.
// Centralizes magic strings and numbers used in transformation event parsing.
// Used by: lib/transformationAnalysis.ts, components/TransformationAnalyzer.tsx.
// Never hardcode these values in analysis or UI code.

// -- Event names used to detect transformation phases --

export const TRANSFORMATION_EVENTS = {
  workspaceCreated: 'storage.workspaceCreated',
  workspaceCloned: 'storage.workspaceTableCloned',
  workspaceLoaded: 'storage.workspaceTableLoaded',
  tableImportStarted: 'storage.tableImportStarted',
  tableImportDone: 'storage.tableImportDone',
} as const;

// -- Message patterns for event parsing --

export const TRANSFORMATION_MESSAGES = {
  allTablesFetched: 'All tables were fetched',
  processingBlock: 'Processing block',
  runningQuery: 'Running query',
  loadingTable: 'Loading table',
  outputMappingDone: 'Output mapping done',
} as const;

// -- SQL queries to skip (infrastructure, not user SQL) --

export const INFRASTRUCTURE_SQL_PREFIXES = [
  'ALTER SESSION SET',
  'SET (KBC_RUNID',
] as const;

// -- SQL table name extraction patterns --
// Ordered by priority: first match wins.
// Captures the table name from SQL statements like CREATE TABLE "xxx", INSERT INTO "xxx", etc.

export const SQL_TABLE_PATTERNS: RegExp[] = [
  /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([^"\s(]+)"?/i,
  /INSERT\s+(?:OVERWRITE\s+)?INTO\s+"?([^"\s(]+)"?/i,
  /DELETE\s+FROM\s+"?([^"\s(]+)"?/i,
  /UPDATE\s+"?([^"\s(]+)"?/i,
  /ALTER\s+TABLE\s+"?([^"\s(]+)"?/i,
  /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?"?([^"\s(]+)"?/i,
  /MERGE\s+INTO\s+"?([^"\s(]+)"?/i,
];

// -- Display limits --

export const TRANSFORMATION_DISPLAY = {
  /** Max chars of SQL to show in query preview */
  sqlPreviewLength: 120,
  /** Number of tables to show before "show more" in collapsed view */
  defaultVisibleTables: 5,
  /** Number of queries to show before "show more" in collapsed view */
  defaultVisibleQueries: 10,
} as const;

// -- Clone/copy message parsing patterns --
// Matches: "Cloned table {source} into workspace {ws} as {name}"
// or: "Loaded table {source} into workspace {ws} as {name}"

export const CLONE_MESSAGE_PATTERN = /(?:Cloned|Loaded) table "?([^"]+)"? into workspace \S+ as "?([^"]+)"?/i;

// -- Import done message parsing --
// Matches: "Imported table {tableId}"

export const IMPORT_MESSAGE_PATTERN = /Imported table "?([^"]+)"?/i;

// -- Processing block message parsing --
// Matches: Processing block "Phase N".\nProcessing code "Code Name".

export const BLOCK_NAME_PATTERN = /Processing block "([^"]+)"/;
export const CODE_NAME_PATTERN = /Processing code "([^"]+)"/;
