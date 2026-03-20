// file: src/config/events.ts
// Pagination and polling constants for event streams.
// Centralizes magic numbers for event fetching across the app.
// Used by: hooks/useEvents.ts, pages/jobs/JobDetailPage.tsx.
// All event-related constants live here — never hardcode elsewhere.

export const EVENTS_PAGE_SIZE = 200;
export const EVENTS_POLL_INTERVAL_JOB = 5_000;
export const EVENTS_POLL_INTERVAL_GLOBAL = 10_000;
export const EVENTS_JUMP_TO_START_DELAY = 100;
