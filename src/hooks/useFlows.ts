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
import type { Configuration, Schedule, Job } from '@/api/schemas';

export type FlowItem = {
  config: Configuration;
  componentId: string;
  schedule: Schedule | null;
  lastJob: Job | null;
};

export function useFlows() {
  const isConnected = useConnectionStore((s) => s.isConnected);

  return useQuery({
    queryKey: ['flows', 'aggregated'],
    queryFn: async () => {
      // Fetch all data sources in parallel
      const [orchestratorConfigs, flowConfigs, schedules, recentJobs] = await Promise.all([
        componentsApi.listConfigurations('keboola.orchestrator').catch(() => [] as Configuration[]),
        componentsApi.listConfigurations('keboola.flow').catch(() => [] as Configuration[]),
        schedulerApi.listSchedules().catch(() => [] as Schedule[]),
        jobsApi.listJobs({ limit: 200 }).catch(() => [] as Job[]),
      ]);

      // Build schedule lookup: configId -> Schedule
      const scheduleMap = new Map<string, Schedule>();
      for (const s of schedules) {
        scheduleMap.set(s.target.configurationId, s);
      }

      // Build last job lookup: componentId:configId -> Job
      const jobMap = new Map<string, Job>();
      for (const j of recentJobs) {
        const key = `${j.component}:${j.config}`;
        if (!jobMap.has(key)) {
          jobMap.set(key, j); // first = most recent
        }
      }

      // Merge into FlowItems
      const items: FlowItem[] = [];

      for (const config of orchestratorConfigs) {
        items.push({
          config,
          componentId: 'keboola.orchestrator',
          schedule: scheduleMap.get(config.id) ?? null,
          lastJob: jobMap.get(`keboola.orchestrator:${config.id}`) ?? null,
        });
      }

      for (const config of flowConfigs) {
        items.push({
          config,
          componentId: 'keboola.flow',
          schedule: scheduleMap.get(config.id) ?? null,
          lastJob: jobMap.get(`keboola.flow:${config.id}`) ?? null,
        });
      }

      // Sort by last change descending
      items.sort((a, b) => b.config.currentVersion.created.localeCompare(a.config.currentVersion.created));

      return items;
    },
    enabled: isConnected,
  });
}
