// file: App.tsx
// Root application component: routing, providers, query client.
// Defines all routes and wraps them with TanStack QueryClientProvider.
// Used by: main.tsx as the top-level component.
// Route structure mirrors the sidebar navigation.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { KeboolaApiError } from '@/api/client';
import { useConnectionStore } from '@/stores/connection';
import { AppLayout } from '@/components/AppLayout';
import { ConnectPage } from '@/pages/ConnectPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { BucketsPage } from '@/pages/storage/BucketsPage';
import { BucketDetailPage } from '@/pages/storage/BucketDetailPage';
import { TableDetailPage } from '@/pages/storage/TableDetailPage';
import { ComponentsPage } from '@/pages/components/ComponentsPage';
import { ConfigurationsPage } from '@/pages/components/ConfigurationsPage';
import { ConfigurationDetailPage } from '@/pages/components/ConfigurationDetailPage';
import { ConfigurationRowPage } from '@/pages/components/ConfigurationRowPage';
import { JobsPage } from '@/pages/jobs/JobsPage';
import { AllJobsPage } from '@/pages/jobs/AllJobsPage';
import { JobDetailPage } from '@/pages/jobs/JobDetailPage';
import { FlowsPage } from '@/pages/flows/FlowsPage';
import { TransformationsPage } from '@/pages/transformations/TransformationsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { EventsPage } from '@/pages/events/EventsPage';
import { SetupPage } from '@/pages/SetupPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Do not retry on 401 (expired/invalid token)
        if (error instanceof KeboolaApiError && error.status === 401) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: true,
    },
    mutations: {
      onError: (error) => {
        if (error instanceof KeboolaApiError && error.status === 401) {
          useConnectionStore.getState().disconnect();
          window.location.href = '/';
        }
      },
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ConnectPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/storage" element={<BucketsPage />} />
            <Route path="/storage/:bucketId" element={<BucketDetailPage />} />
            <Route path="/storage/:bucketId/:tableId" element={<TableDetailPage />} />
            <Route path="/components" element={<ComponentsPage />} />
            <Route path="/components/:componentId" element={<ConfigurationsPage />} />
            <Route path="/components/:componentId/:configId" element={<ConfigurationDetailPage />} />
            <Route path="/components/:componentId/:configId/rows/:rowId" element={<ConfigurationRowPage />} />
            <Route path="/flows" element={<FlowsPage />} />
            <Route path="/transformations" element={<TransformationsPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/all" element={<AllJobsPage />} />
            <Route path="/jobs/:jobId" element={<JobDetailPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
