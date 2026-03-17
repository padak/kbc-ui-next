// file: components/AppLayout.tsx
// Root layout: collapsible sidebar + main content area with Outlet.
// Guards routes - redirects to ConnectPage if not connected.
// Used by: App.tsx as the parent route for all authenticated pages.
// Sidebar collapses to icons on small screens, expands on hover/click.

import { useState } from 'react';
import { Outlet, Navigate } from 'react-router';
import { useConnectionStore } from '@/stores/connection';
import { Sidebar } from './Sidebar';
import { ErrorBoundary } from './ErrorBoundary';

export function AppLayout() {
  const isConnected = useConnectionStore((s) => s.isConnected);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!isConnected) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className="min-w-0 flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
