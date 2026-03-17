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

### Phase 3: Schema-driven config editor
Replace raw JSON with auto-generated forms from component's configurationSchema.

- [ ] **SchemaForm component** - renders JSON Schema as form
- [ ] **Config editor page** - SchemaForm + raw JSON toggle
- [ ] **Row editor page** - SchemaForm for row parameters
- [ ] **Input/Output mapping editor** - table picker + mapping UI
- [ ] **Credentials section** - DB connection form (host, port, user, password)

### Phase 4: Multi-project
The killer differentiator. Connect multiple projects, search across them.

- [ ] **Project registry** - store multiple stack+token pairs
- [ ] **Project switcher** - dropdown or sidebar with all connected projects
- [ ] **Cross-project search** - find configs/tables across all projects
- [ ] **Cross-project comparison** - diff configs between projects
- [ ] **Dependency map** - which project shares data with which
- [ ] **Multi-project jobs view** - all jobs across all projects in one table

### Phase 5: Flow builder & transformation editor
The two complex UIs that need custom implementation.

- [ ] **Flow builder** - visual DAG editor for orchestration phases/tasks
- [ ] **SQL editor** - CodeMirror/Monaco with Snowflake SQL syntax
- [ ] **Python editor** - CodeMirror for Python transformations
- [ ] **Query results viewer** - tabular results display

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

### Phase 7: Power-user features
Things legacy UI doesn't have but power users want.

- [ ] **Command palette** (Cmd+K) - navigate, search, run, create
- [ ] **Keyboard shortcuts** - vim-like navigation
- [ ] **Bulk operations** - select multiple configs, run/delete/copy
- [ ] **Favorites/bookmarks** - pin frequently used configs
- [ ] **Custom dashboards** - configurable widgets
- [ ] **API explorer** - raw API call builder (like Postman)
- [ ] **Config diff viewer** - compare versions side by side
- [ ] **Export/Import** - export configs as YAML/JSON, import to another project
