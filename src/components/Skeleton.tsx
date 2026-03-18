// file: components/Skeleton.tsx
// Placeholder shimmer components for async loading states.
// Supports line, circle, rect variants plus pre-composed patterns.
// Used by: any page/component during data loading (replaces hourglass spinners).
// Shimmer gradient enhanced when Keboola design system is active.

type SkeletonProps = {
  variant?: 'line' | 'circle' | 'rect';
  width?: string | number;
  height?: string | number;
  className?: string;
};

export function Skeleton({ variant = 'line', width, height, className = '' }: SkeletonProps) {
  const style: React.CSSProperties = {};

  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  const variantClass = {
    line: 'kbc-skeleton animate-pulse bg-gray-200 rounded h-4',
    circle: 'kbc-skeleton animate-pulse bg-gray-200 rounded-full',
    rect: 'kbc-skeleton animate-pulse bg-gray-200 rounded-lg',
  }[variant];

  if (!width) {
    if (variant === 'line') style.width = '100%';
    if (variant === 'circle') style.width = style.height ?? '40px';
    if (variant === 'rect') style.width = '100%';
  }
  if (!height) {
    if (variant === 'circle') style.height = style.width ?? '40px';
    if (variant === 'rect') style.height = '120px';
  }

  return <div className={`${variantClass} ${className}`} style={style} />;
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="kbc-skeleton-table space-y-3">
      <div className="flex gap-4">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} variant="line" height={12} width={`${100 / cols}%`} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} variant="line" height={16} width={`${100 / cols}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="kbc-skeleton-card space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <Skeleton variant="line" width="60%" height={20} />
      <Skeleton variant="line" width="80%" />
      <Skeleton variant="line" width="40%" />
    </div>
  );
}
