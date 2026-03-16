// file: lib/formatters.ts
// Formatting utilities for dates, numbers, and byte sizes.
// Pure functions with no side effects or dependencies.
// Used by: pages and components that display formatted data.
// Keep this file small - add formatters only when needed.

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const RELATIVE_FORMAT = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return RELATIVE_FORMAT.format(-seconds, 'second');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return RELATIVE_FORMAT.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return RELATIVE_FORMAT.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  return RELATIVE_FORMAT.format(-days, 'day');
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}
