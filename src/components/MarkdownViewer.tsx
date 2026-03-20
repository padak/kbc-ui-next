// file: src/components/MarkdownViewer.tsx
// Read-only Markdown renderer with Tailwind-styled elements and Mermaid support.
// Uses react-markdown + remark-gfm for tables, strikethrough, autolinks, task lists.
// Used by: DescriptionDisplay, DescriptionEditor (preview mode).
// Mermaid diagrams are lazy-loaded only when ```mermaid blocks are detected.

import { lazy, Suspense, useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { KBC_FILE_PROTOCOL } from '@/config/markdown';

// Lazy-load MermaidDiagram (same pattern as SqlEditor in TransformationBlocks.tsx)
const mermaidImport = () => import('@/components/MermaidDiagram');
const MermaidDiagram = lazy(() => mermaidImport().then((m) => ({ default: m.MermaidDiagram })));

let mermaidPrefetched = false;
export function prefetchMermaid() {
  if (!mermaidPrefetched) {
    mermaidPrefetched = true;
    mermaidImport();
  }
}

type MarkdownViewerProps = {
  content: string;
  className?: string;
};

// Component for rendering images from Keboola Storage Files (kbc-file:// protocol)
function KbcFileImage({ src, alt }: { src: string; alt?: string }) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Parse kbc-file://{fileId}/{fileName}
    const path = src.replace(KBC_FILE_PROTOCOL, '');
    const fileId = parseInt(path.split('/')[0] ?? '', 10);
    if (isNaN(fileId)) {
      setError(true);
      setLoading(false);
      return;
    }

    // Lazy-load the API function to avoid circular imports
    import('@/api/files')
      .then(({ getFileDownloadUrl }) => getFileDownloadUrl(fileId))
      .then((url) => {
        setResolvedUrl(url);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [src]);

  if (loading) {
    return (
      <span className="inline-block h-20 w-32 animate-pulse rounded-md bg-neutral-100" />
    );
  }

  if (error || !resolvedUrl) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-500">
        Image not found
      </span>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      className="my-2 max-w-full rounded-md border border-neutral-200"
      loading="lazy"
    />
  );
}

// Custom components for Tailwind styling using design tokens
const markdownComponents = {
  h1: ({ children, ...props }: React.ComponentProps<'h1'>) => (
    <h1 className="mb-3 mt-4 text-xl font-medium text-neutral-900" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.ComponentProps<'h2'>) => (
    <h2 className="mb-2 mt-3 text-lg font-medium text-neutral-900" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: React.ComponentProps<'h3'>) => (
    <h3 className="mb-2 mt-3 text-base font-medium text-neutral-900" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }: React.ComponentProps<'p'>) => (
    <p className="mb-2 text-sm leading-relaxed text-neutral-700" {...props}>{children}</p>
  ),
  a: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline hover:text-blue-700"
      {...props}
    >
      {children}
    </a>
  ),
  ul: ({ children, ...props }: React.ComponentProps<'ul'>) => (
    <ul className="mb-2 ml-4 list-disc text-sm text-neutral-700" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: React.ComponentProps<'ol'>) => (
    <ol className="mb-2 ml-4 list-decimal text-sm text-neutral-700" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: React.ComponentProps<'li'>) => (
    <li className="mb-1" {...props}>{children}</li>
  ),
  blockquote: ({ children, ...props }: React.ComponentProps<'blockquote'>) => (
    <blockquote
      className="mb-2 border-l-4 border-neutral-200 pl-3 text-sm italic text-neutral-500"
      {...props}
    >
      {children}
    </blockquote>
  ),
  // Images: detect kbc-file:// protocol for Storage Files, regular URL for external images
  img: ({ src, alt, ...props }: React.ComponentProps<'img'>) => {
    if (src?.startsWith(KBC_FILE_PROTOCOL)) {
      return <KbcFileImage src={src} alt={alt} />;
    }
    return (
      <img
        src={src}
        alt={alt}
        className="my-2 max-w-full rounded-md border border-neutral-200"
        loading="lazy"
        {...props}
      />
    );
  },
  hr: (props: React.ComponentProps<'hr'>) => (
    <hr className="my-4 border-neutral-200" {...props} />
  ),
  table: ({ children, ...props }: React.ComponentProps<'table'>) => (
    <div className="mb-3 overflow-x-auto rounded-md border border-neutral-200">
      <table className="min-w-full divide-y divide-neutral-200 text-sm" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }: React.ComponentProps<'thead'>) => (
    <thead className="bg-neutral-50" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }: React.ComponentProps<'th'>) => (
    <th className="border-b border-neutral-200 px-3 py-2 text-left text-xs font-semibold text-neutral-600" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }: React.ComponentProps<'td'>) => (
    <td className="border-b border-neutral-100 px-3 py-2 text-neutral-700" {...props}>{children}</td>
  ),
  // Code blocks: dark bg for language-tagged, light bg for plain/ASCII art, transparent for mermaid
  pre: ({ children, ...props }: React.ComponentProps<'pre'>) => {
    const codeChild = Array.isArray(children) ? children[0] : children;
    const codeClassName = codeChild &&
      typeof codeChild === 'object' &&
      'props' in codeChild
      ? codeChild.props?.className ?? ''
      : '';

    // Mermaid blocks: no pre styling — MermaidDiagram handles its own container
    if (codeClassName === 'language-mermaid') {
      return <>{children}</>;
    }

    // Language-tagged code: dark background
    if (/language-/.test(codeClassName)) {
      return (
        <pre className="mb-3 overflow-x-auto rounded-md bg-neutral-800 p-3 text-sm" {...props}>
          {children}
        </pre>
      );
    }

    // Plain code blocks (ASCII art, etc.): light background
    return (
      <pre className="mb-3 overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700" {...props}>
        {children}
      </pre>
    );
  },
  code: ({
    children,
    className,
    ...props
  }: React.ComponentProps<'code'> & { className?: string }) => {
    // Detect mermaid code blocks
    if (className === 'language-mermaid') {
      const source = String(children).trim();
      return (
        <Suspense
          fallback={
            <div className="flex h-32 items-center justify-center rounded-md border border-gray-200 bg-gray-50">
              <span className="text-sm text-gray-400">Loading diagram...</span>
            </div>
          }
        >
          <MermaidDiagram source={source} />
        </Suspense>
      );
    }

    // Inline code (no className = not inside a <pre>)
    if (!className) {
      return (
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-mono text-neutral-700" {...props}>
          {children}
        </code>
      );
    }

    // Language-tagged code blocks (inside <pre>) — light text on dark bg
    return (
      <code className={`text-xs font-mono text-green-300 ${className}`} {...props}>
        {children}
      </code>
    );
  },
};

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  if (!content) return null;

  return (
    <div className={`kbc-markdown ${className ?? ''}`}>
      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{content}</Markdown>
    </div>
  );
}
