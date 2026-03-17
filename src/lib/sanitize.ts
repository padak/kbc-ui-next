// file: lib/sanitize.ts
// Lightweight HTML sanitizer using browser DOMParser.
// Strips dangerous tags/attributes while keeping safe formatting.
// Used by: SchemaForm.tsx for component description fields.
// Zero dependencies - uses only browser built-in APIs.

const ALLOWED_TAGS = new Set([
  'a', 'b', 'i', 'em', 'strong', 'code', 'br', 'p',
  'ul', 'ol', 'li', 'span', 'pre', 'sub', 'sup',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
};

function sanitizeNode(node: Node): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) continue;

    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tag)) {
        // Replace disallowed tag with its text content
        const text = document.createTextNode(el.textContent ?? '');
        node.replaceChild(text, child);
        continue;
      }

      // Remove disallowed attributes
      const allowedAttrs = ALLOWED_ATTRS[tag] ?? new Set<string>();
      for (const attr of Array.from(el.attributes)) {
        if (!allowedAttrs.has(attr.name)) {
          el.removeAttribute(attr.name);
        }
      }

      // Sanitize anchor hrefs - only allow http(s)
      if (tag === 'a') {
        const href = el.getAttribute('href') ?? '';
        if (href && !href.startsWith('https://') && !href.startsWith('http://')) {
          el.removeAttribute('href');
        }
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }

      sanitizeNode(el);
    } else {
      // Remove comments, processing instructions, etc.
      node.removeChild(child);
    }
  }
}

/**
 * Sanitize HTML string, keeping only safe formatting tags.
 * Uses browser DOMParser - safe against script injection.
 */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  sanitizeNode(doc.body);
  return doc.body.innerHTML;
}
