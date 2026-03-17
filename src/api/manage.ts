// file: api/manage.ts
// Management API client for organization/project discovery.
// Flow: maintainers -> organizations -> projects -> create tokens.
// Used by: SetupPage.tsx for adding organizations.
// Management token is never persisted to disk.

const MANAGE_TOKEN_HEADER = 'X-KBC-ManageApiToken';

type Maintainer = {
  id: number;
  name: string;
};

type ManagedOrganization = {
  id: number;
  name: string;
};

type ManageProject = {
  id: number;
  name: string;
  region: string;
  isDisabled: boolean;
};

type CreatedToken = {
  id: string;
  token: string;
  description: string;
};

export type { Maintainer, ManagedOrganization, ManageProject, CreatedToken };

async function manageGet<T>(stackUrl: string, manageToken: string, path: string): Promise<T> {
  const url = `${stackUrl}/manage/${path}`;
  const response = await fetch(url, {
    headers: { [MANAGE_TOKEN_HEADER]: manageToken },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as Record<string, string>).message ?? `Management API error: ${response.status}`,
    );
  }
  return response.json();
}

export const manageApi = {
  // Step 1: List maintainers the token has access to
  listMaintainers(stackUrl: string, manageToken: string) {
    return manageGet<Maintainer[]>(stackUrl, manageToken, 'maintainers');
  },

  // Step 2: List organizations under a maintainer
  listMaintainerOrganizations(stackUrl: string, manageToken: string, maintainerId: number) {
    return manageGet<ManagedOrganization[]>(stackUrl, manageToken, `maintainers/${maintainerId}/organizations`);
  },

  // Alternative: List orgs the token has direct access to (fewer results)
  listOrganizations(stackUrl: string, manageToken: string) {
    return manageGet<ManagedOrganization[]>(stackUrl, manageToken, 'organizations');
  },

  // Step 3: List projects in an organization
  listOrganizationProjects(stackUrl: string, manageToken: string, orgId: string) {
    return manageGet<ManageProject[]>(stackUrl, manageToken, `organizations/${orgId}/projects`);
  },

  // Step 4: Create a Storage API token in a project
  async createProjectToken(stackUrl: string, manageToken: string, projectId: number, description: string): Promise<CreatedToken> {
    const url = `${stackUrl}/manage/projects/${projectId}/tokens`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        [MANAGE_TOKEN_HEADER]: manageToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description,
        canManageBuckets: true,
        canReadAllFileUploads: true,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        (body as Record<string, string>).message ?? `Failed to create token: ${response.status}`,
      );
    }
    return response.json();
  },
};
