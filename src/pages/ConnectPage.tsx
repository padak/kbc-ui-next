// file: pages/ConnectPage.tsx
// Login/connect page: auto-loads projects from env or shows manual connect form.
// Verifies tokens against the Keboola API before connecting.
// Used by: App.tsx as the default route for unauthenticated users.
// Multi-project: loads from VITE_PROJECTS, falls back to manual form.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useConnect } from '@/hooks/useAuth';
import { useConnectionStore } from '@/stores/connection';
import { loadProjects } from '@/lib/projectLoader';
import { ROUTES } from '@/lib/constants';

export function ConnectPage() {
  const navigate = useNavigate();
  const { isConnected, setProjects, setLoading, isLoading } = useConnectionStore();
  const { connect, isPending, error } = useConnect();
  const autoLoadAttempted = useRef(false);

  const [stackUrl, setStackUrl] = useState(import.meta.env.VITE_STACK_URL ?? '');
  const [token, setToken] = useState(import.meta.env.VITE_STORAGE_TOKEN ?? '');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Redirect if already connected
  useEffect(() => {
    if (isConnected) {
      navigate(ROUTES.DASHBOARD, { replace: true });
    }
  }, [isConnected, navigate]);

  // Auto-load projects from env on mount
  useEffect(() => {
    if (autoLoadAttempted.current || isConnected) return;
    autoLoadAttempted.current = true;

    // Don't auto-reconnect if user explicitly disconnected (resets on tab close)
    if (sessionStorage.getItem('kbc_disconnected')) return;

    // loadProjects() checks projects.secret.json first, then env vars

    setLoading(true);
    loadProjects()
      .then((projects) => {
        if (projects.length > 0) {
          setProjects(projects);
          // isConnected will become true, triggering the redirect above
        } else {
          setLoadError('No valid projects found. Check your tokens.');
        }
      })
      .catch((err) => {
        console.error('[ConnectPage] Failed to load projects:', err);
        setLoadError('Failed to load projects from environment configuration.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isConnected, setProjects, setLoading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stackUrl.trim() || !token.trim()) return;

    try {
      sessionStorage.removeItem('kbc_disconnected');
      await connect(stackUrl.trim(), token.trim());
      navigate(ROUTES.DASHBOARD);
    } catch {
      // Error is captured by the mutation
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
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Keboola</h1>
          <p className="mt-2 text-sm text-gray-500">Connect to your Keboola stack</p>
        </div>

        {loadError && (
          <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
            {loadError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
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

        <p className="mt-4 text-center text-xs text-gray-400">
          <a href="/setup" className="text-blue-600 hover:underline">
            Manage Organizations
          </a>
        </p>
      </div>
    </div>
  );
}
