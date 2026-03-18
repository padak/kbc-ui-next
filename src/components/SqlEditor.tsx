// file: components/SqlEditor.tsx
// CodeMirror 6 based SQL editor with syntax highlighting and table/column autocomplete.
// Builds autocomplete schema from input mapping destinations + storage table columns.
// Used by: TransformationBlocks for SQL code editing.
// Depends on: @codemirror/lang-sql, @codemirror/theme-one-dark, useTables hook.

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { StandardSQL, sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, type CompletionContext, type Completion } from '@codemirror/autocomplete';
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { useTables } from '@/hooks/useStorage';
import { getInputMappings, getOutputMappings } from '@/components/MappingEditor';

type SqlEditorProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  configuration?: Record<string, unknown>;
  minHeight?: string;
};

// Build CodeMirror SQL schema from input/output mappings and storage tables.
// Keboola direct query: buckets = schemas, tables in buckets = tables.
// So "in.c-my-bucket"."my-table" is valid Snowflake SQL in Keboola.
function buildSchema(
  configuration: Record<string, unknown> | undefined,
  tables: Array<{ id: string; columns: string[] }> | undefined,
): Record<string, string[]> {
  const schema: Record<string, string[]> = {};

  // 1. Input mapping destinations = table aliases available in SQL
  if (configuration) {
    const inputMappings = getInputMappings(configuration);
    const outputMappings = getOutputMappings(configuration);

    for (const mapping of inputMappings) {
      const alias = mapping.destination;
      const sourceTable = tables?.find((t) => t.id === mapping.source);
      const cols = sourceTable?.columns ?? [];
      schema[alias] = cols;
      schema[`"${alias}"`] = cols.map((c) => `"${c}"`);
    }

    // Output mapping sources = tables created by the transformation
    for (const mapping of outputMappings) {
      if (!schema[mapping.source]) {
        schema[mapping.source] = [];
        schema[`"${mapping.source}"`] = [];
      }
    }
  }

  // 2. All storage tables for direct query (bucket.table format)
  // Keboola: table ID = "in.c-bucket.tableName" -> schema "in.c-bucket", table "tableName"
  if (tables) {
    for (const table of tables) {
      const cols = table.columns ?? [];
      // Full table ID as-is (e.g. in.c-bucket.tableName)
      schema[`"${table.id}"`] = cols.map((c) => `"${c}"`);

      // Split into bucket (schema) + table name for schema.table notation
      const lastDot = table.id.lastIndexOf('.');
      if (lastDot > 0) {
        const bucketId = table.id.substring(0, lastDot);
        const tableName = table.id.substring(lastDot + 1);
        // Add as "bucketId"."tableName" for Snowflake quoted identifiers
        const quotedBucket = `"${bucketId}"`;
        if (!schema[quotedBucket]) {
          schema[quotedBucket] = [];
        }
        // Add the table name as a "column" of the bucket (schema-level completion)
        if (!schema[quotedBucket].includes(`"${tableName}"`)) {
          schema[quotedBucket].push(`"${tableName}"`);
        }
        // Also add unquoted bucket for convenience
        if (!schema[bucketId]) {
          schema[bucketId] = [];
        }
        if (!schema[bucketId].includes(tableName)) {
          schema[bucketId].push(tableName);
        }
      }
    }
  }

  return schema;
}

// Custom completion source for storage table IDs inside quoted identifiers.
// CodeMirror's built-in SQL schema completion only works for unquoted identifiers.
// This handles: FROM "in.c-bucket... -> offers full table IDs like "in.c-bucket.tableName"
function buildStorageCompletions(
  tables: Array<{ id: string; columns: string[] }> | undefined,
): Completion[] {
  if (!tables) return [];
  return tables.map((t) => ({
    label: `"${t.id}"`,
    type: 'class' as const,
    detail: `${t.columns.length} cols`,
    boost: -1,
  }));
}

function storageCompletionSource(completions: Completion[]) {
  return (context: CompletionContext) => {
    // Look backwards from cursor for an opening quote that hasn't been closed
    const line = context.state.doc.lineAt(context.pos);
    const textBefore = line.text.slice(0, context.pos - line.from);

    // Find the last unmatched opening double-quote
    let quoteStart = -1;
    let inQuote = false;
    for (let i = 0; i < textBefore.length; i++) {
      if (textBefore[i] === '"') {
        if (!inQuote) {
          quoteStart = i;
          inQuote = true;
        } else {
          inQuote = false;
          quoteStart = -1;
        }
      }
    }

    if (!inQuote || quoteStart < 0) return null;

    // We're inside a quoted identifier - offer storage table completions
    return {
      from: line.from + quoteStart,
      options: completions,
      validFor: /^"[^"]*$/,
    };
  };
}

export function SqlEditor({
  value,
  onChange,
  readOnly = false,
  configuration,
  minHeight = '200px',
}: SqlEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const { data: tables } = useTables();
  const typedTables = tables as Array<{ id: string; columns: string[] }> | undefined;
  const sqlSchema = useMemo(
    () => buildSchema(configuration, typedTables),
    [configuration, typedTables],
  );
  const storageCompletions = useMemo(
    () => buildStorageCompletions(typedTables),
    [typedTables],
  );

  const createState = useCallback(() => {
    return EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        bracketMatching(),
        indentOnInput(),
        foldGutter(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        sql({
          dialect: StandardSQL,
          upperCaseKeywords: true,
          schema: Object.keys(sqlSchema).length > 0 ? sqlSchema : undefined,
        }),
        // Storage table completions for quoted identifiers (FROM "in.c-...)
        // Must come AFTER sql() to layer on top of SQL language completions
        ...(storageCompletions.length > 0
          ? [autocompletion({ override: [storageCompletionSource(storageCompletions)] })]
          : [autocompletion()]),
        oneDark,
        keymap.of([
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        EditorView.theme({
          '&': { minHeight, fontSize: '13px' },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-content': { fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace" },
          '.cm-gutters': { fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace" },
        }),
      ],
    });
  }, [sqlSchema, storageCompletions, readOnly, minHeight]); // intentionally exclude value to avoid recreation on every keystroke

  // Create editor
  useEffect(() => {
    if (!editorRef.current) return;

    const view = new EditorView({
      state: createState(),
      parent: editorRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [createState]);

  // Sync external value changes (e.g., discard/reset)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={editorRef}
      className="overflow-hidden rounded-b-lg border-t-0"
    />
  );
}
