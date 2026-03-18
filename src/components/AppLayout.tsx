// file: components/AppLayout.tsx
// Root layout: collapsible sidebar + main content area with Outlet.
// Guards routes - redirects to ConnectPage if not connected.
// Used by: App.tsx as the parent route for all authenticated pages.
// Handles loading state during project initialization.

import { useState } from 'react';
import { Outlet, Navigate } from 'react-router';
import { useConnectionStore } from '@/stores/connection';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { ErrorBoundary } from './ErrorBoundary';
import { ThemeToggle } from './ThemeToggle';
import { useMetadataPreload } from '@/hooks/useMetadataPreload';

export function AppLayout() {
  const { isConnected, isLoading } = useConnectionStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-4xl text-gray-300">&#8987;</div>
          <p className="text-sm text-gray-500">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayoutInner
      sidebarCollapsed={sidebarCollapsed}
      onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
    />
  );
}

// Inner component rendered after auth guard - safe to call hooks here
function AppLayoutInner({
  sidebarCollapsed,
  onToggleSidebar,
}: {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  useMetadataPreload();

  return (
    <div className="flex h-screen">
      <Sidebar collapsed={sidebarCollapsed} onToggle={onToggleSidebar} />
      <main className="min-w-0 flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <CommandPalette />
      <ThemeToggle />
    </div>
  );
}
