# Security Audit Report - kbc-ui-next

**Date:** 2026-03-17
**Scope:** Full codebase review - /Users/padak/github/kbc-ui-next/src/, config files, package.json
**Application:** React 19 + TypeScript frontend (Keboola Cloud UI)
**Reviewer:** Security Agent (claude-sonnet-4-6)

---

## Executive Summary

The application manages API tokens for 30+ Keboola Cloud projects across multiple organizations. The
most critical finding is an active secrets leak: real Storage API tokens for production projects are
stored in `projects.secret.json` which is tracked in git on the local machine. These tokens should
be rotated immediately. Beyond credential exposure, the codebase has a systemic XSS vector via
unescaped component schema `description` fields rendered with `dangerouslySetInnerHTML`, and a
client-side SSRF-adjacent URL injection risk in the API URL derivation logic.

**Severity breakdown:**
- Critical: 1
- High: 2
- Medium: 3
- Low: 3
- Info: 4

---

## Security Review Checklist

- [x] Injection risks reviewed
- [x] Authentication/Authorization verified
- [x] Secrets handling reviewed
- [x] Dependency audit completed
- [x] Transport security verified
- [x] Logging practices checked
- [x] Concurrency issues reviewed
- [x] IaC and container configs analyzed

---

## Finding 1 - CRITICAL: Live API Tokens in projects.secret.json

**Severity:** Critical
**CWE:** CWE-312 (Cleartext Storage of Sensitive Information)
**File:** `/Users/padak/github/kbc-ui-next/projects.secret.json`

### Description

The file `projects.secret.json` contains 40+ real Keboola Storage API tokens across 4 organizations
and 3 Keboola stacks. These are production tokens for projects including "Internal Reporting",
"ENGG - SRE team", "Client Services", and "Product Team". The file exists on disk and is accessible
to anyone with read access to this machine.

While the file is correctly listed in `.gitignore`, the current state of `projects.secret.json` on
disk is populated with real credentials. The design assumes this is a developer local-only tool, but
the file itself is not encrypted, not permission-restricted, and any process running as this user
can read all tokens.

The `.gitignore` entry is correct and the file has not been committed to git history. However, the
flat-file credential storage model itself is a risk surface that should be acknowledged.

### Sample affected entries (do not commit this report to git)

Organization "Product Team - Test" (Azure EU stack): 6 project tokens
Organization "[Keboola] Internal Reporting" (GCP US stack): 33 project tokens
Organization "[Keboola] ENGG - SRE team" (AWS EU stack): 13 project tokens
Organization "[Keboola] Client Services" (GCP US stack): 2 project tokens

### Recommended Fix

1. **Rotate all tokens immediately** - every token in `projects.secret.json` should be revoked and
   recreated in the Keboola Management console.
2. Consider restricting file permissions: `chmod 600 projects.secret.json`
3. Document clearly that this file must never be shared, emailed, synced to cloud drives, or
   included in backups without encryption.
4. The `saveProjectConfig()` function in `src/lib/projectConfig.ts:39` writes this file via a Vite
   middleware endpoint (`/__save-projects`) with no authentication - see Finding 4.

---

## Finding 2 - HIGH: XSS via Unsanitized Schema Descriptions (dangerouslySetInnerHTML)

**Severity:** High
**CWE:** CWE-79 (Improper Neutralization of Input During Web Page Generation - Cross-site Scripting)
**File:** `/Users/padak/github/kbc-ui-next/src/components/SchemaForm.tsx`
**Lines:** 100, 127, 159, 179, 209, 245

### Description

The `SchemaForm` component renders the `description` field from component JSON schemas directly
into the DOM using `dangerouslySetInnerHTML`. The intent (documented in `CLAUDE.md`) is to render
HTML anchor tags from schema descriptions. However, the schema data comes from the Keboola Storage
API `/v2/storage/components` response, which is validated only by Zod using `.passthrough()` -
meaning extra fields including `description` are forwarded unmodified from the API without any
HTML sanitization.

```tsx
// src/components/SchemaForm.tsx:100
{description && <p ... dangerouslySetInnerHTML={{ __html: description }} />}
```

