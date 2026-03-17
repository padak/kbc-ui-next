# Feature Gap Analysis: kbc-ui-next vs Legacy UI

Comprehensive comparison based on architecture docs + live UI browsing.

## Legend

- [x] Implemented in kbc-ui-next
- [ ] Missing - needs implementation
- [-] Partially implemented

## 1. GLOBAL LAYOUT & NAVIGATION

### Header
- [x] App title (Keboola)
- [x] Project name display
- [ ] Organization/project switcher dropdown
- [ ] Branch selector (Production / dev branches)
- [ ] Global search overlay (configs, storage, projects)
- [ ] KAI AI Assistant button
- [ ] Trash/Recently Deleted access
- [ ] Notification bell with badge
- [ ] User avatar + dropdown menu

### Sidebar / Navigation
- [x] Dashboard
- [ ] Flows (legacy has top nav)
- [ ] Data Apps
- [x] Components
- [ ] Data Catalog
- [x] Storage
- [x] Transformations
- [ ] Workspaces
- [x] Jobs
- [x] Settings
- [x] Disconnect button

### User Menu (legacy: avatar dropdown)
- [ ] Manage Applications
- [ ] My Account & Organizations
- [ ] User Features
- [ ] Project Settings link
- [ ] Keboola MCP Server
- [ ] Project Consumption
- [ ] Organization Usage
- [ ] Support
- [ ] Navigation Hotkeys
- [ ] Help / Academy / Logout

---

## 2. DASHBOARD

### Legacy Features
- [ ] Expiration warning banner
- [ ] Deprecated components banner
- [ ] Meet Kai promo card (dismissible)
- [ ] Latest Configuration Edits (recent activity)
- [ ] Project Users card (online/offline status)
- [ ] Latest Activity table (mixed: jobs, config edits, flow runs)
- [ ] Add Description button

### kbc-ui-next
- [x] Buckets count stat card
- [x] Tables count stat card
- [-] Components count stat card (timing issue)
- [x] Recent Jobs count stat card
- [x] Recent Jobs table (ID, Component, Status, Created)

### Gap Summary
Dashboard is minimal. Missing: activity feed, user cards, config edits, banners.

---

## 3. STORAGE

### Tables & Buckets
- [x] Bucket listing with size, rows, last change
- [x] Bucket detail with tables list
- [x] Table detail: columns, metadata, stats
- [x] Search/filter on listings
- [x] Sortable columns
- [ ] Bucket creation (+ CREATE BUCKET button)
- [ ] Bucket type badges (IN/OUT)
- [ ] Table type badges (NON-TYPED, TYPED)
- [ ] Expand/collapse buckets in tree view
- [ ] LINKED / SHARED / DEV BRANCH filter pills
- [ ] Checkbox selection for bulk operations
- [ ] "Open Storage Tree" button on table detail
- [ ] Table sub-tabs: Overview | Schema | Events | Data Sample | Snapshots | Usage
- [ ] Data Sample tab (actual data preview)
- [ ] Table description editing
- [ ] Column sample values
- [ ] Latest import time graph
- [ ] Stage/Created/Last import/Last change metadata

### Files
- [ ] File listing (name, size, tags, expiration)
- [ ] File upload
- [ ] File tagging
- [ ] File search by tags

### Data Streams
- [ ] Data Streams page (real-time ingestion)

### Storage Jobs
- [ ] Storage-specific job listing (operations, data transfer)

### Events
- [ ] Storage events log with filters

---

## 4. COMPONENTS

### Listing
- [x] Components grouped by type (Extractors, Writers, Apps, Transformations)
- [x] Search
- [x] Component icons
- [ ] Configuration count per component
- [ ] Filter pills: ALL | DATA SOURCES | DATA DESTINATIONS | APPLICATIONS
- [ ] Sort dropdown (Recently Added, etc.)
- [ ] Collapse/expand components
- [ ] "ADD COMPONENT" button (component marketplace with 293 components)

