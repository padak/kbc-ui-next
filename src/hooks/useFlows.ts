// file: hooks/useFlows.ts
// Aggregates flow data from multiple sources: configs, schedules, jobs.
// Merges orchestrator + flow component configs with schedule and last run info.
// Used by: pages/flows/FlowsPage.tsx.
// Combines: useConfigurations, schedulerApi, useJobs.

import { useQuery } from '@tanstack/react-query';
import { useConnectionStore } from '@/stores/connection';
import { componentsApi } from '@/api/components';
import { schedulerApi } from '@/api/scheduler';
import { jobsApi } from '@/api/jobs';
import { storageApi } from '@/api/storage';
import type { Configuration, Schedule, Job } from '@/api/schemas';

export type FlowItem = {
  config: Configuration;
  componentId: string;
  schedule: Schedule | null;
  lastJob: Job | null;
  folder: string | null;
};

export function useFlows() {
  const { isConnected, activeProjectId } = useConnectionStore();

  return useQuery({
    queryKey: [activeProjectId, 'flows', 'aggregated'],
    queryFn: async () => {
      // Fetch all data sources in parallel
      // Step 1: Fetch configs, schedules, and folders in parallel
      const [orchestratorConfigs, flowConfigs, schedules, orchestratorFolders, flowFolders] = await Promise.all([
        componentsApi.listConfigurations('keboola.orchestrator').catch(() => [] as Configuration[]),
        componentsApi.listConfigurations('keboola.flow').catch(() => [] as Configuration[]),
        schedulerApi.listSchedules().catch(() => [] as Schedule[]),
        storageApi.listConfigFolders('keboola.orchestrator').catch(() => []),
        storageApi.listConfigFolders('keboola.flow').catch(() => []),
      ]);

      // Step 2: Fetch last job per config via grouped-jobs API
      const allConfigIds = [...orchestratorConfigs, ...flowConfigs].map((c) => c.id);
      const latestJobs = await jobsApi.getLatestJobsPerConfig(
        ['keboola.orchestrator', 'keboola.flow'],
        allConfigIds,
      ).catch(() => ({} as Record<string, Job>));

      // Build folder lookup: configId -> folderName
      const folderMap = new Map<string, string>();
      for (const item of [...orchestratorFolders, ...flowFolders]) {
        const folderMeta = item.metadata.find(m => m.key === 'KBC.configuration.folderName');
        if (folderMeta) {
          folderMap.set(item.configurationId, folderMeta.value);
        }
      }

      // Build schedule lookup: configId -> Schedule
      const scheduleMap = new Map<string, Schedule>();
      for (const s of schedules) {
        scheduleMap.set(s.target.configurationId, s);
      }

      // Merge into FlowItems
      const items: FlowItem[] = [];

      for (const config of orchestratorConfigs) {
        items.push({
          config,
          componentId: 'keboola.orchestrator',
          schedule: scheduleMap.get(config.id) ?? null,
          lastJob: latestJobs[config.id] ?? null,
          folder: folderMap.get(config.id) ?? null,
        });
      }

      for (const config of flowConfigs) {
        items.push({
          config,
          componentId: 'keboola.flow',
          schedule: scheduleMap.get(config.id) ?? null,
          lastJob: latestJobs[config.id] ?? null,
          folder: folderMap.get(config.id) ?? null,
        });
      }

      // Sort by last change descending
      items.sort((a, b) => b.config.currentVersion.created.localeCompare(a.config.currentVersion.created));

      return items;
    },
    enabled: isConnected,
  });
}
