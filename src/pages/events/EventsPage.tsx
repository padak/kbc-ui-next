// file: pages/events/EventsPage.tsx
// Global events log: all storage events across the project.
// Terminal-style viewer with search, type filters, copy/download.
// Used by: App.tsx route /events.
// Data from: hooks/useEvents.ts (useEvents) with 10s polling.

import { PageHeader } from '@/components/PageHeader';
import { EventsViewer } from '@/components/EventsViewer';
import { useEvents } from '@/hooks/useEvents';

export function EventsPage() {
  const { data: events, isLoading, error } = useEvents({ limit: 200 });

  return (
    <div>
      <PageHeader
        title="Events"
        description="Storage event log — live updates every 10 seconds"
      />

      <EventsViewer
        events={events ?? []}
        isLoading={isLoading}
        error={error instanceof Error ? error : null}
        title="All Events"
        maxHeight="calc(100vh - 200px)"
        emptyMessage="No events in this project."
      />
    </div>
  );
}
