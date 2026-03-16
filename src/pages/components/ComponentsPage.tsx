// file: pages/components/ComponentsPage.tsx
// Components listing: all extractors, writers, apps grouped by type.
// Searchable, clickable rows navigate to component configurations.
// Used by: App.tsx route /components.
// Data from: hooks/useComponents.ts (useComponents).

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { useComponents } from '@/hooks/useComponents';
import type { Component } from '@/api/schemas';

const TYPE_LABELS: Record<string, string> = {
  extractor: 'Extractors',
  writer: 'Writers',
  application: 'Applications',
  transformation: 'Transformations',
  other: 'Other',
};

const TYPE_ORDER = ['extractor', 'writer', 'application', 'transformation', 'other'];

function groupByType(components: Component[]): Record<string, Component[]> {
  const groups: Record<string, Component[]> = {};
  for (const comp of components) {
    const type = comp.type || 'other';
    if (!groups[type]) groups[type] = [];
    groups[type].push(comp);
  }
  return groups;
}

export function ComponentsPage() {
  const navigate = useNavigate();
  const { data: components, isLoading, error } = useComponents();
  const [search, setSearch] = useState('');

  const filtered = components?.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
  });

  const groups = filtered ? groupByType(filtered) : {};

  return (
    <div>
      <PageHeader
        title="Components"
        description={`${components?.length ?? 0} components available`}
      />

      <input
        type="text"
        placeholder="Search components..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-6 w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading components...</div>
      )}

      {TYPE_ORDER.map((type) => {
        const group = groups[type];
        if (!group?.length) return null;

        return (
          <div key={type} className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              {TYPE_LABELS[type] ?? type} ({group.length})
            </h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {group.map((comp) => (
                <button
                  key={comp.id}
                  onClick={() => navigate(`/components/${encodeURIComponent(comp.id)}`)}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  {comp.ico32 && (
                    <img src={comp.ico32} alt="" className="h-8 w-8 rounded" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{comp.name}</p>
                    <p className="truncate text-xs text-gray-500">{comp.id}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
