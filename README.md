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
- Set `VITE_STACK_URL` and `VITE_STORAGE_TOKEN` in `.env.local` (auto-fills the connect form)
- Enter them manually on the connect page at startup

## Available Pages

| Page | URL | Description |
|------|-----|-------------|
| Connect | `/` | Enter stack URL and API token |
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