### Component Marketplace (Add New)
- [ ] Full-page component browser
- [ ] Category filters (API, Accounting, CRM, Database, etc.)
- [ ] Author filters (Keboola, Community)
- [ ] "Most Popular" sort
- [ ] "CREATE CONFIGURATION" per component

### Configuration Listing
- [x] Config name, version, rows count, status, last change
- [x] Clickable rows navigate to detail
- [ ] "Data" column with "Show Data" link
- [ ] "Used In" column (flow references)
- [ ] "Last Use" column (last job run)
- [ ] Checkbox selection
- [ ] "ADD NEW CONFIGURATION" button

### Configuration Detail
- [x] Title, description, version, rows count, status, last changed
- [x] Rows table with Name, Source, Destination, Load Options, Status
- [x] Clickable rows to row detail
- [x] Configuration JSON view
- [ ] Sub-tabs: Information & Settings | Notifications | Versions
- [ ] **Sidebar panel:**
  - [ ] RUN COMPONENT button (green)
  - [ ] Parallel jobs toggle
  - [ ] Timeout setting
  - [ ] Database credentials
  - [ ] Copy configuration
  - [ ] Automate (schedule)
  - [ ] Automatic data types toggle
  - [ ] Debug mode
  - [ ] Delete configuration
  - [ ] Last Use section
  - [ ] Versions section with "See Latest Changes"
- [ ] "+ NEW TABLE" / "+ IMPORT TABLES" buttons
- [ ] Search + Enabled/Disabled filter on rows
- [ ] Component metadata: Type, Author, Used in, Data, Documentation link

### Configuration Row Detail
- [x] Row name, ID, status
- [x] Row Configuration JSON
- [x] Row State JSON
- [x] Back to Configuration button
- [ ] Row editing form (schema-driven)
- [ ] Input/Output mapping editor

---

## 5. FLOWS

- [-] Flow listing (shows orchestrator configs, but as basic table)
- [ ] Search with count
- [ ] Filter pills: ALL | SCHEDULED | NOT SCHEDULED | FAILED | NO CONFIGURATION
- [ ] Schedule column
- [ ] Run Results column
- [ ] Last Use column
- [ ] DISABLED badge per flow
- [ ] "+ CREATE FOLDER" / "+ CREATE FLOW" buttons
- [ ] Flow detail with visual builder (DAG phases + tasks)
- [ ] Flow sub-tabs: Builder | All Runs | Schedules | Notifications | Versions
- [ ] "RUN FLOW" button with dropdown
- [ ] Phase/task management in builder

---

## 6. TRANSFORMATIONS

- [x] Transformation component listing (grouped)
- [ ] Transformation-specific listing (folders + transformations)
- [ ] Search with counts
- [ ] Backend Size column
- [ ] Data / Used In / Last Use columns
- [ ] "+ CREATE FOLDER" / "+ CREATE TRANSFORMATION" buttons
- [ ] Transformation detail:
  - [ ] Table Input Mapping editor (Source > Input table)
  - [ ] Table Output Mapping editor (Output > Destination)
  - [ ] Queries section with "EDIT ALL QUERIES" button
  - [ ] SQL/Python code editor
  - [ ] Workspace integration (create/copy workspace)
  - [ ] Sidebar: RUN, timeout, query timeout, copy, automate, debug, delete

### Shared Code
- [ ] Shared Code listing
- [ ] "Used by" column
- [ ] "+ CREATE SHARED CODE" button

---

## 7. JOBS / QUEUE

### Job Listing
- [x] Job list with ID, Component, Status, Duration, Created
- [x] Status filter pills
- [x] Search
- [x] Auto-refresh
- [ ] Multi-filter dropdowns: Status, User, Component, Configuration, Time Range, Duration
- [ ] Job ID / Run ID filter
- [ ] Row filter
- [ ] Component type badges (Data Source, Transformation, Flow)
- [ ] Configuration name + version in listing
- [ ] User avatar per job

