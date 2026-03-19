// file: src/components/DescriptionDisplay.tsx
// Read-only description with Markdown rendering, collapse/expand, and edit trigger.
// Empty descriptions show an "Add description..." placeholder.
// Used by: ConfigurationDetailPage, ConfigurationRowPage via PageHeader.
// Collapse uses ResizeObserver to measure actual rendered height.

import { useState, useRef, useEffect } from 'react';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import { DESCRIPTION_COLLAPSE_HEIGHT_PX } from '@/config/markdown';

type DescriptionDisplayProps = {
  content: string;
  onEdit: () => void;
  collapsible?: boolean;
  className?: string;
};

export function DescriptionDisplay({
  content,
  onEdit,
  collapsible = true,
  className,
}: DescriptionDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsible || !contentRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setNeedsCollapse(entry.contentRect.height > DESCRIPTION_COLLAPSE_HEIGHT_PX);
      }
    });

    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [collapsible, content]);

  // Empty state — clickable placeholder
  if (!content) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className={`text-sm italic text-neutral-400 hover:text-neutral-500 ${className ?? ''}`}
      >
        Add description...
      </button>
    );
  }

  const isCollapsed = collapsible && needsCollapse && !expanded;

  return (
    <div className={`group relative ${className ?? ''}`}>
      {/* Edit button (top-right, visible on hover) */}
      <button
        type="button"
        onClick={onEdit}
        className="absolute right-0 top-0 z-10 rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-xs text-neutral-400 opacity-0 shadow-sm transition-opacity hover:text-neutral-600 group-hover:opacity-100"
        title="Edit description"
      >
        Edit
      </button>

      {/* Markdown content */}
      <div
        className="relative overflow-hidden transition-[max-height] duration-200"
        style={isCollapsed ? { maxHeight: `${DESCRIPTION_COLLAPSE_HEIGHT_PX}px` } : undefined}
      >
        <div ref={contentRef}>
          <MarkdownViewer content={content} />
        </div>

        {/* Gradient fade overlay when collapsed */}
        {isCollapsed && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-neutral-50 to-transparent" />
        )}
      </div>

      {/* Show more/less toggle */}
      {collapsible && needsCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
