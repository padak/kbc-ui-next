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
- [ ] **Edit inline** - click-to-edit on names, descriptions
- [ ] **Copy Configuration** - duplicate with new name
- [ ] **Enable/Disable** - toggle on configs and rows

### Phase 3: Schema-driven config editor (DONE)
Replace raw JSON with auto-generated forms from component's configurationSchema.

- [x] **SchemaForm component** - recursive JSON Schema -> form (string, number, boolean, object, array, enum, password, url)
- [x] **Config editor page** - Form/JSON toggle tabs with Save Changes
- [x] **Row editor page** - SchemaForm for row parameters (configurationRowSchema)
- [x] **Save mutations** - updateConfiguration + updateConfigurationRow via API
- [x] **24 tests** - SchemaForm (15) + ConfigEditor (9)
- [x] **Input/Output mapping editor** - collapsible mapping with add/remove, output suggestions from CREATE TABLE
- [ ] **Credentials section** - DB connection form (host, port, user, password)

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

**Remaining polish** (per-page fine-tuning, do as needed):
- [ ] **Toast notifications** - success/error/warning with auto-dismiss (need component)
- [ ] **Skeleton loading** - placeholder shimmer for async content
- [ ] **Tooltip component** - positioned tooltips (currently using title attr)
- [ ] **Connect page** - login form styling
- [ ] **Command palette** - modal backdrop + styling refinement

### Phase 6: Remaining features
Everything else from the legacy UI.

- [ ] **Data Catalog** - shared buckets between projects
- [ ] **Data Apps** - Streamlit app management
- [ ] **Workspaces** - Snowflake/Python/R workspace management
- [ ] **Files** - file upload/download/tagging
- [ ] **Trash** - recently deleted with restore
- [ ] **Users & Tokens** - user management, token CRUD
- [ ] **Scheduling** - cron-based automation
- [ ] **Notifications** - per-config notification settings
- [ ] **Version history** - config versions with rollback
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

### Phase 7: Power-user features
Things legacy UI doesn't have but power users want.

- [x] **Command palette** (Cmd+K) - search across all projects' buckets, components, configs
- [ ] **Keyboard shortcuts** - vim-like navigation
- [ ] **Bulk operations** - select multiple configs, run/delete/copy
- [ ] **Favorites/bookmarks** - pin frequently used configs
- [ ] **Custom dashboards** - configurable widgets
- [ ] **API explorer** - raw API call builder (like Postman)
- [ ] **Config diff viewer** - compare versions side by side
- [ ] **Export/Import** - export configs as YAML/JSON, import to another project
