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

## Design System

Figma source: "Product Design System" (file key `VVjvQJQTMcFPDkWqB0Bf39TD`).

**Token files** (keep in sync when Figma changes):
- `src/config/design-tokens.ts` — TypeScript tokens for runtime access (colors, typography, shadows, radii, button/modal variants)
- `src/styles/globals.css` — Tailwind v4 `@theme` directives registering all tokens as CSS custom properties

**Color palettes**: neutral, green, red, orange, blue, purple, cyan, teal, yellow, pink — each with shades 100–900.

**Typography**: Inter font. Styles: H1 (32/500), H2 (24/500), H3 (16/500), Body (14/400), Body Medium (14/500), Button (12/500/uppercase/0.08em tracking).

**Shadows**: `shadow-card` (subtle), `shadow-dialog` (elevated). **Radii**: `rounded-sm` (2px), `rounded-md` (4px), `rounded-lg` (8px), `rounded-xl` (10px).

**Usage**: always use design system tokens via Tailwind classes (`bg-green-500`, `text-neutral-900`, `shadow-card`, `rounded-lg`) or TS imports from `design-tokens.ts`. Never hardcode hex colors or font sizes in components.

## Transformation Editor

SQL transformations have a structured code editor in `src/components/TransformationBlocks.tsx`.

**Data model**: `parameters.blocks[]` — each block is a "phase" containing `codes[]` — each code has `name` and `script: string[]` (array of SQL statements, one per element).

**Key components**:
- `TransformationBlocks` — phase/block tree with collapsible UI, edit/add/delete/rename/disable
- `SqlEditor` (`src/components/SqlEditor.tsx`) — CodeMirror 6 wrapper, lazy-loaded (127KB gzip chunk)
- `MappingEditor` — collapsible input/output mapping with item count badges

**SQL autocomplete** (two sources):
- Input mapping destinations + their storage columns (unquoted: `FROM csob_statements`)
- All storage tables for direct query (quoted: `FROM "in.c-bucket.table"`)

**Disable mechanism** — uses SQL line comments (no extra config keys, strict schema):
- Disable: each statement wrapped in `-- [DISABLED BY KBC-UI]\n-- ...` comments. Runner sees NOP.
- Output mappings: embedded as `-- [KBC-UI-OUTPUT] {"source":"x","destination":"y"}` in the disabled script. Removed from `storage.output.tables` on disable, restored on re-enable.
- Enable: strips comment markers, restores output mappings from embedded JSON.
- Impact analysis: `analyzeDisableImpact()` detects created tables (CREATE TABLE), dependent blocks (FROM/JOIN), and affected output mappings. Shows confirmation modal.

**Statement splitting**: `splitStatements()` splits SQL by `;` respecting quotes, comments. Each element in `script[]` must be a single statement — Snowflake rejects multi-statement execution.

**Output mapping suggestions**: `extractCreatedTables()` parses CREATE TABLE from all SQL blocks and offers them as autocomplete in the output mapping "Source" field.

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

## Security Rules

These rules are **must-have** — violations are blockers in code review. Based on security audit (`docs/AGENT-REPORTS/SECURITY.md`).

1. **Never pass unvalidated `href` to DOM** — all user-provided URLs (Markdown, links, `dangerouslySetInnerHTML`) must be validated against safe schemes (`https:`, `http:`, `mailto:`, `#`). Never allow `javascript:`, `data:`, or `vbscript:` URIs in rendered HTML.
2. **Guard debug output with `import.meta.env.DEV`** — never log tokens (even masked), cURL commands, raw API responses, or Zod validation details to `console` in production builds. Vite tree-shakes DEV-guarded code from the bundle.
3. **Never expose raw error messages in UI in production** — use generic user-facing messages; detailed errors belong in the browser console (DEV only) or structured logging.
4. **Mask tokens in all user-facing output** — event details, clipboard copy, file downloads, error messages. For event tokens, include only `{ name }`, never the full token object.
5. **`VITE_*` env vars are public** — Vite inlines `VITE_`-prefixed variables into the JS bundle at build time. Never use `VITE_` prefix for secrets in production builds. A runtime warning fires if detected in production.
6. **`projects.secret.json` must never be deployed** — this file contains plaintext tokens. It is in `.gitignore` and `.dockerignore`. Never copy it to `dist/`.
7. **CSP must be maintained** — `index.html` has a `Content-Security-Policy` meta tag. When adding external resources (scripts, styles, API domains, image sources), update the CSP directives. Current policy: `connect-src` allows `*.keboola.com` and `*.keboola.cloud`.
8. **Validate all data written to disk** — dev-server middleware that writes files (e.g., `/__save-projects`) must validate input against a Zod schema before writing.
9. **localStorage tokens are a known trade-off** — tokens are stored in plaintext `localStorage` for UX (persist across page reloads). Acceptable for the local power-user tool use case. Never add additional redundant token storage keys — keep the surface minimal.
10. **No redundant secret storage** — store each secret in exactly one place. The `kbc_projects` localStorage key holds tokens; do not duplicate into separate keys like `kbc_storage_token`.

## Project Documentation

- `docs/PLAN.md` - implementation plan with 7 phases
- `docs/feature-gap-analysis.md` - comprehensive comparison with legacy UI
- `docs/business-logic-audit.md` - frontend logic that should be in API. **Must be maintained** — when adding logic that works around API limitations (hacks, client-side parsing, schema workarounds), document it here with severity, risks, and proposed API fix. Contains "Active Hacks" section for fragile workarounds like SQL block disable.
