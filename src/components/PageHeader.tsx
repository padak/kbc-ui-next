// file: components/PageHeader.tsx
// Reusable page header with breadcrumb navigation, title, and actions.
// Breadcrumbs show the navigation hierarchy (e.g., Components > Extractor > Config).
// Used by: every page component as the top section.
// Actions slot accepts buttons or other interactive elements.

import { Link } from 'react-router';
import type { ReactNode } from 'react';

export type BreadcrumbItem = {
  label: string;
  href: string;
};

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
};

export function PageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex items-center gap-1 text-sm text-gray-400">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-300">/</span>}
              <Link
                to={crumb.href}
                className="hover:text-gray-700 transition-colors truncate max-w-48"
                title={crumb.label}
              >
                {crumb.label}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-gray-900 md:text-2xl">{title}</h1>
          {description && <div className="mt-1">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
