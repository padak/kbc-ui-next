// file: config/credits.ts
// Keboola credit pricing per job type, backend size, and time unit.
// Source: https://help.keboola.com/management/project/limits/#project-power--time-credits
// Used by: JobsPage, JobDetailPage, DashboardPage for cost estimation.
// Update this file when Keboola changes pricing.

// Credits per HOUR by job type and container size.
// Source: Keboola pricing table (as of 2026-03)
//
// | Type                        | Base    | Size    | Credits/hr |
// |-----------------------------|---------|---------|------------|
// | Data source job             | 1 hour  |         | 2          |
// | Data destination job        | 1 GB out|         | 0.2        |
// | SQL job / workspace         | 1 hour  | Small   | 6          |
// | SQL job / workspace         | 1 hour  | Medium  | 12         |
// | SQL job / workspace         | 1 hour  | Large   | 26         |
// | Data Science job/workspace  | 1 hour  | XSmall  | 0.2        |
// | Data Science job/workspace  | 1 hour  | Small   | 0.4        |
// | Data Science job/workspace  | 1 hour  | Medium  | 0.6        |
// | Data Science job/workspace  | 1 hour  | Large   | 2          |
// | dbt job                     | 1 hour  | Small   | 6          |
// | dbt job                     | 1 hour  | Remote  | 2          |
// | DWH Direct query            | 1 hour  | Small   | 8          |
// | DWH Direct query            | 1 hour  | Medium  | 16         |
// | DWH Direct query            | 1 hour  | Large   | 32         |
// | AppStore Apps               | 1 hour  |         | 1          |
// | DataApps                    | 1 hour  | XSmall  | 0.1        |
// | DataApps                    | 1 hour  | Small   | 0.2        |
// | DataApps                    | 1 hour  | Medium  | 0.5        |
// | DataApps                    | 1 hour  | Large   | 1          |

type CreditRate = Record<string, number>; // containerSize -> credits per hour

// Component type patterns -> credit rates
const RATES: { match: (componentId: string) => boolean; rates: CreditRate }[] = [
  // SQL transformations (Snowflake, Redshift)
  {
    match: (id) => id.includes('snowflake-transformation') || id.includes('redshift-transformation'),
    rates: { xsmall: 6, small: 6, medium: 12, large: 26 },
  },
  // Python/R transformations (Data Science)
  {
    match: (id) => id.includes('python-transformation') || id.includes('r-transformation'),
    rates: { xsmall: 0.2, small: 0.4, medium: 0.6, large: 2 },
  },
  // dbt
  {
    match: (id) => id.includes('dbt'),
    rates: { small: 6, remote: 2 },
  },
  // Writers (data destination) - charged per GB, approximate as time-based
  {
    match: (id) => id.startsWith('keboola.wr-') || id.includes('.wr-'),
    rates: { xsmall: 1, small: 1, medium: 1, large: 1 },
  },
  // Extractors (data source)
  {
    match: (id) => id.startsWith('keboola.ex-') || id.includes('.ex-') || id.includes('extractor'),
    rates: { xsmall: 2, small: 2, medium: 2, large: 2 },
  },
  // Sandboxes/workspaces
  {
    match: (id) => id.includes('sandbox'),
    rates: { xsmall: 0.2, small: 6, medium: 12, large: 26 },
  },
  // DataApps
  {
    match: (id) => id.includes('data-app') || id.includes('streamlit'),
    rates: { xsmall: 0.1, small: 0.2, medium: 0.5, large: 1 },
  },
  // Orchestrator/Flow - no direct credits (child jobs are charged)
  {
    match: (id) => id.includes('orchestrator') || id === 'keboola.flow',
    rates: { xsmall: 0, small: 0, medium: 0, large: 0 },
  },
];

// Default: AppStore Apps rate (1 credit/hour)
const DEFAULT_RATE: CreditRate = { xsmall: 1, small: 1, medium: 1, large: 1 };

export const DEFAULT_SIZE = 'small';

function getRateForComponent(componentId: string): CreditRate {
  for (const entry of RATES) {
    if (entry.match(componentId)) return entry.rates;
  }
  return DEFAULT_RATE;
}

// Calculate credits consumed by a job
export function calculateJobCredits(
  durationSeconds: number | null | undefined,
  containerSize: string | null | undefined,
  componentId?: string,
): number {
  if (!durationSeconds || durationSeconds <= 0) return 0;
  const size = (containerSize ?? DEFAULT_SIZE).toLowerCase();
  const rates = componentId ? getRateForComponent(componentId) : DEFAULT_RATE;
  const creditsPerHour = rates[size] ?? rates[DEFAULT_SIZE] ?? 1;
  return (durationSeconds / 3600) * creditsPerHour;
}

// Format credits for display
export function formatCredits(credits: number): string {
  if (credits === 0) return '0';
  if (credits < 0.01) return '<0.01';
  if (credits < 1) return credits.toFixed(2);
  if (credits < 10) return credits.toFixed(1);
  return Math.round(credits).toLocaleString();
}

// Extract container size from job metrics
export function getContainerSize(metrics: unknown): string {
  if (!metrics || typeof metrics !== 'object') return DEFAULT_SIZE;
  const m = metrics as Record<string, unknown>;
  const backend = m.backend;
  if (!backend || typeof backend !== 'object') return DEFAULT_SIZE;
  const b = backend as Record<string, unknown>;
  return (b.containerSize as string) ?? (b.size as string) ?? DEFAULT_SIZE;
}
