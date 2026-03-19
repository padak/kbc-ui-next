// file: src/components/DescriptionEditor.tsx
// Inline Markdown editor with toolbar, three view modes (Write/Preview/Split).
// Replaces description area when user clicks edit — NOT a modal.
// Used by: ConfigurationDetailPage, ConfigurationRowPage.
// Keyboard: Escape cancels, Cmd+Enter saves.

import { useState, useRef, useCallback, useEffect } from 'react';
import { MarkdownViewer, prefetchMermaid } from '@/components/MarkdownViewer';
import { TOOLBAR_ITEMS, type ToolbarItem } from '@/config/markdown';

type EditorMode = 'write' | 'preview' | 'split';

type DescriptionEditorProps = {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  isSaving?: boolean;
};

function applyToolbarAction(
  textarea: HTMLTextAreaElement,
  item: ToolbarItem,
  draft: string,
  setDraft: (v: string) => void,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = draft.substring(start, end);

  let newText: string;
  let cursorPos: number;

  if (item.block && start > 0 && draft[start - 1] !== '\n') {
    // For block-level items, ensure we're on a new line
    newText =
      draft.substring(0, start) +
      '\n' +
      item.prefix +
      (selected || item.label) +
      item.suffix +
      draft.substring(end);
    cursorPos = start + 1 + item.prefix.length + (selected || item.label).length;
  } else {
    newText =
      draft.substring(0, start) +
      item.prefix +
      (selected || item.label) +
      item.suffix +
      draft.substring(end);
    cursorPos = start + item.prefix.length + (selected || item.label).length;
  }

  setDraft(newText);

  // Restore cursor position after React re-render
  requestAnimationFrame(() => {
    textarea.focus();
    if (selected) {
      textarea.setSelectionRange(
        start + item.prefix.length,
        start + item.prefix.length + selected.length,
      );
    } else {
      textarea.setSelectionRange(
        start + item.prefix.length,
        cursorPos,
      );
    }
  });
}

function autoGrow(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`;
}

export function DescriptionEditor({ value, onSave, onCancel, isSaving }: DescriptionEditorProps) {
  const [draft, setDraft] = useState(value);
  const [mode, setMode] = useState<EditorMode>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea on mount and content change
  useEffect(() => {
    if (textareaRef.current) autoGrow(textareaRef.current);
  }, [draft, mode]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSave(draft);
      }
    },
    [draft, onSave, onCancel],
  );

  const handleToolbarClick = useCallback(
    (item: ToolbarItem) => {
      if (!textareaRef.current) return;
      applyToolbarAction(textareaRef.current, item, draft, setDraft);
    },
    [draft],
  );

  const modeButtons: { key: EditorMode; label: string }[] = [
    { key: 'write', label: 'Write' },
    { key: 'preview', label: 'Preview' },
    { key: 'split', label: 'Side-by-side' },
  ];

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm" onKeyDown={handleKeyDown}>
      {/* Mode tabs + Toolbar */}
      <div className="border-b border-neutral-150 px-3 py-2">
        {/* Mode tabs */}
        <div className="mb-2 flex gap-1">
          {modeButtons.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === m.key
                  ? 'bg-neutral-100 text-neutral-800'
                  : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Toolbar (only in write and split modes) */}
        {mode !== 'preview' && (
          <div className="flex flex-wrap gap-0.5">
            {TOOLBAR_ITEMS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleToolbarClick(item)}
                onMouseEnter={item.label === 'Mermaid diagram' ? prefetchMermaid : undefined}
                className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                title={item.label}
              >
                {item.icon}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editor body */}
      <div className={mode === 'split' ? 'flex divide-x divide-neutral-150' : ''}>
        {/* Write pane */}
        {(mode === 'write' || mode === 'split') && (
          <div className={mode === 'split' ? 'w-1/2' : 'w-full'}>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                autoGrow(e.target);
              }}
              className="w-full resize-none rounded-none border-0 bg-transparent px-3 py-3 font-mono text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
              style={{ minHeight: '120px' }}
              placeholder="Write your description in Markdown..."
              autoFocus={mode === 'write'}
            />
          </div>
        )}

        {/* Preview pane */}
        {(mode === 'preview' || mode === 'split') && (
          <div className={`px-3 py-3 ${mode === 'split' ? 'w-1/2' : 'w-full'}`}>
            {draft ? (
              <MarkdownViewer content={draft} />
            ) : (
              <p className="text-sm italic text-neutral-400">Nothing to preview</p>
            )}
          </div>
        )}
      </div>

      {/* Footer: Cancel + Save */}
      <div className="flex items-center justify-between border-t border-neutral-150 px-3 py-2">
        <span className="text-xs text-neutral-400">
          Markdown supported. Cmd+Enter to save, Escape to cancel.
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={isSaving}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:bg-neutral-300"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
