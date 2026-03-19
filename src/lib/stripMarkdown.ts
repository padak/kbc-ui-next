// file: src/lib/stripMarkdown.ts
// Strips Markdown formatting to produce plain-text excerpts.
// Removes headings, bold, italic, links, images, code blocks, lists.
// Used by: ConfigurationsPage, ConfigurationDetailPage (row listings).
// Lightweight regex approach — no external dependencies needed.

export function stripMarkdown(text: string): string {
  if (!text) return '';

  return (
    text
      // Remove code blocks (```...```)
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code (`...`)
      .replace(/`([^`]+)`/g, '$1')
      // Remove images ![alt](url)
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Remove links [text](url) → text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Remove headings (# ... )
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold **text** or __text__
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      // Remove italic *text* or _text_
      .replace(/(\*|_)(.*?)\1/g, '$2')
      // Remove strikethrough ~~text~~
      .replace(/~~(.*?)~~/g, '$1')
      // Remove blockquotes
      .replace(/^>\s+/gm, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // Remove list markers (- , * , 1. )
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Collapse whitespace
      .replace(/\n{2,}/g, ' ')
      .replace(/\n/g, ' ')
      .trim()
  );
}
