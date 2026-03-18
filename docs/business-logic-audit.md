# Business Logic Audit

Tracking frontend business logic that should ideally live in the API.
Items discovered during the greenfield rewrite of kbc-ui.

## Format

| Module | Logic | Description | Severity | API Alternative |
|--------|-------|-------------|----------|----------------|

## Discovered Items

<!-- Add items as they are discovered during the rewrite -->

| Module | Logic | Description | Severity | API Alternative |
|--------|-------|-------------|----------|----------------|
| storage | Bucket/table filtering | Complex multi-level filtering with reduce chains over Immutable.js structures. 66 lines of filter logic in helpers.ts | Medium | Server-side filtering params on /v2/storage/tables |
| components | InstalledComponentsStore | Central god-store with 27.8K LOC managing all component configs, performing merges and transformations | High | API should return ready-to-use data structures |
| configurations | Version diffing | Frontend computes diffs between configuration versions | Medium | API could provide diff endpoint |
| flows | Phase/task ordering | Complex DAG ordering logic for flow phases | High | Flow execution order should be API-driven |
| storage | Data profiling display | Frontend computes column statistics from preview data | Low | Data profiling API endpoint |
| transformations | Block/code disable | API schema only allows `name` + `script` on blocks[].codes[]. No native disable flag. We comment out SQL with `-- [DISABLED BY KBC-UI]` marker and store output mappings as `-- [KBC-UI-OUTPUT] {json}` inside the commented script. Works but fragile — if user edits raw JSON and removes markers, output mappings are lost. | High | API should support `disabled: boolean` on blocks and codes, and runner should skip disabled entries. Output mapping disable should also be API-native. |
| transformations | Output mapping disable | When disabling a SQL block that creates tables, we remove affected output mappings from `storage.output.tables` and embed them as JSON comments in the disabled script. On re-enable we parse and restore them. This is a reversible hack but the source of truth is a SQL comment, not a proper data field. | High | API should support `disabled` flag on output mapping entries, or a separate disabled mappings store. |

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
