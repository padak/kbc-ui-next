// file: components/PageHeader.tsx
// Reusable page header with title, optional description, and actions.
// Responsive: stacks vertically on small screens.
// Used by: every page component as the top section.
// Actions slot accepts buttons or other interactive elements.

import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold text-gray-900 md:text-2xl">{title}</h1>
        {description && <p className="mt-1 truncate text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
