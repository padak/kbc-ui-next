// file: components/AppLayout.tsx
// Root layout: sidebar + main content area with Outlet.
// Guards routes - redirects to ConnectPage if not connected.
// Used by: App.tsx as the parent route for all authenticated pages.
// Connection state is hydrated synchronously in the store.

import { Outlet, Navigate } from 'react-router';
import { useConnectionStore } from '@/stores/connection';
import { Sidebar } from './Sidebar';
import { ErrorBoundary } from './ErrorBoundary';

export function AppLayout() {
  const isConnected = useConnectionStore((s) => s.isConnected);

  if (!isConnected) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
