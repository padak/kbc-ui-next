// file: pages/transformations/TransformationsPage.tsx
// Transformations listing: all transformation configs with folder grouping.
// Shows configs across all transformation components (Snowflake SQL, Python, etc.).
// Used by: App.tsx route /transformations.
// Data from: useTransformations hook (aggregates configs + folders + jobs).

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { useConnectionStore } from '@/stores/connection';
import { useComponentsByType } from '@/hooks/useComponents';
import { componentsApi } from '@/api/components';
import { storageApi } from '@/api/storage';
import { jobsApi } from '@/api/jobs';
import { formatDate, formatRelativeTime } from '@/lib/formatters';
import type { Configuration, Component, Job } from '@/api/schemas';

type TransformationItem = {
  config: Configuration;
  component: Component;
  folder: string | null;
  lastJob: Job | null;
};

function useTransformations() {
  const { isConnected, activeProjectId } = useConnectionStore();
  const { data: components } = useComponentsByType('transformation');

  return useQuery({
    queryKey: [activeProjectId, 'transformations', 'aggregated'],
    queryFn: async () => {
      if (!components?.length) return [];

      // Fetch configs, folders, and jobs in parallel
      const [configsByComponent, allFolderData, recentJobs] = await Promise.all([
        // Configs for each transformation component
        Promise.all(
          components.map(async (comp) => ({
            component: comp,
            configs: await componentsApi.listConfigurations(comp.id).catch(() => []),
          })),
        ),
        // Folder metadata for all transformation components
        Promise.all(
          components.map((comp) => storageApi.listConfigFolders(comp.id).catch(() => [])),
        ).then((results) => results.flat()),
        // Recent jobs
        jobsApi.listJobs({ limit: 200 }).catch(() => []),
      ]);

      // Build folder map
      const folderMap = new Map<string, string>();
      for (const item of allFolderData) {
        const meta = item.metadata.find((m) => m.key === 'KBC.configuration.folderName');
        if (meta) folderMap.set(item.configurationId, meta.value);
      }

      // Build last job map
      const jobMap = new Map<string, Job>();
      for (const job of recentJobs) {
        const key = `${job.component}:${job.config}`;
        if (!jobMap.has(key)) jobMap.set(key, job);
      }

      // Merge
      const items: TransformationItem[] = [];
      for (const { component, configs } of configsByComponent) {
        for (const config of configs) {
          items.push({
            config,
            component,
            folder: folderMap.get(config.id) ?? null,
            lastJob: jobMap.get(`${component.id}:${config.id}`) ?? null,
          });
        }
      }

      items.sort((a, b) => b.config.currentVersion.created.localeCompare(a.config.currentVersion.created));
      return items;
    },
    enabled: isConnected && !!components?.length,
  });
}

function groupByFolder(items: TransformationItem[]): { folder: string; items: TransformationItem[] }[] {
  const groups = new Map<string, TransformationItem[]>();
  for (const item of items) {
    const key = item.folder ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  const result: { folder: string; items: TransformationItem[] }[] = [];
  const sortedKeys = [...groups.keys()].filter((k) => k !== '').sort();
  for (const key of sortedKeys) {
    result.push({ folder: key, items: groups.get(key)! });
  }
  const unfiled = groups.get('');
  if (unfiled) result.push({ folder: '', items: unfiled });
  return result;
}

export function TransformationsPage() {
  const navigate = useNavigate();
  const { data: items, isLoading } = useTransformations();
  const [search, setSearch] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!items) return [];
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (t) =>
        t.config.name.toLowerCase().includes(q) ||
        t.config.description.toLowerCase().includes(q) ||
        t.component.name.toLowerCase().includes(q),
    );
  }, [items, search]);

  const grouped = groupByFolder(filtered);
  const hasFolders = grouped.some((g) => g.folder !== '');

  function toggleFolder(folder: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  }

  function renderTable(rows: TransformationItem[]) {
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Last Change</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Last Run</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {rows.map((t) => (
              <tr
                key={`${t.component.id}:${t.config.id}`}
                onClick={() => navigate(`/components/${encodeURIComponent(t.component.id)}/${t.config.id}`)}
                className="cursor-pointer hover:bg-gray-50"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {t.component.ico32 && <img src={t.component.ico32} alt="" className="h-5 w-5 rounded" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{t.config.name}</p>
                      {t.config.description && (
                        <p className="truncate text-xs text-gray-400 max-w-xs">{t.config.description}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{t.component.name}</td>
                <td className="px-4 py-3">
                  <p className="text-sm text-gray-600">{formatDate(t.config.currentVersion.created)}</p>
                  <p className="text-xs text-gray-400">{t.config.currentVersion.creatorToken.description}</p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {t.lastJob ? formatRelativeTime(t.lastJob.createdTime) : <span className="text-gray-400">No run yet</span>}
                </td>
                <td className="px-4 py-3">
                  {t.lastJob ? <StatusBadge status={t.lastJob.status} /> : <span className="text-xs text-gray-400">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Transformations"
        description={`${items?.length ?? 0} transformations`}
      />

      <input
        type="text"
        placeholder="Search transformations..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading transformations...</div>
      ) : (
        grouped.map((group) => (
          <div key={group.folder || '__unfiled'} className="mb-3">
            {group.folder ? (
              <button
                onClick={() => toggleFolder(group.folder)}
                className="mb-1 flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-left hover:bg-gray-50"
              >
                <span className="text-xs text-gray-400">{expandedFolders.has(group.folder) ? '\u25BC' : '\u25B6'}</span>
                <span className="text-sm font-medium text-gray-800">{group.folder}</span>
                <span className="text-xs text-gray-400">({group.items.length})</span>
              </button>
            ) : (
              hasFolders && (
                <p className="mb-2 mt-4 rounded bg-gray-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Transformations without folder
                </p>
              )
            )}
            {(!group.folder || expandedFolders.has(group.folder)) && renderTable(group.items)}
          </div>
        ))
      )}

      {!isLoading && !items?.length && (
        <p className="py-8 text-center text-sm text-gray-400">No transformations found</p>
      )}
    </div>
  );
}
