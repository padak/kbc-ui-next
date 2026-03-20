// file: src/components/MermaidDiagram.tsx
// Renders a Mermaid diagram from source text into inline SVG.
// Lazy-loaded — only fetched when a ```mermaid code block is detected.
// Used by: MarkdownViewer (via React.lazy + Suspense).
// Uses dangerouslySetInnerHTML for SVG output (standard mermaid pattern).

import { useState, useEffect, useId } from 'react';
import { MERMAID_RENDER_TIMEOUT_MS } from '@/config/markdown';

let mermaidInitialized = false;

async function getMermaid() {
  const { default: mermaid } = await import('mermaid');
  if (!mermaidInitialized) {
    mermaidInitialized = true;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      fontFamily: 'Inter, system-ui, sans-serif',
      securityLevel: 'strict',
    });
  }
  return mermaid;
}

type MermaidDiagramProps = {
  source: string;
};

export function MermaidDiagram({ source }: MermaidDiagramProps) {
  const reactId = useId();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${reactId.replace(/:/g, '')}`;

    const timer = setTimeout(() => {
      if (!cancelled) {
        setError('Mermaid render timed out');
      }
    }, MERMAID_RENDER_TIMEOUT_MS);

    getMermaid()
      .then(async (mermaid) => {
        const { svg: rendered } = await mermaid.render(id, source);
        if (!cancelled) {
          clearTimeout(timer);
          setSvg(rendered);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          clearTimeout(timer);
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, reactId]);

  if (error) {
    return (
      <div className="rounded-md border-2 border-red-300 bg-red-50 p-4">
        <p className="mb-2 text-sm font-medium text-red-700">Mermaid diagram error</p>
        <p className="mb-3 text-xs text-red-600">{error}</p>
        <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-300">{source}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-gray-200 bg-gray-50">
        <span className="text-sm text-gray-400">Rendering diagram...</span>
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-md bg-white p-2"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
