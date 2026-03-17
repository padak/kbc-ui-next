// file: api/manage.ts
// Management API client for organization/project discovery.
// Used only during setup - management token is never persisted.
// Used by: SetupPage.tsx for adding organizations.
// Endpoints: /manage/organizations/{id}/projects, /manage/projects/{id}/tokens.

const MANAGE_TOKEN_HEADER = 'X-KBC-ManageApiToken';

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

export type { ManageProject, CreatedToken };

export const manageApi = {
  async listOrganizationProjects(
    stackUrl: string,
    manageToken: string,
    orgId: string,
  ): Promise<ManageProject[]> {
    const url = `${stackUrl}/manage/organizations/${orgId}/projects`;
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
  },

  async createProjectToken(
    stackUrl: string,
    manageToken: string,
    projectId: number,
    description: string,
  ): Promise<CreatedToken> {
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

  async getManageTokenInfo(
    stackUrl: string,
    manageToken: string,
  ): Promise<{ organizations: Array<{ id: number; name: string }> }> {
    const url = `${stackUrl}/manage/token-info`;
    const response = await fetch(url, {
      headers: { [MANAGE_TOKEN_HEADER]: manageToken },
    });
    if (!response.ok) {
      throw new Error(
        'Could not get token info. Please enter the Organization ID manually.',
      );
    }
    return response.json();
  },
};
