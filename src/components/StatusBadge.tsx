// file: components/StatusBadge.tsx
// Colored badge for job/configuration status display.
// Maps status strings to color variants (green, red, yellow, blue).
// Used by: JobsPage, DashboardPage, ConfigurationPage.
// Pure presentational component with no state or side effects.

type StatusBadgeProps = {
  status: string;
};

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  waiting: 'bg-gray-100 text-gray-600',
  created: 'bg-gray-100 text-gray-600',
  terminated: 'bg-red-100 text-red-700',
  terminating: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-100 text-gray-500',
  disabled: 'bg-gray-100 text-gray-400',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      {status}
    </span>
  );
}
