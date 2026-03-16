# kbc-ui-next

Greenfield rewrite of the Keboola Connection UI. Feature parity target with the legacy kbc-ui (251K LOC) in ~15K LOC.

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
- **Tailwind CSS v4** (utility-first styling)
- **Vite 6** (bundler)

## Architecture Rules

1. **No Flux, no Immutable.js** - ever. TanStack Query for server state, Zustand for UI state.
2. **No local copies of server data** - always fetch via TanStack Query hooks. Mutations invalidate queries.
3. **Plain JS objects** - no Immutable.Map/List. TypeScript types provide safety.
4. **Schema-driven connectors** - one generic ConfigurationPage for all extractors/writers.
5. **API client is a thin fetch wrapper** - no abstractions beyond what's needed.
6. **Co-locate by feature** - pages/storage/ has everything for the storage feature.

## Commands

```bash
npm run dev          # Dev server on http://localhost:5173
npm run build        # Production build
npm run type-check   # TypeScript check
npm run lint         # Lint with oxlint
```

## API Connection

The app connects to a real Keboola stack. User provides:
- Stack URL (e.g., `https://connection.north-europe.azure.keboola.com`)
- Storage API Token

Auth header: `X-StorageApi-Token: {token}`
Base URL pattern: `{stackUrl}/v2/storage/...`

## Reference

The legacy codebase at `/Users/padak/github/kbc-ui/` serves as a reference for:
- UX flows and user journeys
- Business logic that lives on the frontend
- API call patterns and edge cases

Architecture docs: `/Users/padak/github/kbc-ui/docs/architecture/`

## Business Logic Audit

Frontend business logic (logic that should ideally be in the API) is tracked in `docs/business-logic-audit.md`.
