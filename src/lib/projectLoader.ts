// file: lib/projectLoader.ts
// Loads project configurations from projects.secret.json, env vars, or single project env vars.
// Verifies each token and enriches with project/org metadata from the API.
// Used by: ConnectPage.tsx on startup, stores/connection.ts.
// Falls back to VITE_STACK_URL + VITE_STORAGE_TOKEN for single project.

import { fetchManageApi } from '@/api/client';
import { TokenVerifySchema } from '@/api/schemas';
import { loadProjectConfig } from '@/lib/projectConfig';
import type { ProjectEntry } from '@/stores/connection';

type RawProject = { stack: string; token: string };

export async function loadProjects(): Promise<ProjectEntry[]> {
  // 1. Try projects.secret.json
  const config = await loadProjectConfig();
  if (config.organizations.length > 0) {
    return config.organizations.flatMap((org) =>
      org.projects.map((p) => ({
        id: String(p.id),
        stackUrl: org.stack.replace(/\/+$/, ''),
        token: p.token,
        projectId: Number(p.id),
        projectName: p.name,
        organizationId: org.id,
        organizationName: org.name,
        tokenDescription: '',
      })),
    );
  }

  // 2. Fallback to env vars
  const rawProjects = getRawProjects();

  if (rawProjects.length === 0) {
    return [];
  }

  // Verify all tokens in parallel
  const entries = await Promise.allSettled(
    rawProjects.map(async (raw) => {
      const normalized = raw.stack.replace(/\/+$/, '');
      const tokenInfo = await fetchManageApi(
        normalized,
        '/tokens/verify',
        raw.token,
        TokenVerifySchema,
      );
      return {
        id: String(tokenInfo.owner.id),
        stackUrl: normalized,
        token: raw.token,
        projectId: tokenInfo.owner.id,
        projectName: tokenInfo.owner.name,
        organizationId: '',
        organizationName: '',
        tokenDescription: tokenInfo.description,
      } satisfies ProjectEntry;
    }),
  );

  const fulfilled = entries
    .filter((r): r is PromiseFulfilledResult<ProjectEntry> => r.status === 'fulfilled')
    .map((r) => r.value);

  // Log any failed verifications for debugging
  entries
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .forEach((r, i) => {
      console.error(`[ProjectLoader] Failed to verify project ${i}:`, r.reason);
    });

  return fulfilled;
}

function getRawProjects(): RawProject[] {
  // Try VITE_PROJECTS first (JSON array of {stack, token} objects)
  const projectsJson = import.meta.env.VITE_PROJECTS;
  if (projectsJson) {
    try {
      const parsed = JSON.parse(projectsJson) as RawProject[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      console.error('[ProjectLoader] Failed to parse VITE_PROJECTS env var');
    }
  }

  // Fallback to single project from individual env vars
  const stack = import.meta.env.VITE_STACK_URL;
  const token = import.meta.env.VITE_STORAGE_TOKEN;
  if (stack && token) {
    return [{ stack, token }];
  }

  return [];
}
