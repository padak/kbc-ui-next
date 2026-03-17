// file: pages/SetupPage.tsx
// Organization management: add/edit/remove organizations and their projects.
// Uses Management API token (never persisted) to discover and register projects.
// Used by: App.tsx route /setup, linked from ConnectPage.
// Saves configuration to projects.secret.json via Vite middleware.

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { useConnectionStore } from '@/stores/connection';
import type { ProjectEntry } from '@/stores/connection';
import {
  loadProjectConfig,
  saveProjectConfig,
  type ProjectConfig,
  type OrgConfig,
} from '@/lib/projectConfig';
import { manageApi, type ManageProject } from '@/api/manage';
import { StackUrlPicker } from '@/components/StackUrlPicker';

export function SetupPage() {
  const navigate = useNavigate();
  const { setProjects } = useConnectionStore();
  const [config, setConfig] = useState<ProjectConfig>({ organizations: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadProjectConfig().then((c) => {
      setConfig(c);
      setIsLoading(false);
    });
  }, []);

  async function handleSave(updatedConfig: ProjectConfig, autoConnect = false) {
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await saveProjectConfig(updatedConfig);
      setConfig(updatedConfig);
      setSaveSuccess(true);

      if (autoConnect && updatedConfig.organizations.length > 0) {
        // Load projects into connection store and go to dashboard
        const entries: ProjectEntry[] = updatedConfig.organizations.flatMap((org) =>
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
        if (entries.length > 0) {
          sessionStorage.removeItem('kbc_disconnected');
          setProjects(entries);
          navigate('/dashboard');
          return;
        }
      }

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save configuration');
    }
  }

  async function handleAddOrg(org: OrgConfig) {
    const updated = { organizations: [...config.organizations, org] };
    await handleSave(updated, true);
    setShowAddOrg(false);
  }

  async function handleUpdateOrg(orgId: string, updatedOrg: OrgConfig) {
    const updated = {
      organizations: config.organizations.map((o) => (o.id === orgId ? updatedOrg : o)),
    };
    await handleSave(updated);
  }

  const [removeOrgId, setRemoveOrgId] = useState<string | null>(null);
  const [removeManageToken, setRemoveManageToken] = useState('');
  const [removeAlsoFromKeboola, setRemoveAlsoFromKeboola] = useState(false);
  const [removeProgress, setRemoveProgress] = useState('');
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function handleRemoveOrg() {
    if (!removeOrgId) return;
    const org = config.organizations.find((o) => o.id === removeOrgId);
    if (!org) return;

    setRemoveError(null);

    // Delete tokens from Keboola if requested
    if (removeAlsoFromKeboola && removeManageToken) {
      for (const project of org.projects) {
        try {
          setRemoveProgress(`Deleting token for ${project.name}...`);
          const tokenId = await manageApi.getTokenId(org.stack, project.token);
          await manageApi.deleteToken(org.stack, removeManageToken, tokenId);
        } catch (err) {
          // Continue on error - token might already be deleted or expired
          console.warn(`Failed to delete token for ${project.name}:`, err);
        }
      }
      setRemoveProgress('');
    }

    // Remove locally
    const updated = {
      organizations: config.organizations.filter((o) => o.id !== removeOrgId),
    };
    await handleSave(updated);
    setRemoveOrgId(null);
    setRemoveManageToken('');
    setRemoveAlsoFromKeboola(false);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="mb-4 text-4xl text-gray-300">&#8987;</div>
          <h1 className="text-xl font-semibold text-gray-700">Loading configuration...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Organization Setup"
          description="Manage your Keboola organizations and projects"
        />

        {saveError && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{saveError}</div>
        )}
        {saveSuccess && (
          <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
            Configuration saved successfully.
          </div>
        )}

        {/* Existing organizations */}
        {config.organizations.map((org) => (
          <OrgCard
            key={org.id}
            org={org}
            onUpdate={(updatedOrg) => handleUpdateOrg(org.id, updatedOrg)}
            onRemove={() => setRemoveOrgId(org.id)}
          />
        ))}

        {config.organizations.length === 0 && !showAddOrg && (
          <div className="mb-6 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-sm text-gray-500">
              No organizations configured yet. Add one to get started.
            </p>
          </div>
        )}

        {/* Add organization */}
        {!showAddOrg && (
          <button
            onClick={() => setShowAddOrg(true)}
            className="mb-6 w-full rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            + Add Organization
          </button>
        )}
        {showAddOrg && (
          <AddOrgForm
            existingOrgIds={config.organizations.map((o) => o.id)}
            onAdd={handleAddOrg}
            onCancel={() => setShowAddOrg(false)}
          />
        )}

        {/* Link back */}
        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-blue-600 hover:underline">
            Back to Connect
          </Link>
        </div>

        {/* Remove organization dialog */}
        {removeOrgId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRemoveOrgId(null)}>
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Remove Organization</h3>
              <p className="mb-4 text-sm text-gray-600">
                This will remove the organization and all its project tokens from your local configuration.
              </p>

              <label className="mb-4 flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={removeAlsoFromKeboola}
                  onChange={(e) => setRemoveAlsoFromKeboola(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">
                  Also delete the created tokens from Keboola (requires Management Token)
                </span>
              </label>

              {removeAlsoFromKeboola && (
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Management API Token</label>
                  <input
                    type="password"
                    value={removeManageToken}
                    onChange={(e) => setRemoveManageToken(e.target.value)}
                    placeholder="Required to delete tokens from Keboola"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {removeProgress && (
                <div className="mb-3 rounded-md bg-blue-50 p-2 text-xs text-blue-700">{removeProgress}</div>
              )}
              {removeError && (
                <div className="mb-3 rounded-md bg-red-50 p-2 text-xs text-red-700">{removeError}</div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setRemoveOrgId(null); setRemoveManageToken(''); setRemoveAlsoFromKeboola(false); }}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveOrg}
                  disabled={removeAlsoFromKeboola && !removeManageToken}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-red-400"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -- OrgCard component --

type OrgCardProps = {
  org: OrgConfig;
  onUpdate: (updatedOrg: OrgConfig) => void;
  onRemove: () => void;
};

function OrgCard({ org, onUpdate, onRemove }: OrgCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="text-gray-400">{expanded ? '\u25BC' : '\u25B6'}</span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-gray-900">{org.name}</h3>
            <p className="truncate text-xs text-gray-400">
              {org.stack} &middot; {org.projects.length} project
              {org.projects.length !== 1 ? 's' : ''} &middot; ID: {org.id}
            </p>
          </div>
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUpdate(!showUpdate)}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            Update
          </button>
          {!confirmRemove ? (
            <button
              onClick={() => setConfirmRemove(true)}
              className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              Remove
            </button>
          ) : (
            <div className="flex gap-1">
              <button
                onClick={() => {
                  onRemove();
                  setConfirmRemove(false);
                }}
                className="rounded-md bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400">
                <th className="pb-1 font-medium">Project ID</th>
                <th className="pb-1 font-medium">Name</th>
                <th className="pb-1 font-medium">Token</th>
              </tr>
            </thead>
            <tbody>
              {org.projects.map((p) => (
                <tr key={p.id} className="border-t border-gray-50">
                  <td className="py-1 font-mono text-gray-600">{p.id}</td>
                  <td className="py-1 text-gray-900">{p.name}</td>
                  <td className="py-1 font-mono text-gray-400">
                    {p.token.substring(0, 8)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showUpdate && (
        <div className="border-t border-gray-100 px-4 py-3">
          <UpdateOrgForm
            org={org}
            onUpdate={(updatedOrg) => {
              onUpdate(updatedOrg);
              setShowUpdate(false);
            }}
            onCancel={() => setShowUpdate(false)}
          />
        </div>
      )}
    </div>
  );
}

// -- UpdateOrgForm component --

type UpdateOrgFormProps = {
  org: OrgConfig;
  onUpdate: (updatedOrg: OrgConfig) => void;
  onCancel: () => void;
};

function UpdateOrgForm({ org, onUpdate, onCancel }: UpdateOrgFormProps) {
  const [manageToken, setManageToken] = useState('');
  const [projects, setProjects] = useState<ManageProject[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const existingProjectIds = new Set(org.projects.map((p) => p.id));

  async function handleDiscover() {
    setError(null);
    setIsDiscovering(true);
    try {
      const allProjects = await manageApi.listOrganizationProjects(
        org.stack,
        manageToken,
        org.id,
      );
      // Only show projects not already registered
      const newProjects = allProjects.filter((p) => !existingProjectIds.has(String(p.id)));
      setProjects(newProjects);
      setSelected(new Set(newProjects.filter((p) => !p.isDisabled).map((p) => p.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover projects');
    } finally {
      setIsDiscovering(false);
    }
  }

  async function handleCreate() {
    setIsCreating(true);
    setErrors([]);
    const newProjects = [...org.projects];
    for (const projectId of selected) {
      const project = projects.find((p) => p.id === projectId);
      setProgress(`Creating token for ${project?.name ?? projectId}...`);
      try {
        const token = await manageApi.createProjectToken(
          org.stack,
          manageToken,
          projectId,
          `kbc-ui-next (${project?.name ?? projectId})`,
        );
        newProjects.push({
          id: String(projectId),
          name: project?.name ?? '',
          token: token.token,
        });
      } catch (err) {
        setErrors((prev) => [
          ...prev,
          `Failed to create token for ${project?.name ?? projectId}: ${err instanceof Error ? err.message : String(err)}`,
        ]);
      }
    }
    setProgress('');
    onUpdate({ ...org, projects: newProjects });
    setIsCreating(false);
  }

  function toggleProject(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-gray-700">Add New Projects</h4>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Management API Token
        </label>
        <input
          type="password"
          value={manageToken}
          onChange={(e) => setManageToken(e.target.value)}
          placeholder="Enter management token (not stored)"
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</div>}

      {projects.length === 0 && (
        <div className="flex gap-2">
          <button
            onClick={handleDiscover}
            disabled={!manageToken || isDiscovering}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isDiscovering ? 'Discovering...' : 'Discover New Projects'}
          </button>
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}

      {projects.length > 0 && (
        <>
          <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200">
            {projects.map((p) => (
              <label
                key={p.id}
                className={`flex items-center gap-2 border-b border-gray-50 px-3 py-2 text-sm ${
                  p.isDisabled ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  disabled={p.isDisabled}
                  onChange={() => toggleProject(p.id)}
                  className="rounded border-gray-300"
                />
                <span className="flex-1">
                  {p.name}
                  <span className="ml-2 text-xs text-gray-400">#{p.id}</span>
                </span>
                {p.isDisabled && (
                  <span className="text-xs text-gray-400">(disabled)</span>
                )}
              </label>
            ))}
          </div>

          {progress && (
            <div className="rounded-md bg-blue-50 p-2 text-xs text-blue-700">{progress}</div>
          )}

          {errors.map((err, i) => (
            <div key={i} className="rounded-md bg-red-50 p-2 text-xs text-red-700">
              {err}
            </div>
          ))}

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={selected.size === 0 || isCreating}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isCreating ? 'Creating Tokens...' : `Add ${selected.size} Project${selected.size !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={onCancel}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// -- AddOrgForm component --

type AddOrgFormProps = {
  existingOrgIds: string[];
  onAdd: (org: OrgConfig) => void;
  onCancel: () => void;
};

function AddOrgForm({ existingOrgIds, onAdd, onCancel }: AddOrgFormProps) {
  const [stack, setStack] = useState('');
  const [manageToken, setManageToken] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [projects, setProjects] = useState<ManageProject[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDiscoveringOrgs, setIsDiscoveringOrgs] = useState(false);
  const [discoveredOrgs, setDiscoveredOrgs] = useState<Array<{ id: number; name: string }>>([]);
  const [orgSearch, setOrgSearch] = useState('');

  async function handleDiscoverOrgs() {
    setError(null);
    setIsDiscoveringOrgs(true);
    setDiscoveredOrgs([]);
    try {
      // Step 1: Get maintainers
      const maintainers = await manageApi.listMaintainers(stack, manageToken);

      if (maintainers.length === 0) {
        // Fallback: try direct /manage/organizations
        const orgs = await manageApi.listOrganizations(stack, manageToken);
        setDiscoveredOrgs(orgs);
        if (orgs.length === 1) {
          setOrgId(String(orgs[0]!.id));
          setOrgName(orgs[0]!.name);
        }
        return;
      }

      // Step 2: Get organizations for all maintainers
      const allOrgs: Array<{ id: number; name: string }> = [];
      const seenIds = new Set<number>();

      for (const maintainer of maintainers) {
        try {
          const orgs = await manageApi.listMaintainerOrganizations(stack, manageToken, maintainer.id);
          for (const org of orgs) {
            if (!seenIds.has(org.id)) {
              seenIds.add(org.id);
              allOrgs.push(org);
            }
          }
        } catch {
          // Some maintainers might not have org access, continue
        }
      }

      // Sort by name
      allOrgs.sort((a, b) => a.name.localeCompare(b.name));
      setDiscoveredOrgs(allOrgs);

      // Auto-select if only one
      if (allOrgs.length === 1) {
        setOrgId(String(allOrgs[0]!.id));
        setOrgName(allOrgs[0]!.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover organizations.');
    } finally {
      setIsDiscoveringOrgs(false);
    }
  }

  const filteredOrgs = orgSearch
    ? discoveredOrgs.filter((o) =>
        o.name.toLowerCase().includes(orgSearch.toLowerCase()) ||
        String(o.id).includes(orgSearch)
      )
    : discoveredOrgs;

  async function handleDiscover() {
    setError(null);
    setIsDiscovering(true);
    try {
      if (existingOrgIds.includes(orgId)) {
        setError(`Organization ${orgId} is already configured. Use the Update button instead.`);
        setIsDiscovering(false);
        return;
      }
      const result = await manageApi.listOrganizationProjects(stack, manageToken, orgId);
      setProjects(result);
      setSelected(new Set(result.filter((p) => !p.isDisabled).map((p) => p.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover projects');
    } finally {
      setIsDiscovering(false);
    }
  }

  async function handleCreate() {
    setIsCreating(true);
    setErrors([]);
    const newProjects = [];
    for (const projectId of selected) {
      const project = projects.find((p) => p.id === projectId);
      setProgress(`Creating token for ${project?.name ?? projectId}...`);
      try {
        const token = await manageApi.createProjectToken(
          stack,
          manageToken,
          projectId,
          `kbc-ui-next (${project?.name ?? projectId})`,
        );
        newProjects.push({
          id: String(projectId),
          name: project?.name ?? '',
          token: token.token,
        });
      } catch (err) {
        setErrors((prev) => [
          ...prev,
          `Failed to create token for ${project?.name ?? projectId}: ${err instanceof Error ? err.message : String(err)}`,
        ]);
      }
    }
    setProgress('');
    const resolvedName = orgName || `Organization ${orgId}`;
    onAdd({
      id: orgId,
      name: resolvedName,
      stack: stack.replace(/\/+$/, ''),
      projects: newProjects,
    });
    setIsCreating(false);
  }

  function toggleProject(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">Add Organization</h3>

      <div className="space-y-3">
        <StackUrlPicker value={stack} onChange={setStack} />

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Management API Token
          </label>
          <input
            type="password"
            value={manageToken}
            onChange={(e) => setManageToken(e.target.value)}
            placeholder="Enter management token (not stored)"
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-[10px] text-gray-400">
            The management token is used only for this session and is never saved to disk.
          </p>
        </div>

        {stack && manageToken && discoveredOrgs.length === 0 && (
          <button
            onClick={handleDiscoverOrgs}
            disabled={isDiscoveringOrgs || !stack || !manageToken}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 disabled:text-gray-400"
          >
            {isDiscoveringOrgs ? 'Discovering organizations...' : 'Discover Organizations'}
          </button>
        )}

        {discoveredOrgs.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Organization ({discoveredOrgs.length} found)
            </label>
            {discoveredOrgs.length > 5 && (
              <input
                type="text"
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                placeholder="Search organizations..."
                className="mb-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
            <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200">
              {filteredOrgs.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">No matching organizations</p>
              ) : (
                filteredOrgs.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => {
                      setOrgId(String(o.id));
                      setOrgName(o.name);
                      setProjects([]);
                    }}
                    className={`flex w-full items-center justify-between border-b border-gray-50 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                      String(o.id) === orgId ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <span>{o.name}</span>
                    <span className="text-xs text-gray-400">{o.id}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {error && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</div>}

        {projects.length === 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleDiscover}
              disabled={!stack || !manageToken || !orgId || isDiscovering}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isDiscovering ? 'Discovering...' : 'Discover Projects'}
            </button>
            <button
              onClick={onCancel}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        )}

        {projects.length > 0 && (
          <>
            <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200">
              {projects.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-center gap-2 border-b border-gray-50 px-3 py-2 text-sm ${
                    p.isDisabled ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    disabled={p.isDisabled}
                    onChange={() => toggleProject(p.id)}
                    className="rounded border-gray-300"
                  />
                  <span className="flex-1">
                    {p.name}
                    <span className="ml-2 text-xs text-gray-400">#{p.id}</span>
                  </span>
                  {p.isDisabled && (
                    <span className="text-xs text-gray-400">(disabled)</span>
                  )}
                </label>
              ))}
            </div>

            {progress && (
              <div className="rounded-md bg-blue-50 p-2 text-xs text-blue-700">{progress}</div>
            )}

            {errors.map((err, i) => (
              <div key={i} className="rounded-md bg-red-50 p-2 text-xs text-red-700">
                {err}
              </div>
            ))}

            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={selected.size === 0 || isCreating}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
              >
                {isCreating
                  ? 'Creating Tokens...'
                  : `Setup ${selected.size} Project${selected.size !== 1 ? 's' : ''}`}
              </button>
              <button
                onClick={onCancel}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
