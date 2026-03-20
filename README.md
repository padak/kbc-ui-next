# kbc-ui-next

Greenfield rewrite of the Keboola Connection UI.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure connection (optional - can also be done in the UI)
cp .env.example .env.local
# Edit .env.local with your stack URL and Storage API token

# 3. Start dev server
npm run dev

# 4. Open http://localhost:5173
```

## Connection

The app connects directly to a Keboola stack. You need:

- **Stack URL** - e.g., `https://connection.keboola.com` or `https://connection.north-europe.azure.keboola.com`
- **Storage API Token** - get one from your project settings in the current Keboola UI

You can either:
- **Organization setup** (`/setup`) - Use a Management API token to discover and register all projects in an organization. Tokens are created automatically and saved to `projects.secret.json`.
- Set `VITE_STACK_URL` and `VITE_STORAGE_TOKEN` in `.env.local` (auto-fills the connect form)
- Enter them manually on the connect page at startup

### Security Note

`projects.secret.json` contains Storage API tokens and is gitignored. Never commit this file. The Management API token used during setup is never written to disk - it is only held in memory for the duration of the setup session.

## Features

### Multi-Project Support
Connect 20-50 projects across organizations. Switch projects instantly with full cache isolation. Global search (Cmd+K) across all projects' buckets, components, and configs. Org dashboard with aggregate stats.

### Transformation Editor
Full-featured SQL editor for Snowflake, Python, and other transformation types:
- **Phase/Block structure** — code organized into phases and blocks, matching the Keboola execution model
- **SQL syntax highlighting** — CodeMirror 6 with one-dark theme, bracket matching, line numbers
- **Table autocomplete** — suggests input mapping aliases, storage tables (direct query), and columns
- **Inline editing** — edit SQL directly in each block with Save/Cancel
- **Disable/Enable blocks** — temporarily skip blocks during execution without deleting code. Impact analysis shows which tables won't be created, which blocks will fail, and which output mappings are affected. Disabled output mappings are stored and automatically restored on re-enable.
- **Add/Remove/Rename** — create new phases and blocks, delete or rename existing ones
- **Copy All SQL** — copies all active (non-disabled) SQL to clipboard

### Flow Builder
Visual DAG editor for orchestration flows using @xyflow/react with automatic ELK layout. Add/remove phases and tasks, export as Mermaid or text for AI context.

### Schema-Driven Config Editor
Generic JSON Schema to form renderer for all component configurations. Supports nested objects, arrays, enums, passwords, and toggles between form and raw JSON views.

### Storage Browser
Browse buckets and tables with metadata, column details, data preview. Filter by stage (in/out), linked/shared status. Shared buckets show source project with one-click navigation.

### Markdown Documentation
Configuration descriptions render as rich Markdown with full GFM support:
- **Fullscreen reader** — click any description to open a responsive modal with prose typography
- **Mermaid diagrams** — fenced `mermaid` code blocks render as interactive SVG diagrams (lazy-loaded)
- **GFM tables** — pipe tables render as styled HTML tables via remark-gfm
- **Code blocks** — language-tagged blocks get dark theme, plain blocks get light theme
- **Copy context for AI** — one-click copies configuration context (JSON, rows, component info) to clipboard for AI-assisted documentation drafting
- **Inline editor** — Write/Preview/Side-by-side modes with toolbar (bold, italic, heading, link, code, mermaid template)

### Design System
Keboola Product Design System from Figma with 10 color palettes, Inter typography, and component tokens. Toggle between default and branded theme at runtime.

## Available Pages

| Page | URL | Description |
|------|-----|-------------|
| Connect | `/` | Enter stack URL and API token |
| Setup | `/setup` | Manage organizations and projects |
| Dashboard | `/dashboard` | Project overview with stats and recent jobs |
| Storage | `/storage` | Browse buckets and tables |
| Bucket Detail | `/storage/:bucketId` | Tables in a specific bucket |
| Table Detail | `/storage/:bucketId/:tableId` | Columns, metadata, stats |
| Components | `/components` | All components grouped by type |
| Configurations | `/components/:componentId` | Configs for a component |
| Config Detail | `/components/:componentId/:configId` | JSON config, rows |
| Flows | `/flows` | Orchestration flows |
| Transformations | `/transformations` | Transformation components |
| Jobs | `/jobs` | Job history with status filters |
| Settings | `/settings` | Token info, permissions, features |

## Tech Stack

- React 19, TypeScript (strict), Vite 6
- TanStack Query v5 (server state)
- Zustand v5 (UI state only)
- Tailwind CSS v4
- React Router 7

## Commands

```bash
npm run dev          # Dev server on http://localhost:5173
npm run build        # Production build to dist/
npm run preview      # Preview production build
npm run type-check   # TypeScript type checking
```

## Architecture

```
src/
├── api/           # Thin fetch wrappers for Keboola APIs
├── hooks/         # TanStack Query hooks (all data fetching)
├── stores/        # Zustand stores (UI state only)
├── components/    # Shared reusable components
├── pages/         # Route page components
├── lib/           # Constants, formatters, utilities
├── App.tsx        # Router and providers
└── main.tsx       # Entry point
```

Key principles:
- No local copies of server data - TanStack Query is the single source of truth
- API client is a thin fetch wrapper with `X-StorageApi-Token` auth
- Generic components (DataTable, StatusBadge) serve all pages
- File headers describe each file's purpose (first 5 lines)
