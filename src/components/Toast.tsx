// file: components/Toast.tsx
// Toast notification container rendered at bottom-left of viewport.
// Renders stacked toasts from useToastStore with icons and close buttons.
// Used by: AppLayout.tsx (always mounted, renders nothing when queue empty).
// Visual polish enhanced when Keboola design system is active.

import { useToastStore, type ToastType } from '@/stores/toast';

const ICONS: Record<ToastType, string> = {
  success: '\u2713',
  error: '\u2717',
  warning: '\u26A0',
  info: '\u2139',
};

const STYLES: Record<ToastType, string> = {
  success: 'border-green-300 bg-green-50 text-green-800',
  error: 'border-red-300 bg-red-50 text-red-800',
  warning: 'border-orange-300 bg-orange-50 text-orange-800',
  info: 'border-blue-300 bg-blue-50 text-blue-800',
};

const ICON_STYLES: Record<ToastType, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-orange-500',
  info: 'text-blue-500',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="kbc-toast-container fixed bottom-4 left-4 z-50 flex flex-col-reverse gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`kbc-toast kbc-toast-${toast.type} flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${STYLES[toast.type]}`}
          role="alert"
        >
          <span className={`text-lg leading-none ${ICON_STYLES[toast.type]}`}>
            {ICONS[toast.type]}
          </span>
          <p className="min-w-0 flex-1 text-sm font-medium">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 shrink-0 text-current opacity-50 hover:opacity-100"
            aria-label="Dismiss"
          >
            &#10005;
          </button>
        </div>
      ))}
    </div>
  );
}