The schema's `description` value at line 100 comes from the `PropertySchema.description` field,
which originates from `ComponentSchema.configurationSchema` (schemas.ts line 128), typed as
`z.record(z.string(), z.unknown()).optional()` - completely unvalidated inner structure.

**Attack scenario:** If a Keboola component publisher (or a compromised component registry) were
to embed `<script>alert(1)</script>` or `<img src=x onerror=...>` in a schema description field,
it would execute in the user's browser with full access to localStorage (where tokens are stored).
This is more than theoretical - the Keboola component ecosystem has hundreds of third-party
components.

### Recommended Fix

Install and use DOMPurify to sanitize HTML before rendering:

```bash
npm install dompurify
npm install -D @types/dompurify
```

```tsx
import DOMPurify from 'dompurify';

// Replace all instances of:
dangerouslySetInnerHTML={{ __html: description }}

// With:
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(description, { ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong'], ALLOWED_ATTR: ['href', 'target'] }) }}
```

This preserves the `<a>` tag rendering intent while stripping script execution.

---

## Finding 3 - HIGH: API Tokens Stored in Unencrypted localStorage

**Severity:** High
**CWE:** CWE-312 (Cleartext Storage of Sensitive Information), CWE-922 (Insecure Storage of Sensitive Information)
**File:** `/Users/padak/github/kbc-ui-next/src/stores/connection.ts`
**Lines:** 97-106, 45-57

### Description

All API tokens for all registered projects are persisted in `localStorage` in cleartext, under
the keys `kbc_storage_token` (single project) and `kbc_projects` (all projects as JSON). The
`persistProjects` function stores the full `ProjectEntry` array including the `token` field for
each project:

```typescript
// connection.ts:97
localStorage.setItem(STORAGE_KEY.PROJECTS, JSON.stringify(projects));
// connection.ts:106
localStorage.setItem(STORAGE_KEY.TOKEN, active.token);
```

localStorage is accessible by any JavaScript on the same origin. Combinied with the XSS vector
in Finding 2, a successful XSS attack would immediately give the attacker all stored tokens,
potentially for 30+ projects across multiple organizations.

Additionally, localStorage persists indefinitely across browser sessions and is included in
some browser sync/backup features.

**Tokens stored:**
- `kbc_storage_token` - single active project token
- `kbc_projects` - full JSON array with ALL project tokens
- `kbc_stack_url` - stack URL (lower sensitivity)
- `kbc_active_project_id` - active project ID (lower sensitivity)

### Recommended Fix

For a power-user internal tool, this is an inherent trade-off (tokens must be accessible client-side
for API calls). The priority mitigation is to fix Finding 2 (XSS) to eliminate the attack vector
that would exfiltrate these tokens. Additionally:

1. Consider using `sessionStorage` instead of `localStorage` for tokens to prevent persistence
   across browser sessions (tokens would need re-entry after browser close).
2. At minimum, add a warning in the UI that tokens are stored locally and can be cleared from
   Settings.
3. Ensure the `disconnect()` function is prominently accessible - it does correctly clear all
   keys (lines 159-162).

---

## Finding 4 - MEDIUM: Unauthenticated File Write Endpoint (/__save-projects)

**Severity:** Medium
**CWE:** CWE-306 (Missing Authentication for Critical Function)
**File:** `/Users/padak/github/kbc-ui-next/vite.config.ts`
**Lines:** 12-43

### Description

The Vite dev server exposes a POST endpoint `/__save-projects` that writes arbitrary JSON to
`projects.secret.json` on disk. This endpoint has no authentication, no CSRF protection, and no
validation of the incoming JSON structure:

```typescript
// vite.config.ts:28-33
const data = JSON.parse(body);
const { writeFile } = await import('fs/promises');
await writeFile(
  resolve(__dirname, 'projects.secret.json'),
  JSON.stringify(data, null, 2),
);
```

While this endpoint only exists during `npm run dev` (the Vite development server), any website
or script running on the same machine could send a POST request to `http://localhost:5173/__save-projects`
and overwrite the credentials file with attacker-controlled content. Combined with the automatic
reconnection logic in `ConnectPage.tsx` that reads this file on startup, an attacker on the same
machine could substitute malicious tokens.

