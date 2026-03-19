# kbc-ui-next - Implementation Plan

## Vision

Multi-project power-user UI for Keboola Cloud. 100% API coverage, rethought UX patterns, technical users as primary audience.

Key differences from legacy UI:
- **Multi-project**: switch between projects, search across projects, see cross-project relationships
- **Power-user first**: keyboard shortcuts, bulk operations, compact data density over whitespace
- **Simpler patterns**: one generic config editor instead of 79 module-specific UIs
- **API-complete**: every API capability exposed, not just what legacy UI chose to show

## Principles

1. **Generic over specific** - One SchemaForm component replaces 23 connector-specific UIs
2. **Tables over cards** - Dense, sortable, filterable tables. Technical users want data density.
3. **URL-driven state** - Filters, search, pagination in URL params. Shareable, bookmarkable.
4. **Command palette** - Cmd+K for everything: navigate, search, run, create. Replaces global search.
5. **Multi-project context** - Project switcher + cross-project search/comparison always available.

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│ Pages (routes)                                   │
│  One page per business object type               │
├─────────────────────────────────────────────────┤
│ Action Components (Run, Create, Delete, Copy...) │
│  Reusable action buttons/modals shared by pages  │
├─────────────────────────────────────────────────┤
│ SchemaForm                                       │
│  JSON Schema → form renderer for all configs     │
├─────────────────────────────────────────────────┤
│ DataTable + CommandPalette                        │
│  Core UI primitives used everywhere              │
├─────────────────────────────────────────────────┤
│ TanStack Query hooks                             │
│  One hook per API endpoint, Zod-validated        │
├─────────────────────────────────────────────────┤
│ API client + Zod schemas                         │
│  Validated fetch, cURL debug, multi-project      │
└─────────────────────────────────────────────────┘
```

## Phases

### Phase 1: Read-only power browser (DONE)
- [x] Connect to stack with token
- [x] Storage: buckets, tables, table detail with columns/metadata
- [x] Components: listing by type, configurations, config rows
- [x] Jobs: listing with filters, job detail with result JSON
- [x] Flows: orchestrator configs listing
- [x] Transformations: component listing
- [x] Settings: token info, permissions, features
- [x] Zod validation layer with cURL debug
- [x] Error boundary
- [x] 16 tests

### Phase 2: Actions & mutations (DONE)
Make the UI read-write. Every listing gets Create/Delete, every detail gets Run/Edit.

- [x] **Run Component** - POST to Queue API, auto-navigate to job detail
- [x] **Create Configuration** - modal with name/description, navigate to new config
- [x] **Delete Configuration** - confirmation modal with error handling
- [x] **Create Bucket** - modal with name/stage selector
- [x] **Jobs with names** - component/config name resolution via useComponentLookup
- [x] **Rich Flows page** - schedule, last change, last run, status (Scheduler API)
- [x] **Edit inline** - click-to-edit on names, descriptions (inline EditableText component)
- [x] **Copy Configuration** - duplicate with new name (POST /configs/{id}/copy + modal)
- [x] **Enable/Disable** - toggle on configs and rows (isDisabled flag, clickable status badge)

### Phase 3: Schema-driven config editor (DONE)
Replace raw JSON with auto-generated forms from component's configurationSchema.

- [x] **SchemaForm component** - recursive JSON Schema -> form (string, number, boolean, object, array, enum, password, url)
- [x] **Config editor page** - Form/JSON toggle tabs with Save Changes
- [x] **Row editor page** - SchemaForm for row parameters (configurationRowSchema)
- [x] **Save mutations** - updateConfiguration + updateConfigurationRow via API
- [x] **24 tests** - SchemaForm (15) + ConfigEditor (9)
- [x] **Input/Output mapping editor** - collapsible mapping with add/remove, output suggestions from CREATE TABLE
- [x] **Credentials section** - fallback schema registry (`src/config/component-schemas.ts`) provides JSON schemas for 16 DB components that lack configurationSchema. SchemaForm renders host/port/user/password/database/SSH/SSL automatically.

### Phase 4: Multi-project (DONE - core)
The killer differentiator. Connect multiple projects, search across them.

**Setup flow** (implemented):
1. User enters stack URL + Management API token on `/setup`
2. "Discover Organizations" → GET /manage/maintainers → /maintainers/{id}/organizations
3. Searchable org list (for large orgs with 1000+ entries)
4. "Discover Projects" → GET /manage/organizations/{id}/projects
5. Select projects → POST /manage/projects/{id}/tokens (auto-creates Storage tokens)
6. Save to `projects.secret.json` (gitignored)
7. Management token never stored - only in React state during session
8. Remove org can optionally delete tokens from Keboola (requires manage token)

- [x] **projects.secret.json** - org-based config: organizations[] → projects[]
- [x] **Management API setup page** - maintainer discovery, searchable org list, project selection, token creation
- [x] **Multi-project connection store** - Zustand with N projects, active project, derived stackUrl/token
- [x] **Project switcher sidebar** - org-grouped project list, click to switch, instant cache
- [x] **Query key prefixing** - all TanStack Query keys prefixed with activeProjectId
- [x] **Data catalog awareness** - shared buckets show "Linked from {project}", "Go to source project" button
- [x] **Storage filters** - All, In, Out, Linked, Shared filter pills with counts
- [x] **Org removal with token cleanup** - optional Keboola token deletion via manage token
- [x] **Metadata preload** - background prefetch buckets+components from all projects
- [x] **Global search (Cmd+K)** - command palette searching buckets, components, configs across all projects
- [x] **Multi-project jobs view** - /jobs/all with jobs from all projects merged by time
- [x] **Org dashboard** - aggregate stats, per-project health cards, cross-project recent jobs
- [x] **Stack URL picker** - preset Keboola stacks + custom URLs with localStorage memory

### Phase 5: Flow builder & transformation editor (DONE - visualization)
The two complex UIs that need custom implementation.

- [x] **Flow builder** - visual DAG with @xyflow/react + elkjs auto-layout (read-only)
- [x] **SQL editor** - CodeEditor component with monospace textarea, dark theme
- [x] **Python editor** - same CodeEditor, auto-detects language from componentId
- [x] **extractCode helper** - finds SQL/Python from queries array or blocks structure
- [x] **26 tests** - FlowBuilder (10) + CodeEditor (16)
- [x] **Flow editing** - add/remove phases and tasks via FlowEditor
- [x] **I/O Mapping editor** - input/output table mapping for transformations
- [x] **flowToMermaid** - export flow as Mermaid/text for AI context
- [x] **CodeMirror 6** - SQL syntax highlighting, table/column autocomplete, one-dark theme
- [x] **Phase/Block editor** - add/remove/rename/disable phases and blocks, impact analysis
- [x] **Block disable** - comment-based disable with output mapping handling (see business-logic-audit.md)

### Future: AI-driven flow orchestration
Instead of drag-and-drop, use prompt-driven flow editing:
- AI gets flow as Mermaid/text + available components/configs
- User describes changes in natural language
- AI generates new flow JSON, UI renders preview
- User confirms -> save
- See `flowToMermaid()` and `flowToText()` in `src/lib/flowToMermaid.ts`

### Phase 5b: Design System & Visual Polish (DONE - foundation + CSS remap)
Apply Keboola Product Design System from Figma. Toggle on/off via `data-theme="keboola"`.

**Approach**: CSS-first remap under `[data-theme="keboola"]`, not standalone component library. All existing Tailwind classes (bg-gray-*, text-blue-*, etc.) automatically pick up Keboola tokens when theme is active. No code changes needed — pure CSS override.

**Foundation** (done):
- [x] **Design tokens** - Figma → `src/config/design-tokens.ts` + `src/styles/globals.css` @theme
- [x] **Color palettes** - 10 palettes with shades 100–900, all registered in Tailwind
- [x] **Typography** - Inter font, H1–H3 weights, antialiased rendering
- [x] **Theme toggle** - `ThemeToggle` component + Zustand store, persists to localStorage

**CSS remap** (done — covers all pages automatically):
- [x] **Gray → Neutral** - all bg-gray-*, text-gray-*, border-gray-* remapped to cooler neutral palette
- [x] **Layout shell** - sidebar active state (green accent), neutral borders, warm bg
- [x] **Tables** - 11px uppercase headers, subtle dividers, hover rows
- [x] **Buttons** - green primary with shadow + hover lift, danger red, ghost borders
- [x] **Badges** - status colors mapped (green/red/orange/blue/purple)
- [x] **Links** - blue-600 with hover darkening
- [x] **Focus rings** - green-500 outline
- [x] **Scrollbars** - thin 6px with neutral thumb
- [x] **Transitions** - 150ms ease on all interactive elements

**Remaining polish** (done):
- [x] **Toast notifications** - Zustand store + ToastContainer, success/error/warning/info with auto-dismiss, slide-in animation
- [x] **Skeleton loading** - Skeleton/SkeletonTable/SkeletonCard components with shimmer gradient under theme
- [x] **Tooltip component** - CSS-only via `data-tooltip` attribute, arrow + positioned above, works with/without theme
- [x] **Connect page** - org cards: green hover + lift under theme, form: refined borders/shadow, submit button: green primary
- [x] **Command palette** - backdrop blur + refined dialog shadow/border under theme

### Phase 6: Remaining features
Everything else from the legacy UI.

**Sync Actions** (component-driven interactive actions):
- [ ] **Sync Actions API client** - `POST {syncActionsUrl}/actions` with `{ componentId, action, configData }`. Returns immediate result (not a job). Service URL from token verify response.
- [ ] **Test Connection button** - for DB extractors/writers. Sends current credentials via `testConnection` action, shows success/error toast. Critical for credentials UX.
- [ ] **Schema-driven sync actions** - discover available actions from component schema `properties[].options.async.action`. Render buttons dynamically.
- [ ] **Generic extractor actions** - `test_request` (test HTTP endpoint), `load_from_curl` (parse cURL to config), `infer_mapping` (auto-detect table structure)

**Events** (done — with known token limitation):
- [x] **Events API client** - `GET /v2/storage/events` with `runId`, global/table/bucket/job filters
- [x] **EventsViewer component** - terminal-style log with search, type/source filters, expand, copy/download
- [x] **Job events** - per-job event stream with 5s polling, inline import metrics (rows, size, duration)
- [x] **Global events page** - `/events` route with 10s polling
- [x] **4 job detail layouts** - Classic/Split/Terminal/Dashboard with vote button, localStorage persistence
- [x] **Structured job result** - output/input tables with columns, JSON toggle
- [ ] **Event pagination** - currently limited to 200 events. Need cursor-based "Load More" using `maxId` (UUID of oldest event). Also: "Jump to Start" button to load the earliest events of a job. Long jobs can have thousands of events.
- [ ] **Master token requirement** - tokens created via Management API (`POST /manage/projects/{id}/tokens`) are NOT master tokens. Storage events API only returns events created by the SAME token. Legacy UI uses SSO master token which sees ALL events. **Workaround**: user must connect with their master token (from project Settings -> API Tokens). **Proper fix**: either create master tokens via Management API (if supported), or add UI to let user paste their master token per project.
- [ ] **Project switch navigation** - redirect from detail pages to listings when switching projects (partially implemented)

**Rich Description Editor** (Markdown + Mermaid):

Configuration descriptions support Markdown in Keboola. Currently we only have plain-text inline edit. Need full Markdown authoring and rendering with Mermaid diagram support.

*Rendering (read mode):*
- [ ] **Markdown rendering** - render config description as Markdown (headings, bold, italic, lists, links, code blocks, tables). Use a React Markdown library (react-markdown or similar) with sanitization.
- [ ] **Mermaid diagrams** - render fenced code blocks tagged `mermaid` as interactive diagrams (flowcharts, sequence diagrams, ER diagrams). Use mermaid.js for client-side rendering. Lazy-loaded to avoid bundle bloat.
- [ ] **Description display on config detail** - rendered Markdown below config name, collapsible if long (>5 lines collapsed preview with "Show more")
- [ ] **Description in config listings** - truncated plain-text preview in table rows (strip Markdown formatting)

*Editing (write mode):*
- [ ] **Markdown editor** - click description to open editor. Textarea with monospace font, preview toggle (edit | preview | side-by-side). Toolbar with common formatting buttons (bold, italic, heading, link, code, list, mermaid template).
- [ ] **Mermaid live preview** - in preview/side-by-side mode, Mermaid blocks render as diagrams in real-time
- [ ] **Save description** - PUT to Storage API, optimistic update, toast on success
- [ ] **Row descriptions** - same Markdown rendering and editing for config row descriptions

**Transformation Explain & Lineage** (Fisa's tip):

When a transformation has 500 lines of SQL and a colleague needs to understand it, an "Explain" feature with lineage visualization would help enormously.

- [ ] **SQL Explain panel** - button on transformation detail that generates a human-readable summary of what the SQL does: input tables, output tables, key transformations (joins, aggregations, filters, CTEs), business logic
- [ ] **Lineage diagram** - Mermaid/visual DAG showing data flow: source tables → transformation steps → output tables. Auto-generated from SQL parsing (detect FROM/JOIN for inputs, CREATE TABLE/INSERT INTO for outputs)
- [ ] **Column-level lineage** - trace which input columns flow into which output columns through SELECT, CASE, aggregation
- [ ] **Cross-transformation lineage** - connect lineage across multiple transformations: output of transformation A is input of transformation B. Build a full pipeline graph from all transformations in a project
- [ ] **AI-powered explain** - send SQL + table schemas to LLM for natural language explanation of business logic (optional, requires API key)

**Other features:**
- [ ] **Data Catalog** - shared buckets between projects
- [ ] **Data Apps** - Streamlit app management
- [ ] **Workspaces** - Snowflake/Python/R workspace management
- [ ] **Files** - file upload/download/tagging
- [ ] **Trash** - recently deleted with restore
- [ ] **Users & Tokens** - user management, token CRUD
- [ ] **Scheduling** - cron-based automation
- [ ] **Notifications** - per-config notification settings
- [ ] **Version history** - see detailed breakdown below

**Version History & Config Diff** (full feature):

Storage API provides full version support: `GET .../configs/{id}/versions`, `GET .../versions/{versionId}`, `POST .../versions/{versionId}/rollback`. Each version includes `version` number, `created` timestamp, `creatorToken.description`, `changeDescription`, and full `configuration` JSON snapshot.

*UI integration — where versions appear:*
- [ ] **Version badge on config detail** - show current version number (e.g. "v12") in config header, clickable to open version history
- [ ] **Version badge on config row detail** - same for rows (if API supports row versioning)
- [ ] **Version column in config listings** - optional column showing current version number in component config tables

*Version history panel:*
- [ ] **Version history page/panel** - accessible from config detail. Timeline-style list: version number, date, author (token description), change description. Sorted newest-first.
- [ ] **Infinite scroll or pagination** - configs with many versions (100+) need cursor-based loading
- [ ] **Change description** - show inline, highlight versions with empty descriptions (common)
- [ ] **Filter/search** - filter versions by author or search in change descriptions

*Diff viewer:*
- [ ] **Side-by-side JSON diff** - compare any two versions. Highlighted additions (green), deletions (red), modifications (yellow). Use a diffing library (jsondiffpatch or similar).
- [ ] **Structured diff view** - not just raw JSON: show parameter changes grouped by section (parameters, storage.input, storage.output, processors). Collapsible sections.
- [ ] **Compare with current** - one-click diff between any historical version and the current live config
- [ ] **Compare arbitrary versions** - select two versions from the list to diff against each other

*Rollback:*
- [ ] **Restore version button** - on each historical version. Confirmation modal showing what will change (diff from current to target version).
- [ ] **Rollback creates new version** - API behavior: rollback doesn't rewrite history, it creates version N+1 with the old content. UI should make this clear.
- [ ] **Post-rollback navigation** - after rollback, refresh config detail and show success toast with new version number

*Row versions:*
- [ ] **Row version history** - same UI pattern for config rows (`GET .../configs/{id}/rows/{rowId}/versions`). Rows change independently from the parent config.
- [ ] **Row diff viewer** - same diff UI applied to row configuration JSON

*Copy version as new config:*
- [ ] **"Copy as new config" from version** - create a brand new configuration from a historical version snapshot. Useful for "I want to go back to v5 but keep current as-is too"
- [ ] **Dev branches** - branch-aware navigation
- [ ] **Data Streams** - real-time ingestion
- [ ] **Events** - event log per table/bucket/job

### Phase 5c: Data Profiler & Storage UX
Make storage browsing a first-class data exploration experience. Inspired by oss-ai-data-analyst profiler.

**Layer 1: Data Preview enhancements** (inline, low effort):
- [x] **Data Preview** - auto-load, collapsible, max-height viewport with internal scroll + sticky header
- [x] **Columns with sample values** - 5 unique samples per column from preview data
- [x] **Basic profiling** - distinct count, null count, min/max for numerics
- [ ] **Column sorting** - click header to sort data preview by any column
- [ ] **Data search** - filter rows by text search across all columns
- [ ] **Sticky first column** - keep identifier column visible on horizontal scroll
- [ ] **Load more** - button to fetch additional rows beyond initial 100

**Layer 2: Column profile enrichment** (computed from sample data):
- [x] **Type detection** - numeric vs string vs date vs boolean inference
- [ ] **Completeness bar** - green/yellow/red visual bar per column (% non-null)
- [ ] **Top values** - for categorical columns (<=50 distinct), show top 5 with counts
- [ ] **Distribution sparkline** - tiny inline histogram for numeric columns
- [ ] **Column metadata** - show columnMetadata from API (types, descriptions)

**Layer 3: Full Profiler Modal** (dedicated view, higher effort):
- [ ] **Profile button** - in table detail header, opens fullscreen modal
- [ ] **Overview tab** - dataset-level stats: rows, columns, size, completeness %, type distribution
- [ ] **Columns tab** - per-column cards with histogram (numeric), bar chart (categorical), date range (temporal)
- [ ] **Insights tab** - auto-detected alerts: constant columns, high missing (>30%), imbalance (>60%), all-unique, high cardinality
- [ ] **Missing Values tab** - horizontal completeness bars for all columns, ranked
- [ ] **Charts** - Chart.js or recharts for histograms and distributions
- [ ] **Workspace query** - for tables >100 rows, option to run profiling via Snowflake workspace for accurate stats

**Bucket detail enhancements** (done):
- [x] **Stats bar** - tables count, total rows, total size, created
- [x] **Header badges** - stage (IN/OUT), backend (Snowflake), bucket ID
- [x] **Column search** - search across table names and column names
- [x] **Collapsible details** - bucket ID, backend, timestamps, metadata

### Phase 7a: Data Quality Inspector (Workspace + Query Service)

Automated data quality checks via SQL — runs diagnostic queries against storage tables using a read-only workspace and Query Service. Credit: Fisa's technique for detecting gaps in time-series data and volume anomalies.

**Infrastructure — Workspace & Query Service API:**

API flow: create workspace → submit SQL → poll for completion → fetch results.

- [ ] **Workspace API client** (`src/api/workspaces.ts`) — create, list, delete workspaces via Storage API (`POST /branch/{branchId}/components/{componentId}/configs/{configId}/workspaces`)
- [ ] **Query Service API client** (`src/api/queries.ts`) — submit query jobs, poll status, fetch results via Query Service (`query.{region}.keboola.com`)
- [ ] **Technical workspace management** — auto-create a single read-only workspace per project (`readOnlyStorageAccess: true`, `useCase: 'reader'`). Workspace gives direct SQL access to ALL storage tables without loading data. Reuse across queries. Store workspace ID in Zustand/localStorage.
- [ ] **Query execution hook** (`useWorkspaceQuery`) — submit SQL statements, poll `getQueryJob()` until `state === 'completed'`, return typed results. Handle `failed`/`canceled` states.

**Diagnostic SQL Queries (Fisa's technique):**

For any table with a date/timestamp column + primary key:

```sql
-- Q1: Date range
SELECT MIN(date_col) AS min_date, MAX(date_col) AS max_date,
       DATEDIFF('day', MIN(date_col), MAX(date_col)) + 1 AS expected_days
