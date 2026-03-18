// file: config/credits.ts
// Keboola credit pricing per backend size and time unit.
// Source: https://help.keboola.com/management/project/limits/#project-power--time-credits
// Used by: JobsPage, JobDetailPage, DashboardPage for cost estimation.
// Update this file when Keboola changes pricing.

// Credits consumed per second of job runtime, by backend container size.
// 1 credit = 1 minute of "small" container time.
// Pricing from Keboola docs (as of 2026-03):
//
// | Size     | Credits/min | Credits/sec |
// |----------|-------------|-------------|
// | xsmall   | 0.5         | 0.00833     |
// | small    | 1           | 0.01667     |
// | medium   | 2           | 0.03333     |
// | large    | 4           | 0.06667     |
//
// Note: Keboola measures in "time credits" where 1 credit = 1 PPU minute.
// The actual pricing per credit depends on the customer contract.

export const CREDITS_PER_MINUTE: Record<string, number> = {
  xsmall: 0.5,
  small: 1,
  medium: 2,
  large: 4,
};

export const DEFAULT_SIZE = 'small';

// Calculate credits consumed by a job
export function calculateJobCredits(
  durationSeconds: number | null | undefined,
  containerSize: string | null | undefined,
): number {
  if (!durationSeconds || durationSeconds <= 0) return 0;
  const size = (containerSize ?? DEFAULT_SIZE).toLowerCase();
  const perMinute = CREDITS_PER_MINUTE[size] ?? CREDITS_PER_MINUTE[DEFAULT_SIZE]!;
  return (durationSeconds / 60) * perMinute;
}

// Format credits for display
export function formatCredits(credits: number): string {
  if (credits === 0) return '0';
  if (credits < 0.1) return credits.toFixed(3);
  if (credits < 10) return credits.toFixed(2);
  if (credits < 100) return credits.toFixed(1);
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
