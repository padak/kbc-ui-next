// file: components/CodeEditor.tsx
// Simple code editor with monospace font and line numbers.
// Placeholder for future CodeMirror/Monaco integration.
// Used by: ConfigurationDetailPage for transformation configs.
// Supports SQL (Snowflake) and Python syntax via mode prop.

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  language: 'sql' | 'python' | 'text';
  readOnly?: boolean;
};

export function CodeEditor({ value, onChange, language, readOnly = false }: CodeEditorProps) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 px-3 py-1.5 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-500 uppercase">{language}</span>
        {readOnly && (
          <span className="text-[10px] text-gray-400">Read-only</span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        className="w-full min-h-[300px] resize-y bg-gray-900 p-4 font-mono text-sm text-green-400 outline-none"
      />
    </div>
  );
}

// Extract code from a transformation configuration.
// Tries multiple known configuration structures for different component types.
export function extractCode(config: Record<string, unknown>): string {
  // Snowflake SQL: queries array at top level
  const queries = (config as Record<string, unknown>)?.queries;
  if (Array.isArray(queries) && queries.length > 0) {
    return queries.join('\n\n');
  }

  // Snowflake SQL: parameters.queries
  const params = (config as Record<string, unknown>)?.parameters as Record<string, unknown> | undefined;
  if (params) {
    const paramQueries = params.queries;
    if (Array.isArray(paramQueries) && paramQueries.length > 0) {
      return paramQueries.join('\n\n');
    }
  }

  // Python: parameters.blocks[0].codes[0].script
  const blocks = params?.blocks;
  if (Array.isArray(blocks)) {
    const scripts: string[] = [];
    for (const block of blocks) {
      const blockObj = block as Record<string, unknown> | undefined;
      const codes = blockObj?.codes;
      if (Array.isArray(codes)) {
        for (const code of codes) {
          const codeObj = code as Record<string, unknown> | undefined;
          if (codeObj?.script) {
            const script = codeObj.script;
            if (Array.isArray(script)) {
              scripts.push(script.join('\n'));
            } else {
              scripts.push(String(script));
            }
          }
        }
      }
    }
    if (scripts.length > 0) {
      return scripts.join('\n\n# --- Next Block ---\n\n');
    }
  }

  return '// No code found in configuration';
}