FROM "in.c-bucket.table";

-- Q2: Timeline completeness (% of days with data)
SELECT COUNT(DISTINCT DATE(date_col)) AS actual_days,
       DATEDIFF('day', MIN(date_col), MAX(date_col)) + 1 AS expected_days,
       ROUND(100.0 * COUNT(DISTINCT DATE(date_col)) /
             NULLIF(DATEDIFF('day', MIN(date_col), MAX(date_col)) + 1, 0), 1) AS completeness_pct
FROM "in.c-bucket.table";

-- Q3: Volume per day — detect anomalies (missing/partial loads)
SELECT DATE(date_col) AS day, COUNT(*) AS row_count
FROM "in.c-bucket.table"
GROUP BY day ORDER BY day;

-- Q4: PK count over date — find load gaps
SELECT DATE(date_col) AS day, COUNT(DISTINCT pk_col) AS distinct_pks
FROM "in.c-bucket.table"
GROUP BY day ORDER BY day;
```

- [ ] **Column detection** — auto-detect date columns (type metadata, column name heuristics: `date`, `created`, `updated`, `timestamp`, `_at`, `_date`) and primary key columns (from table metadata `primaryKey[]`)
- [ ] **SQL generator** — generate diagnostic queries based on detected columns. Adapt for Snowflake SQL dialect (quoted table IDs: `"in.c-bucket.table"`)
- [ ] **Anomaly detection** — from Q3/Q4 results: flag days where row_count < mean - 2*stddev or is 0. Calculate completeness percentage from Q2.

**UI — Table Detail Integration:**

- [ ] **"Data Quality" tab** on table detail page — shows diagnostic results
- [ ] **Timeline completeness bar** — visual bar showing date range with gaps highlighted in red. E.g., "98.5% complete (2 missing days out of 365)"
- [ ] **Volume chart** — sparkline/bar chart of daily row counts. Anomalous days highlighted
- [ ] **Gap list** — table of missing dates (if any)
- [ ] **Run button** — "Analyze" button triggers the diagnostic queries. Results cached in TanStack Query.
- [ ] **Auto-run option** — for tables with known date columns, offer automatic analysis on table detail load (opt-in)

**Implementation sequence:**

1. Workspace API + Query Service API clients
2. Technical workspace auto-provisioning (one per project)
3. SQL generator for diagnostic queries
4. useWorkspaceQuery hook with polling
5. Data Quality tab UI with charts
6. Anomaly detection logic

**Cost considerations:**
- Read-only workspace: no data duplication, queries run against live storage
- `platformUsageType: 'reader'` — minimal credit cost
- Workspace persists between queries (no create/destroy overhead)
- Queries are lightweight (aggregations, not full scans for most checks)

### Phase 7: Power-user features
Things legacy UI doesn't have but power users want.

- [x] **Command palette** (Cmd+K) - search across all projects' buckets, components, configs
- [ ] **Keyboard shortcuts** - vim-like navigation
- [ ] **Bulk operations** - select multiple configs, run/delete/copy
- [ ] **Favorites/bookmarks** - pin frequently used configs
- [ ] **Custom dashboards** - configurable widgets
- [ ] **API explorer** - raw API call builder (like Postman)
- [ ] **Config diff viewer** - compare versions side by side (→ covered in Phase 6 "Version History & Config Diff")
- [ ] **Export/Import** - export configs as YAML/JSON, import to another project