The missing method check beyond `!== 'POST'` and the complete absence of origin validation make
this endpoint a cross-origin write target.

### Recommended Fix

Add an origin check to restrict requests to the local app origin:

```typescript
server.middlewares.use('/__save-projects', async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method not allowed');
    return;
  }
  // Restrict to same-origin requests only
  const origin = req.headers['origin'] ?? req.headers['referer'] ?? '';
  if (origin && !origin.startsWith('http://localhost:5173')) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  // ... rest of handler
```

Also validate that the incoming JSON conforms to the `ProjectConfig` schema before writing.

---

## Finding 5 - MEDIUM: URL Injection in Service URL Derivation (Potential SSRF)

**Severity:** Medium
**CWE:** CWE-918 (Server-Side Request Forgery) - client-side analog
**File:** `/Users/padak/github/kbc-ui-next/src/api/client.ts`
**Lines:** 156, 201, 223

### Description

Service URLs for the Queue API and Scheduler API are derived by performing a simple string
replacement on the user-controlled `stackUrl`:

```typescript
// client.ts:156
const queueUrl = stackUrl.replace('connection.', 'queue.');

// client.ts:223
const serviceUrl = stackUrl.replace('connection.', `${serviceName}.`);
```

The `serviceName` parameter in `fetchServiceApi` comes from the callsite (`src/api/scheduler.ts:12`,
value `'scheduler'`), so it is not directly user-controlled in current code. However, `stackUrl` is
user-controllable - it comes from the `StackUrlPicker` component which accepts any URL input and
validates only that it passes `new URL()` parsing (StackUrlPicker.tsx:25).

If a user enters a crafted stack URL such as `https://evil.com/connection.`, the replacement
`stackUrl.replace('connection.', 'queue.')` would produce `https://evil.com/queue.` - sending the
bearer token to an attacker-controlled server. This effectively leaks all Storage API tokens.

The `.replace()` call only replaces the **first** occurrence of `connection.`, which mitigates
replacement-doubling attacks but does not prevent the base injection.

### Recommended Fix

Validate that `stackUrl` is a recognized Keboola stack URL before performing the substitution.
Add the validation to `persistProjects` or to the `connect` action:

```typescript
const KEBOOLA_STACK_PATTERN = /^https:\/\/connection\.[a-z0-9.-]+\.keboola\.com$/;

function validateStackUrl(url: string): void {
  if (!KEBOOLA_STACK_PATTERN.test(url)) {
    throw new Error(`Invalid Keboola stack URL: ${url}`);
  }
}
```

Apply this validation in `StackUrlPicker.handleAddCustom()` and in the `connect()` store action.

---

## Finding 6 - MEDIUM: Debug cURL Commands Logged to Browser Console (Token Partial Exposure)

**Severity:** Medium
**CWE:** CWE-532 (Insertion of Sensitive Information into Log File), CWE-312
**File:** `/Users/padak/github/kbc-ui-next/src/api/client.ts`
**Lines:** 119-120, 141, 163, 187, 207, 230

### Description

When a Zod schema validation fails, the API client logs a debug cURL command to the browser
console that includes a partially masked token:

```typescript
// client.ts:52-57
function buildCurlCommand(url: string, token: string): string {
  const maskedToken = token.length > 10
    ? `${token.substring(0, 6)}...${token.substring(token.length - 4)}`
    : '***';
  return `curl -s -H "X-StorageApi-Token: ${maskedToken}" "${url}" | python3 -m json.tool`;
}

// client.ts:119-120
console.error('[Keboola] Validation failed for', path, result.error.issues);
console.error('[Keboola] Debug:', curl);
```

While the masking does obscure the middle of the token, the first 6 and last 4 characters of each
token are logged. Keboola token format is `{projectId}-{adminId}-{secret}` - the visible prefix
leaks the project ID and admin ID. The `console.error` logs are visible to:
- Any installed browser extension with console access
- Anyone with DevTools access on the machine
- Any third-party monitoring scripts if they intercept console output

