// file: pages/components/ConfigurationDetailPage.tsx
// Single configuration detail: JSON view, rows list, metadata.
// Generic page that works for ALL component types (extractors, writers, etc.).
// Used by: App.tsx route /components/:componentId/:configId.
// Data from: hooks/useComponents.ts (useConfiguration).

import { useParams, useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { useConfiguration } from '@/hooks/useComponents';
import { formatDate } from '@/lib/formatters';

export function ConfigurationDetailPage() {
  const { componentId, configId } = useParams<{ componentId: string; configId: string }>();
  const navigate = useNavigate();
  const { data: config, isLoading, error } = useConfiguration(componentId ?? '', configId ?? '');

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-gray-400">Loading configuration...</div>;
  }

  if (error) {
    return <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</div>;
  }

  if (!config) return null;

  return (
    <div>
      <PageHeader
        title={config.name}
        description={config.description || `Version ${config.version}`}
        actions={
          <button
            onClick={() => navigate(`/components/${encodeURIComponent(componentId ?? '')}`)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Back to Configurations
          </button>
        }
      />

      {/* Info */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Version</p>
          <p className="text-lg font-semibold">{config.version}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Rows</p>
          <p className="text-lg font-semibold">{config.rows.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Status</p>
          <p className="text-lg font-semibold">{config.isDisabled ? 'Disabled' : 'Active'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500">Last Changed</p>
          <p className="text-sm font-semibold">{formatDate(config.currentVersion.created)}</p>
        </div>
      </div>

      {/* Configuration Rows */}
      {config.rows.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Rows</h2>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {config.rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/components/${encodeURIComponent(componentId ?? '')}/${configId}/rows/${row.id}`)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800">{row.name || row.id}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{row.description || '-'}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.isDisabled ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-700'
                      }`}>
                        {row.isDisabled ? 'Disabled' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Raw Configuration JSON */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Configuration JSON</h2>
      <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-900 p-4 text-sm text-green-400">
        {JSON.stringify(config.configuration, null, 2)}
      </pre>
    </div>
  );
}
