// file: components/AppLayout.tsx
// Root layout: sidebar + main content area with Outlet.
// Guards routes - redirects to ConnectPage if not connected.
// Used by: App.tsx as the parent route for all authenticated pages.
// Hydrates connection from localStorage on mount.

import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router';
import { useConnectionStore } from '@/stores/connection';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const { isConnected, hydrate } = useConnectionStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!isConnected) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <Outlet />
      </main>
    </div>
  );
}
