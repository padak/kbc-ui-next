// file: pages/settings/SettingsPage.tsx
// Project settings: token info, project details, connection status.
// Displays current token permissions and project features.
// Used by: App.tsx route /settings.
// Data from: hooks/useAuth.ts (useTokenInfo).

import { PageHeader } from '@/components/PageHeader';
import { useTokenInfo } from '@/hooks/useAuth';
import { useConnectionStore } from '@/stores/connection';
import { formatDate } from '@/lib/formatters';

export function SettingsPage() {
  const { stackUrl } = useConnectionStore();
  const { data: token, isLoading } = useTokenInfo();

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-gray-400">Loading...</div>;
  }

  return (
    <div>
      <PageHeader title="Settings" description="Project and connection settings" />

      {/* Connection Info */}
      <div className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Connection</h2>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-gray-500">Stack URL</dt>
              <dd className="text-sm font-mono text-gray-900">{stackUrl}</dd>
            </div>
            {token && (
              <>
                <div>
                  <dt className="text-xs text-gray-500">Project</dt>
                  <dd className="text-sm text-gray-900">{token.owner.name} (ID: {token.owner.id})</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Token</dt>
                  <dd className="text-sm text-gray-900">{token.description}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Token Created</dt>
                  <dd className="text-sm text-gray-900">{formatDate(token.created)}</dd>
                </div>
              </>
            )}
          </dl>
        </div>
      </div>

      {/* Permissions */}
      {token && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Token Permissions</h2>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap gap-2">
              {token.isMasterToken && (
                <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">Master Token</span>
              )}
              {token.canManageBuckets && (
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">Manage Buckets</span>
              )}
              {token.canManageTokens && (
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">Manage Tokens</span>
              )}
              {token.canReadAllFileUploads && (
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">Read All Files</span>
              )}
              {token.canPurgeTrash && (
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">Purge Trash</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Project Features */}
      {token?.owner.features && token.owner.features.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Project Features</h2>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap gap-1.5">
              {token.owner.features.map((f) => (
                <span key={f} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
