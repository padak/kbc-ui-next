// file: pages/ConnectPage.tsx
// Login/connect page: user enters stack URL + Storage API token.
// Verifies token against the Keboola API before connecting.
// Used by: App.tsx as the default route for unauthenticated users.
// Pre-fills from VITE_STACK_URL and VITE_STORAGE_TOKEN env vars.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useConnect } from '@/hooks/useAuth';
import { useConnectionStore } from '@/stores/connection';
import { ROUTES } from '@/lib/constants';

export function ConnectPage() {
  const navigate = useNavigate();
  const { isConnected, hydrate } = useConnectionStore();
  const { connect, isPending, error } = useConnect();

  const [stackUrl, setStackUrl] = useState(import.meta.env.VITE_STACK_URL ?? '');
  const [token, setToken] = useState(import.meta.env.VITE_STORAGE_TOKEN ?? '');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isConnected) {
      navigate(ROUTES.DASHBOARD, { replace: true });
    }
  }, [isConnected, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stackUrl.trim() || !token.trim()) return;

    try {
      await connect(stackUrl.trim(), token.trim());
      navigate(ROUTES.DASHBOARD);
    } catch {
      // Error is captured by the mutation
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Keboola</h1>
          <p className="mt-2 text-sm text-gray-500">Connect to your Keboola stack</p>
        </div>

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
      </div>
    </div>
  );
}
