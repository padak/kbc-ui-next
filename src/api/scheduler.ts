// file: api/scheduler.ts
// Scheduler API: fetch schedules for flow/orchestrator configs.
// Returns crontab expressions and enabled/disabled state per config.
// Used by: hooks/useFlows.ts for schedule display in Flows page.
// Scheduler URL derived from stack URL (connection.* -> scheduler.*).

import { z } from 'zod';
import { fetchServiceApi } from './client';
import { ScheduleSchema } from './schemas';

export const schedulerApi = {
  listSchedules() {
    return fetchServiceApi('scheduler', '/schedules', z.array(ScheduleSchema));
  },
};