The `rawData` is also logged via `throw new KeboolaValidationError(path, result.error, data, curl)`
which stores the full API response in the exception object - this could contain sensitive project
configuration data.

### Recommended Fix

Remove `console.error` for validation errors in production. Use an environment gate:

```typescript
if (import.meta.env.DEV) {
  console.error('[Keboola] Validation failed for', path, result.error.issues);
  console.error('[Keboola] Debug:', curl);
}
```

Or better, use a structured logging utility that is stripped in production builds.

---

## Finding 7 - LOW: Vite Env Vars Bundle API Tokens into Client-Side JavaScript

**Severity:** Low
**CWE:** CWE-312 (Cleartext Storage of Sensitive Information)
**File:** `/Users/padak/github/kbc-ui-next/src/lib/projectLoader.ts` (lines 78, 91-92)
**File:** `/Users/padak/github/kbc-ui-next/src/pages/ConnectPage.tsx` (lines 23-24)

### Description

The application supports loading tokens from `VITE_STORAGE_TOKEN` and `VITE_PROJECTS` environment
variables. Because Vite inlines all `import.meta.env.VITE_*` values directly into the compiled
JavaScript bundle at build time, any token set in these env vars will be embedded in cleartext in
the production JS bundle (e.g., `dist/assets/index-xxxx.js`).

This is a well-known Vite security consideration: `VITE_*` vars are public and bundled. If a
developer accidentally sets `VITE_STORAGE_TOKEN=mytoken` and runs `npm run build`, the token
appears in the output bundle.

```typescript
// ConnectPage.tsx:23-24
const [stackUrl, setStackUrl] = useState(import.meta.env.VITE_STACK_URL ?? '');
const [token, setToken] = useState(import.meta.env.VITE_STORAGE_TOKEN ?? '');
```

Pre-populating a password input from an env var also means the token value is in the React state
tree before the user has interacted with the page.

### Recommended Fix

Add a comment in `.env.example` or README explicitly warning that `VITE_STORAGE_TOKEN` is for
local dev only and must never be set when building for any shared or deployed environment.
Consider removing the pre-population of the token input field:

```tsx
// ConnectPage.tsx - remove token pre-population in the input default state
const [token, setToken] = useState(''); // never pre-fill from env in UI
```

---

## Finding 8 - LOW: No Content Security Policy (CSP)

**Severity:** Low
**CWE:** CWE-1021 (Improper Restriction of Rendered UI Layers or Frames)
**File:** `/Users/padak/github/kbc-ui-next/index.html`

### Description

The `index.html` does not define a Content Security Policy meta tag, and the Vite config does not
configure CSP headers. Without CSP, any successful XSS attack (see Finding 2) can:
- Exfiltrate data to arbitrary external domains
- Load external scripts
- Create iframes

A CSP would have limited the damage from the XSS finding by blocking inline script execution and
restricting fetch targets to known Keboola domains.

### Recommended Fix

Add to `index.html`:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  connect-src 'self' https://*.keboola.com;
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  frame-ancestors 'none';
">
```

Note: `'unsafe-inline'` for styles is needed for Tailwind CSS class application. The `connect-src`
wildcard `*.keboola.com` covers all stack domains.

---

## Finding 9 - LOW: localStorage Not Cleared on Token Expiry / Session Timeout

**Severity:** Low
**CWE:** CWE-613 (Insufficient Session Expiration)
**File:** `/Users/padak/github/kbc-ui-next/src/stores/connection.ts`, `/Users/padak/github/kbc-ui-next/src/hooks/useAuth.ts`

### Description

When the app starts and a stored token is found in localStorage, the token is used to make API
calls without re-verifying it first (the auto-connect path in `ConnectPage.tsx:52-56` calls
`loadProjects()` → `projectLoader.ts:43` only for env-var-sourced tokens, not for
localStorage-hydrated projects). Stale/expired tokens from localStorage will cause API failures
but the localStorage entry is not cleaned up on 401 responses.

The `KeboolaApiError` with status 401 is thrown but there is no global error handler that would
call `disconnect()` and clear localStorage. Users would see repeated error messages.

### Recommended Fix

Add a global error handler in TanStack Query's `queryClient` configuration (App.tsx):

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      onError: (error) => {
        if (error instanceof KeboolaApiError && error.status === 401) {
          useConnectionStore.getState().disconnect();
        }
      },
    },
  },
});
```

