# Business Logic Audit

Tracking frontend business logic in **this UI (kbc-ui-next)** that should ideally live in the API.
Only items that exist in our codebase — not legacy kbc-ui issues.

## Discovered Items

| Module | Logic | Description | Severity | API Alternative |
|--------|-------|-------------|----------|----------------|
| storage | Bucket filtering | Client-side filtering by stage (in/out), linked, shared. Simple but could be server-side. `src/pages/storage/BucketsPage.tsx` | Low | Server-side filtering params on `/v2/storage/buckets` |
| flows | Phase/task DAG ordering | FlowBuilder computes DAG layout from `dependsOn` arrays. FlowEditor manages phase ordering. `src/components/FlowBuilder.tsx`, `FlowEditor.tsx` | Medium | Flow execution order and visualization hints could be API-driven |
| transformations | Block/code disable | No native `disabled` flag in API schema. We comment out SQL with markers. See Active Hacks below. `src/components/TransformationBlocks.tsx` | High | API should support `disabled: boolean` on blocks and codes |
| transformations | Output mapping disable | We remove output mappings from config and embed them as JSON comments in disabled SQL. See Active Hacks below. `src/components/TransformationBlocks.tsx` | High | API should support `disabled` flag on output mapping entries |
| transformations | Dependency analysis | `analyzeDisableImpact()` parses SQL to find CREATE TABLE / FROM / JOIN to detect cross-block dependencies. `src/components/TransformationBlocks.tsx` | Low | Acceptable frontend logic — SQL parsing for UX hints |
| transformations | SQL statement splitting | `splitStatements()` splits SQL by `;` respecting quotes/comments for Keboola runner. `src/components/TransformationBlocks.tsx` | Medium | Runner could accept full SQL text and split server-side |
| transformations | Output mapping suggestions | `extractCreatedTables()` parses CREATE TABLE from SQL to suggest output mapping sources. `src/components/MappingEditor.tsx` | Low | Acceptable frontend logic — UX convenience |
| events | Master token requirement | Storage events API only returns events created by the same token. Tokens created via Management API are not master tokens — they can't see events from other tokens (jobs, schedulers, etc.). Legacy UI uses SSO master token. Our org-setup tokens miss all historical and job events. | High | Management API should support creating master tokens, or events API should respect `canReadAllFileUploads` for cross-token event access |

## Notes

- Items marked "High" are candidates for backend feature requests
- Items marked "Medium" can be temporarily reimplemented but should be flagged
- Items marked "Low" are acceptable frontend logic

## Active Hacks

These are workarounds where we implemented functionality in the UI that should be in the API. They work but are inherently fragile.

### 1. SQL Block Disable (comment-based)

**Problem**: Keboola transformation config schema validates `blocks[].codes[]` strictly — only `name` and `script` allowed. No `disabled` field. `parameters` also strict — only `blocks` and `query_timeout`.

**Hack**: We comment out the SQL with `-- [DISABLED BY KBC-UI]` prefix on each line. Runner sees comments as NOP and skips execution. UI detects the marker and renders the block as disabled (with original code visible after stripping comments).

**Risks**:
- If user edits the raw JSON config and removes/modifies the marker comment, UI loses track of disabled state
- Nested `--` comments in the original SQL get double-prefixed (`-- -- comment`) — works but ugly
- No server-side awareness — API, CLI, and other UIs don't know about disabled blocks

**Proper fix**: API should add optional `disabled: boolean` to the blocks/codes schema. Runner should skip entries where `disabled: true`.

### 2. Output Mapping Disable (embedded JSON comment)

**Problem**: When a SQL block is disabled, its `CREATE TABLE` statements won't run, so output mappings referencing those tables will fail. We need to temporarily remove output mappings but preserve them for re-enable.

**Hack**: On disable, we remove affected entries from `storage.output.tables` and embed them as `-- [KBC-UI-OUTPUT] {"source":"x","destination":"y"}` comments inside the disabled script. On re-enable, we parse these markers and add the mappings back.

**Risks**:
- Output mapping data lives in a SQL comment — not a proper data store
- If user modifies the disabled script and removes the marker line, mappings are lost forever
- `incremental`, `primary_key`, `delete_where_*` and other output mapping properties must be preserved in the JSON — any schema changes to output mappings could break parsing

**Proper fix**: API should support `disabled` flag on `storage.output.tables[]` entries, or provide a separate disabled mappings endpoint.
