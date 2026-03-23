// file: src/components/DescriptionDisplay.tsx
// Compact documentation card with Markdown preview and fullscreen modal.
// Click anywhere on the card opens the modal — no inline expand.
// Used by: ConfigurationDetailPage, ConfigurationRowPage via PageHeader.
// Empty state shows prominent "Document this configuration" CTA.

import { useState, useRef, useEffect, useCallback } from 'react';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import { DescriptionModal, type ConfigContext } from '@/components/DescriptionModal';
import { DESCRIPTION_COLLAPSE_HEIGHT_PX } from '@/config/markdown';

type DescriptionDisplayProps = {
  content: string;
  title?: string;
  onEdit: () => void;
  configContext?: ConfigContext;
  className?: string;
};

export function DescriptionDisplay({
  content,
  title = 'Description',
  onEdit,
  configContext,
  className,
}: DescriptionDisplayProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleCopyMarkdown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  useEffect(() => {
    if (!contentRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsOverflowing(entry.contentRect.height > DESCRIPTION_COLLAPSE_HEIGHT_PX);
      }
    });

    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [content]);

  // Empty state — prominent CTA to add documentation
  if (!content) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className={`group flex items-center gap-2 rounded-lg border border-dashed border-neutral-200 px-3 py-2 text-sm text-neutral-400 transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-500 ${className ?? ''}`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0 text-neutral-300 transition-colors group-hover:text-neutral-400">
          <path d="M2 3h12M2 6.5h8M2 10h10M2 13.5h6" />
        </svg>
        Add documentation...
      </button>
    );
  }

  return (
    <>
      {/* Compact documentation card */}
      <div
        className={`group relative cursor-pointer rounded-lg border border-neutral-150 bg-white transition-all hover:border-neutral-200 hover:shadow-sm ${className ?? ''}`}
        onClick={() => setModalOpen(true)}
        title="Click to view full documentation"
      >
        {/* Card header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-1.5">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
              <path d="M2 3h12M2 6.5h8M2 10h10M2 13.5h6" />
            </svg>
            Documentation
          </div>
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="rounded px-1.5 py-0.5 text-xs text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
              title="Copy Markdown to clipboard"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <span className="text-xs text-neutral-300">|</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="rounded px-1.5 py-0.5 text-xs text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
              title="Edit documentation"
            >
              Edit
            </button>
            <span className="text-xs text-neutral-300">|</span>
            <span className="text-xs text-neutral-400">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="inline-block">
                <path d="M6 2H2v4M14 2h-4M14 10v4h-4M2 10v4h4" />
              </svg>
            </span>
          </div>
        </div>

        {/* Markdown preview — fixed max height with gradient fade */}
        <div
          className="relative overflow-hidden px-3 py-2"
          style={{ maxHeight: `${DESCRIPTION_COLLAPSE_HEIGHT_PX}px` }}
        >
          <div ref={contentRef}>
            <MarkdownViewer content={content} />
          </div>

          {/* Gradient fade when content overflows */}
          {isOverflowing && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent" />
          )}
        </div>

        {/* "View more" footer when content overflows */}
        {isOverflowing && (
          <div className="border-t border-neutral-100 px-3 py-1.5 text-center">
            <span className="text-xs font-medium text-blue-600 group-hover:text-blue-700">
              View full documentation
            </span>
          </div>
        )}
      </div>

      {/* Fullscreen modal */}
      <DescriptionModal
        content={content}
        title={title}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onEdit={onEdit}
        configContext={configContext}
      />
    </>
  );
}