---

## Finding 10 - INFO: ReactQueryDevtools Enabled in Production Builds

**Severity:** Info
**File:** `/Users/padak/github/kbc-ui-next/src/App.tsx`
**Line:** 65

### Description

`ReactQueryDevtools` is imported and rendered unconditionally:

```tsx
<ReactQueryDevtools initialIsOpen={false} />
```

The TanStack Query devtools panel exposes all cached query data and query keys in the browser. In
production, this includes all cached API responses (buckets, tables, component configurations).
By default, `@tanstack/react-query-devtools` v5 includes itself in production builds unless
conditionally imported.

### Recommended Fix

Gate the devtools on the dev environment:

```tsx
{import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
```

---

## Finding 11 - INFO: Missing input validation on stackUrl before API requests

**Severity:** Info
**CWE:** CWE-20 (Improper Input Validation)
**File:** `/Users/padak/github/kbc-ui-next/src/api/client.ts` (lines 113, 135, 157)

### Description

The `stackUrl` from the connection store is used directly in URL template strings without protocol
validation. While `isValidUrl()` (StackUrlPicker.tsx:24) checks that the URL parses, it does not
enforce HTTPS. A user entering `http://` instead of `https://` would send tokens over plaintext
HTTP.

### Recommended Fix

Enforce HTTPS in `persistProjects` or the `connect()` action:

```typescript
if (!stackUrl.startsWith('https://')) {
  throw new Error('Stack URL must use HTTPS');
}
```

---

## Finding 12 - INFO: No CSRF Protection on Mutations (Mitigated by Custom Header)

**Severity:** Info (Mitigated)
**CWE:** CWE-352 (Cross-Site Request Forgery)

### Description

The application makes state-changing API calls (POST/PUT/DELETE) using `fetch()` with a custom
`X-StorageApi-Token` header. Custom request headers are a standard CSRF mitigation because
cross-origin simple requests cannot set custom headers. This effectively prevents CSRF attacks
against the Keboola APIs. No additional CSRF tokens are needed.

**Status:** No action required. The custom header approach is the correct mitigation.

---

## Dependency Vulnerabilities

| Package | Current | CVE | Severity | Notes |
|---------|---------|-----|----------|-------|
| All deps | - | None | - | `npm audit` returned 0 vulnerabilities |

All direct and transitive dependencies are clean as of 2026-03-17. Dependency audit should be
re-run before each release.

---

## Recommendations

### Immediate (before sharing access to this machine or codebase)

1. **Rotate all API tokens** in `projects.secret.json` - 40+ tokens across 4 organizations must
   be revoked and recreated. Use the Keboola Management Console.
2. **Install DOMPurify** and apply sanitization to all 6 `dangerouslySetInnerHTML` usages in
   `SchemaForm.tsx`.

### This sprint

3. **Add origin validation** to the `/__save-projects` Vite middleware endpoint (vite.config.ts).
4. **Add stackUrl validation** to reject non-HTTPS and non-Keboola URLs before persisting.
5. **Gate ReactQueryDevtools** on `import.meta.env.DEV`.
6. **Gate debug console.error logs** on `import.meta.env.DEV` in api/client.ts.

### Backlog

7. Add a Content Security Policy meta tag in index.html.
8. Add a 401-interceptor in QueryClient to auto-disconnect on expired tokens.
9. Document that `VITE_STORAGE_TOKEN` must never be set in production/shared builds.

---

## Next Steps

1. Token rotation: use `manageApi.deleteToken()` (already implemented in SetupPage) for each
   token in `projects.secret.json`, then re-run the Setup flow to generate fresh ones.
2. For the XSS fix: `npm install dompurify @types/dompurify`, then update SchemaForm.tsx.
3. Cross-reference: no related agent reports exist yet for this codebase.
