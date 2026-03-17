// file: pages/ConnectPage.tsx
// Login page: shows configured organizations or manual connect form.
// Auto-loads from projects.secret.json / env vars on first visit.
// Used by: App.tsx as the default route for unauthenticated users.
// After disconnect, shows org list for quick reconnect.

import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router';
import { useConnect } from '@/hooks/useAuth';
import { useConnectionStore } from '@/stores/connection';
import type { ProjectEntry } from '@/stores/connection';
import { loadProjects } from '@/lib/projectLoader';
import { loadProjectConfig, type OrgConfig } from '@/lib/projectConfig';
import { ROUTES } from '@/lib/constants';

export function ConnectPage() {
  const navigate = useNavigate();
  const { isConnected, setProjects, setLoading, isLoading } = useConnectionStore();
  const { connect, isPending, error } = useConnect();
  const autoLoadAttempted = useRef(false);

  const [stackUrl, setStackUrl] = useState(import.meta.env.VITE_STACK_URL ?? '');
  const [token, setToken] = useState(import.meta.env.VITE_STORAGE_TOKEN ?? '');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgConfig[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);

  // Redirect if already connected
  useEffect(() => {
    if (isConnected) {
      navigate(ROUTES.DASHBOARD, { replace: true });
    }
  }, [isConnected, navigate]);

  // Load available organizations and auto-connect
  useEffect(() => {
    if (autoLoadAttempted.current || isConnected) return;
    autoLoadAttempted.current = true;

    // Load org list for display (even if disconnected)
    loadProjectConfig().then((config) => {
      if (config.organizations.length > 0) {
        setOrgs(config.organizations);
      }
    });

    // Don't auto-reconnect if user explicitly disconnected
    if (sessionStorage.getItem('kbc_disconnected')) return;

    setLoading(true);
    loadProjects()
      .then((projects) => {
        if (projects.length > 0) {
          setProjects(projects);
        }
      })
      .catch((err) => {
        console.error('[ConnectPage] Failed to load projects:', err);
        setLoadError('Failed to load projects.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isConnected, setProjects, setLoading]);

  async function handleConnectOrg(org: OrgConfig) {
    setLoading(true);
    setLoadError(null);
    try {
      const entries: ProjectEntry[] = org.projects.map((p) => ({
        id: String(p.id),
        stackUrl: org.stack.replace(/\/+$/, ''),
        token: p.token,
        projectId: Number(p.id),
        projectName: p.name,
        organizationId: org.id,
        organizationName: org.name,
        tokenDescription: '',
      }));
      sessionStorage.removeItem('kbc_disconnected');
      setProjects(entries);
    } catch {
      setLoadError(`Failed to connect to ${org.name}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stackUrl.trim() || !token.trim()) return;
    try {
      sessionStorage.removeItem('kbc_disconnected');
      await connect(stackUrl.trim(), token.trim());
      navigate(ROUTES.DASHBOARD);
    } catch {
      // Error captured by mutation
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="mb-4 text-4xl text-gray-300">&#8987;</div>
          <h1 className="text-xl font-semibold text-gray-700">Loading projects...</h1>
          <p className="mt-2 text-sm text-gray-400">Verifying API tokens</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Keboola</h1>
          <p className="mt-2 text-sm text-gray-500">
            {orgs.length > 0 ? 'Select an organization to connect' : 'Connect to your Keboola stack'}
          </p>
        </div>

        {loadError && (
          <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-700">{loadError}</div>
        )}

        {/* Organization cards */}
        {orgs.length > 0 && !showManualForm && (
          <div className="mb-6 space-y-3">
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => handleConnectOrg(org)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-5 py-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{org.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {org.projects.length} project{org.projects.length !== 1 ? 's' : ''} on {new URL(org.stack).hostname.replace('connection.', '')}
                  </p>
                </div>
                <span className="text-sm text-blue-600">Connect &rarr;</span>
              </button>
            ))}

            <div className="flex items-center justify-center gap-4 pt-2 text-xs text-gray-400">
              <button onClick={() => setShowManualForm(true)} className="hover:text-gray-600">
                Manual connect
              </button>
              <span>|</span>
              <Link to="/setup" className="text-blue-600 hover:underline">
                Manage Organizations
              </Link>
            </div>
          </div>
        )}

        {/* Manual connect form */}
        {(orgs.length === 0 || showManualForm) && (
          <>
            <form onSubmit={handleManualSubmit} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <label htmlFor="stackUrl" className="mb-1 block text-sm font-medium text-gray-700">
                  Stack URL
                </label>
                <input
                  id="stackUrl"
                  type="url"
                  value={stackUrl}
                  onChange={(e) => setStackUrl(e.target.value)}
                  placeholder="https://connection.north-europe.azure.keboola.com"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="mb-6">
                <label htmlFor="token" className="mb-1 block text-sm font-medium text-gray-700">
                  Storage API Token
                </label>
                <input
                  id="token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Your Storage API token"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {error && (
                <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                  {error instanceof Error ? error.message : 'Connection failed'}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400"
              >
                {isPending ? 'Connecting...' : 'Connect'}
              </button>
            </form>

            <div className="flex items-center justify-center gap-4 pt-4 text-xs text-gray-400">
              {orgs.length > 0 && (
                <>
                  <button onClick={() => setShowManualForm(false)} className="text-blue-600 hover:underline">
                    Back to organizations
                  </button>
                  <span>|</span>
                </>
              )}
              <Link to="/setup" className="text-blue-600 hover:underline">
                Manage Organizations
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
