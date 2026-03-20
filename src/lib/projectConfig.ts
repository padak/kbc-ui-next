// file: lib/projectConfig.ts
// Loads and saves the projects.secret.json configuration file.
// Handles organization/project hierarchy with CRUD operations.
// Used by: projectLoader.ts, SetupPage.tsx.
// In dev mode, saves via Vite middleware. JSON served from public/.

type StandaloneProjectConfig = {
  id: string;
  name: string;
  stack: string;
  token: string;
};

type ProjectConfig = {
  organizations: OrgConfig[];
  standaloneProjects?: StandaloneProjectConfig[];
};

type OrgConfig = {
  id: string;
  name: string;
  stack: string;
  projects: OrgProjectConfig[];
};

type OrgProjectConfig = {
  id: string;
  name: string;
  token: string;
};

export type { ProjectConfig, OrgConfig, OrgProjectConfig, StandaloneProjectConfig };

export async function loadProjectConfig(): Promise<ProjectConfig> {
  // Try loading from the file (served by Vite in dev)
  try {
    const response = await fetch('/projects.secret.json');
    if (response.ok) {
      return (await response.json()) as ProjectConfig;
    }
  } catch {
    // File doesn't exist or not served
  }
  return { organizations: [] };
}

export async function saveProjectConfig(config: ProjectConfig): Promise<void> {
  const response = await fetch('/__save-projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    throw new Error('Failed to save projects configuration');
  }
}

export async function addStandaloneProject(project: StandaloneProjectConfig): Promise<void> {
  const config = await loadProjectConfig();
  const existing = config.standaloneProjects ?? [];
  const normalizedStack = project.stack.replace(/\/+$/, '');
  // Deduplicate by id+stack — update token if already exists
  const filtered = existing.filter(
    (p) => !(p.id === project.id && p.stack.replace(/\/+$/, '') === normalizedStack),
  );
  filtered.push({ ...project, stack: normalizedStack });
  await saveProjectConfig({ ...config, standaloneProjects: filtered });
}

export async function removeStandaloneProject(projectId: string, stack: string): Promise<void> {
  const config = await loadProjectConfig();
  const existing = config.standaloneProjects ?? [];
  const normalizedStack = stack.replace(/\/+$/, '');
  const filtered = existing.filter(
    (p) => !(p.id === projectId && p.stack.replace(/\/+$/, '') === normalizedStack),
  );
  await saveProjectConfig({ ...config, standaloneProjects: filtered });
}
