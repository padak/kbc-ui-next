// file: src/components/DescriptionModal.tsx
// Fullscreen modal for reading Markdown descriptions with proper typography.
// Mermaid diagrams render at full size. Escape / click-outside / X to close.
// Used by: DescriptionDisplay (via card click).
// "Copy context for AI" copies config context to clipboard for documentation drafting.

import { useState, useEffect, useCallback, useRef } from 'react';
import { MarkdownViewer } from '@/components/MarkdownViewer';

export type ConfigContext = {
  componentId: string;
  configId: string;
  configName: string;
  componentName?: string;
  description: string;
  configuration: unknown;
  rows?: Array<{ id: string; name: string; description: string }>;
};

function buildContextText(ctx: ConfigContext): string {
  const lines: string[] = [
    `# Configuration Context for AI Documentation`,
    ``,
    `## Overview`,
    `- **Component**: ${ctx.componentName ?? ctx.componentId}`,
    `- **Component ID**: ${ctx.componentId}`,
    `- **Configuration**: ${ctx.configName} (ID: ${ctx.configId})`,
    ``,
  ];

  if (ctx.description) {
    lines.push(`## Current Description`, ``, ctx.description, ``);
  } else {
    lines.push(`## Current Description`, ``, `(no description yet)`, ``);
  }

  lines.push(
    `## Configuration JSON`,
    ``,
    '```json',
    JSON.stringify(ctx.configuration, null, 2),
    '```',
    ``,
  );

  if (ctx.rows && ctx.rows.length > 0) {
    lines.push(`## Configuration Rows (${ctx.rows.length})`, ``);
    for (const row of ctx.rows) {
      lines.push(`- **${row.name || row.id}**: ${row.description || '(no description)'}`);
    }
    lines.push(``);
  }

  lines.push(
    `## Instructions`,
    ``,
    `Write a Markdown description for this Keboola configuration. Include:`,
    `- What this configuration does (purpose, data source/target)`,
    `- Key parameters and their meaning`,
    `- Any important notes or caveats`,
    `- Use Mermaid diagrams if a visual would help explain data flow`,
    ``,
    `Return ONLY the Markdown description text, ready to paste.`,
  );

  return lines.join('\n');
}

type DescriptionModalProps = {
  content: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  configContext?: ConfigContext;
};

export function DescriptionModal({ content, title, isOpen, onClose, onEdit, configContext }: DescriptionModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Escape to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prev;
    };
  }, [isOpen, handleKeyDown]);

  // Reset copied state when modal closes
  useEffect(() => {
    if (!isOpen) setCopied(false);
  }, [isOpen]);

  const handleCopyContext = useCallback(() => {
    if (!configContext) return;
    const text = buildContextText(configContext);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [configContext]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-900/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="kbc-description-modal-enter mx-4 my-8 w-full max-w-4xl lg:mx-8 lg:max-w-6xl xl:mx-12 xl:max-w-7xl">
        {/* Card */}
        <div className="rounded-xl bg-white shadow-2xl ring-1 ring-neutral-200/50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold text-neutral-900">{title}</h2>
              <p className="mt-0.5 text-xs text-neutral-400">Configuration documentation</p>
            </div>
            <div className="ml-4 flex items-center gap-2">
              {configContext && (
                <button
                  type="button"
                  onClick={handleCopyContext}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
                  title="Copy configuration context to clipboard for AI documentation"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
                    <path d="M8 1.5l2.5 2.5M4 9l4.5-4.5M2 14h3.5l7-7-3.5-3.5-7 7V14z" />
                  </svg>
                  {copied ? 'Copied!' : 'Copy context for AI'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit();
                }}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                title="Close (Escape)"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body — readable width for prose, full width for diagrams */}
          <div className="px-6 py-6 sm:px-10 sm:py-8">
            <div className="description-modal-content">
              <MarkdownViewer content={content} className="prose-description-modal" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-neutral-100 px-6 py-3">
            <span className="text-xs text-neutral-400">
              Escape to close
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
