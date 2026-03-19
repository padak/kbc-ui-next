// file: src/config/markdown.ts
// Constants for Markdown description rendering and editing.
// Centralizes thresholds, timeouts, and toolbar definitions.
// Used by: DescriptionDisplay, DescriptionEditor, MarkdownViewer.
// All markdown-related constants live here — never hardcode elsewhere.

export const DESCRIPTION_COLLAPSE_HEIGHT_PX = 120;

export const MERMAID_RENDER_TIMEOUT_MS = 5_000;

export type ToolbarItem = {
  label: string;
  icon: string;
  prefix: string;
  suffix: string;
  block?: boolean;
};

export const TOOLBAR_ITEMS: ToolbarItem[] = [
  { label: 'Bold', icon: 'B', prefix: '**', suffix: '**' },
  { label: 'Italic', icon: 'I', prefix: '_', suffix: '_' },
  { label: 'Heading', icon: 'H', prefix: '### ', suffix: '', block: true },
  { label: 'Link', icon: '🔗', prefix: '[', suffix: '](url)' },
  { label: 'Bulleted list', icon: '•', prefix: '- ', suffix: '', block: true },
  { label: 'Numbered list', icon: '1.', prefix: '1. ', suffix: '', block: true },
  { label: 'Code', icon: '`', prefix: '`', suffix: '`' },
  { label: 'Code block', icon: '```', prefix: '```\n', suffix: '\n```', block: true },
  {
    label: 'Mermaid diagram',
    icon: '◇',
    prefix: '```mermaid\ngraph TD\n  A[Start] --> B[End]\n',
    suffix: '```',
    block: true,
  },
];
