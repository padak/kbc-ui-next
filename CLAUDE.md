# kbc-ui-next

Greenfield multi-project power-user UI for Keboola Cloud. Replaces legacy kbc-ui (251K LOC, 79 modules) with ~3K LOC.

## File Header Convention

Every source file MUST start with a 5-line comment header:

```typescript
// file: relative/path/from/src.ts
// Line 2: What this file does (primary purpose).
// Line 3: Key details (what it exports, what it depends on).
// Line 4: Who uses this file (which parts of the app).
// Line 5: Any important notes or caveats.
```

This enables quick codebase discovery via: `find src -name '*.ts' -o -name '*.tsx' | xargs head -5`

## Tech Stack

- **React 19** + **TypeScript** (strict mode)
- **React Router 7** (file-based-ish routing)
- **TanStack Query v5** (ALL server state - no local copies of API data)
- **Zustand v5** (UI-only state: sidebar, modals, preferences)
- **Zod v4** (runtime API response validation)
- **Tailwind CSS v4** (utility-first styling)
- **Vite 6** (bundler)

## Architecture Rules

1. **No Flux, no Immutable.js** - ever. TanStack Query for server state, Zustand for UI state.
2. **No local copies of server data** - always fetch via TanStack Query hooks. Mutations invalidate queries.
3. **Plain JS objects** - no Immutable.Map/List. TypeScript types derived from Zod schemas.
4. **Schema-driven connectors** - one generic ConfigurationPage + SchemaForm for all extractors/writers.
5. **API client is a thin fetch wrapper** - Zod-validated, with cURL debug on validation failure.
6. **Multi-project** - all query keys prefixed with `activeProjectId`. Each project has independent cache.
7. **Management token never persisted** - only held in React state during setup operations.

## Zod Schema Workflow

Every API response is validated through Zod schemas (`src/api/schemas.ts`). When adding a new endpoint:

1. Read the legacy type from `~/github/kbc-ui/packages/api-client/src/clients/storage/*/types.ts`
2. Verify with `curl` against the real API (the legacy types are hand-written and may be incomplete)
3. Write a Zod schema with `.passthrough()` (allow extra fields) and `.optional()`/`.nullable()` where the API returns null
4. TypeScript types are derived from schemas via `z.infer` - never define types separately

Key patterns:
- `.passthrough()` on every object schema (API returns more fields than we need)
- `.nullable()` for fields the API may return as `null`
- `.default()` for fields that may be missing entirely
- Validation errors include a `curl` command for debugging
- Schema descriptions contain HTML (`<a>` tags) - render with `dangerouslySetInnerHTML`

Note: `z.record()` in Zod v4 requires two args: `z.record(z.string(), z.unknown())`, not `z.record(z.unknown())`.

## Multi-Project Architecture

The app supports 20-50 projects grouped by organization.

**Connection store** (`src/stores/connection.ts`):
- `projects: ProjectEntry[]` - all registered projects
- `activeProjectId` - currently active project
- Derived `stackUrl`, `token` from active project (backward compatible with API client)
- All TanStack Query keys prefixed with `activeProjectId`

**Project configuration** (`projects.secret.json`):
- Organizations → Projects hierarchy
- Created via Setup page (`/setup`) using Management API token
- Management token: GET `/manage/maintainers` → GET `/manage/maintainers/{id}/organizations` → GET `/manage/organizations/{id}/projects` → POST `/manage/projects/{id}/tokens`
- Reference implementation: `~/github/keboola_agent_cli/` (OrgService, ManageClient)

**Shared buckets**: Buckets with `sourceBucket` field are linked from other projects. "Go to source project" button switches active project when source is registered.

## API Endpoints

- **Storage API**: `{stackUrl}/v2/storage/...` - header `X-StorageApi-Token`
- **Queue API**: `queue.{region}.keboola.com/...` - search jobs at `/search/jobs` (NOT `/jobs` which is 410 Gone)
- **Scheduler API**: `scheduler.{region}.keboola.com/schedules`
- **Management API**: `{stackUrl}/manage/...` - header `X-KBC-ManageApiToken`
- **Storage mutations**: use `application/x-www-form-urlencoded` (NOT JSON) for POST/PUT

## Commands

```bash
npm run dev          # Dev server on http://localhost:5173
npm run build        # Production build
npm run type-check   # TypeScript check
npm run test         # Run 44 tests
npm run test:watch   # Watch mode
```

## Legacy Codebase Reference

The legacy kbc-ui at `/Users/padak/github/kbc-ui/` serves as a reference for:
- UX flows and user journeys
- Business logic that lives on the frontend
- API call patterns and edge cases

**Architecture docs**: `/Users/padak/github/kbc-ui/docs/architecture/`
- `REPORT.md` - full architecture analysis (79 modules, 251K LOC, coupling analysis)
- `api-surface.md` / `api-surface.json` - all API endpoints and consumers
- `module-inventory.json` - all modules with metrics, state management, dependencies
- `modernization-matrix.md` - migration readiness scores per module
- `c4-level*.mmd` - C4 architecture diagrams (Mermaid)
- `module-graph.mmd` - dependency graph between modules

**Legacy type locations** (for Zod schema creation):
- Storage (buckets, tables): `kbc-ui/packages/api-client/src/clients/storage/types.ts`
- Components & configs: `kbc-ui/packages/api-client/src/clients/storage/componentsAndConfigurations/types.ts`
- Queue/Jobs: `kbc-ui/packages/api-client/src/clients/queue/types.ts` (OpenAPI-generated)
- Scheduler: `kbc-ui/apps/kbc-ui/src/scripts/modules/scheduler/helpers.ts`
- Management API: `kbc-ui/apps/kbc-ui/src/scripts/modules/settings/manageApi.js`
- Other services: `kbc-ui/packages/api-client/src/clients/*/__generated__/schema.d.ts`

**Key learnings from legacy code**:
- `InstalledComponentsStore` (27.8K LOC, 61 dependents) is the god module - we replaced it with `useComponents()` hook
- Component/config name resolution for Jobs comes from components cache, not Queue API
- Flow schedules are in Scheduler API, not in flow config itself
- Folders use metadata key `CONFIGURATION_FOLDER`
- Storage API has NO OpenAPI spec - types are hand-written, always verify with curl

## Project Documentation

- `docs/PLAN.md` - implementation plan with 7 phases
- `docs/feature-gap-analysis.md` - comprehensive comparison with legacy UI
- `docs/business-logic-audit.md` - frontend logic that should be in API
