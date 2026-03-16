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

## Notes

- Items marked "High" are candidates for backend feature requests
- Items marked "Medium" can be temporarily reimplemented but should be flagged
- Items marked "Low" are acceptable frontend logic
