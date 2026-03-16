// file: pages/transformations/TransformationsPage.tsx
// Transformations listing: all transformation component configs.
// Filters components by type='transformation' and lists their configs.
// Used by: App.tsx route /transformations.
// Data from: hooks/useComponents.ts (useComponentsByType).

import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { useComponentsByType } from '@/hooks/useComponents';

export function TransformationsPage() {
  const navigate = useNavigate();
  const { data: transformations, isLoading } = useComponentsByType('transformation');

  return (
    <div>
      <PageHeader
        title="Transformations"
        description="Data transformation components"
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading...</div>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {transformations?.map((comp) => (
          <button
            key={comp.id}
            onClick={() => navigate(`/components/${encodeURIComponent(comp.id)}`)}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            {comp.ico32 && <img src={comp.ico32} alt="" className="h-8 w-8 rounded" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{comp.name}</p>
              <p className="truncate text-xs text-gray-500">{comp.description}</p>
            </div>
          </button>
        ))}
      </div>

      {!isLoading && !transformations?.length && (
        <p className="py-8 text-center text-sm text-gray-400">No transformation components available</p>
      )}
    </div>
  );
}
