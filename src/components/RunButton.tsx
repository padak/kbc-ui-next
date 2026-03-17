// file: components/RunButton.tsx
// Run Component button with loading state and success feedback.
// Triggers a job via Queue API and shows the new job ID.
// Used by: ConfigurationDetailPage, FlowsPage.
// Navigates to job detail on success.

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useRunJob } from '@/hooks/useMutations';

type RunButtonProps = {
  componentId: string;
  configId: string;
  label?: string;
};

export function RunButton({ componentId, configId, label = 'Run' }: RunButtonProps) {
  const navigate = useNavigate();
  const runJob = useRunJob();
  const [lastJobId, setLastJobId] = useState<string | null>(null);

  async function handleRun() {
    try {
      const job = await runJob.mutateAsync({ component: componentId, config: configId });
      setLastJobId(job.id);
      // Navigate to job detail after short delay so user sees the success state
      setTimeout(() => navigate(`/jobs/${job.id}`), 1500);
    } catch {
      // Error handled by mutation state
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRun}
        disabled={runJob.isPending}
        className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:bg-green-400"
      >
        {runJob.isPending ? 'Starting...' : label}
      </button>
      {lastJobId && !runJob.isPending && (
        <span className="text-xs text-green-600">Job {lastJobId} started</span>
      )}
      {runJob.error && (
        <span className="text-xs text-red-600">
          {runJob.error instanceof Error ? runJob.error.message : 'Failed to start job'}
        </span>
      )}
    </div>
  );
}
