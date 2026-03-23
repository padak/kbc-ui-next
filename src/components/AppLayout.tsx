// file: components/AppLayout.tsx
// Root layout: collapsible sidebar + main content area with Outlet.
// Guards routes - redirects to ConnectPage if not connected.
// Used by: App.tsx as the parent route for all authenticated pages.
// Handles loading state during project initialization.

import { useState, useEffect, useRef } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router';
import { useConnectionStore } from '@/stores/connection';
import { useToastStore } from '@/stores/toast';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { ErrorBoundary } from './ErrorBoundary';
import { ToastContainer } from './Toast';
import { Skeleton } from './Skeleton';
import { useMetadataPreload } from '@/hooks/useMetadataPreload';

export function AppLayout() {
  const { isConnected, isLoading } = useConnectionStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="w-64 space-y-4 text-center">
          <Skeleton variant="line" height={24} width="60%" className="mx-auto" />
          <Skeleton variant="line" height={16} width="80%" className="mx-auto" />
          <Skeleton variant="line" height={16} width="45%" className="mx-auto" />
          <p className="mt-4 text-sm text-gray-500">Loading projects...</p>
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

// Listing routes that are safe to stay on when switching projects (no project-specific IDs in URL).
// Everything else with a deeper path (e.g. /jobs/123, /storage/in.c-bucket) is a detail page
// and needs redirect to its parent listing.
const SAFE_LISTING_ROUTES = new Set([
  '/dashboard',
  '/storage',
  '/components',
  '/flows',
  '/transformations',
  '/jobs',
  '/jobs/all',
  '/settings',
]);

function AppLayoutInner({
  sidebarCollapsed,
  onToggleSidebar,
}: {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  useMetadataPreload();
  const { activeProjectId, projectName } = useConnectionStore();
  const navigate = useNavigate();
  const location = useLocation();
  const prevProjectId = useRef(activeProjectId);

  // When active project changes, redirect away from project-specific detail pages
  useEffect(() => {
    if (prevProjectId.current && prevProjectId.current !== activeProjectId) {
      const pathname = location.pathname;
      const isOnSafePage = SAFE_LISTING_ROUTES.has(pathname);
      if (!isOnSafePage && pathname !== '/') {
        // Navigate to the parent listing page (e.g. /jobs/123 -> /jobs)
        const parentPath = '/' + pathname.split('/')[1];
        navigate(parentPath, { replace: true });
        useToastStore.getState().addToast(
          'info',
          `Switched to ${projectName || 'new project'} — redirected to listing`,
        );
      }
    }
    prevProjectId.current = activeProjectId;
  }, [activeProjectId, location.pathname, navigate, projectName]);

  return (
    <div className="flex h-screen">
      <Sidebar collapsed={sidebarCollapsed} onToggle={onToggleSidebar} />
      <main className="min-w-0 flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <CommandPalette />
      <ToastContainer />
    </div>
  );
}