### Job Detail
- [x] Job ID, Status, Component, Config, Mode
- [x] Created, Start, End times, Duration
- [x] Token/initiator info
- [x] Result JSON
- [ ] Duration comparison to average (circular indicator)
- [ ] Parameters & Results card with "Show All"
- [ ] Input/Output Mapping card (tables with stage badges)
- [ ] All Runs chart (historical bar chart)
- [ ] Log/Events section with search
- [ ] Run ID button (link to parent run)
- [ ] Configuration version link

---

## 8. SETTINGS

### Project
- [x] Stack URL, Project name, Token info
- [x] Token permissions (Master, Manage Buckets, etc.)
- [x] Project features list
- [ ] Organization link
- [ ] Project type, region, expiration
- [ ] Data Takeout
- [ ] Workspace Data Persistency toggle
- [ ] Delete Project button

### Users
- [ ] User listing (name, email, role, MFA, joined, expires)
- [ ] Invite User button

### API Tokens
- [ ] Token listing (description, created, refreshed, expires, permissions)
- [ ] Create New Token button
- [ ] Token permission editing

### Other Settings Tabs
- [ ] CLI Sync
- [ ] Features
- [ ] AI Rules
- [ ] Kai Assistant settings
- [ ] MCP Server settings

---

## 9. MISSING PAGES (not in kbc-ui-next at all)

### Data Apps
- [ ] Data Apps listing
- [ ] Create Data App

### Data Catalog
- [ ] "Shared with you" tab (linked buckets from other projects)
- [ ] "Shared from this project" tab
- [ ] Share Bucket button

### Workspaces
- [ ] Workspace listing (Snowflake, Python, R)
- [ ] Create Workspace
- [ ] Workspace status (Active/Inactive)
- [ ] Workspace sharing

### SQL Editor
- [ ] SQL query editor
- [ ] Query execution
- [ ] Results display

### Chat / KAI Assistant
- [ ] AI chat interface
- [ ] Job debugging
- [ ] Data exploration
- [ ] Transformation building

### Trash / Recently Deleted
- [ ] Deleted configs listing
- [ ] Restore / permanent delete
- [ ] Empty Trash button

### Dev Branches
- [ ] Branch listing
- [ ] Create branch
- [ ] Branch-aware navigation

---

## 10. CROSS-CUTTING FEATURES

- [ ] Global search (configs, storage, projects)
- [ ] Keyboard shortcuts / hotkeys
- [ ] Breadcrumb navigation
- [ ] Edit-in-place (titles, descriptions)
- [ ] Bulk operations (checkbox + action bar)
- [ ] Version history / rollback on configs
- [ ] Notifications system (toast messages)
- [ ] Schedule management (cron expressions)
- [ ] OAuth flow for external services
- [ ] Copy/duplicate configurations
- [ ] Schema-driven form editor (JSON Schema -> UI form)
- [ ] Real-time job status updates
- [ ] Branch-aware API calls
- [ ] User permissions / role-based access

---

## Priority Matrix

### P0 - Core functionality (must have for usability)
1. Run Component / Run Flow buttons
2. Create Configuration / Create Bucket
3. Configuration editing (schema-driven forms)
4. Table Data Sample preview
5. Global search
6. Version history

### P1 - Important for daily use
7. Flow builder (visual DAG)
8. Transformation SQL editor
9. Input/Output mapping editors
10. Job detail with logs/events
11. Users & API Tokens management
12. Scheduling / Automate

### P2 - Power features
13. Data Catalog (shared buckets)
14. Workspaces
15. Dev branches
16. Data Apps
17. SQL Editor
18. Trash / restore

### P3 - Nice to have
19. KAI AI Assistant
20. Data Streams
21. Keyboard hotkeys
22. Activity feed on dashboard
