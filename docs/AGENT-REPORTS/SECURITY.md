# Security Review — kbc-ui-next

**Date:** 2026-03-20
**Scope:** Full codebase (`src/`), `vite.config.ts`, `index.html`, `.gitignore`
**Reviewer:** Security Agent (claude-sonnet-4-6)

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

## Dependency Vulnerabilities

`npm audit` returned **0 vulnerabilities** across 491 packages.

| Package | Current | Vulnerable | CVE | Severity | Safe Version |
|---------|---------|------------|-----|----------|--------------|
| — | — | No | — | — | — |

---

## Findings

### CRITICAL

None found.

---

### HIGH

#### H1 — XSS via Unvalidated `href` in MarkdownViewer (CWE-79)

**File:** `src/components/MarkdownViewer.tsx:42-51`

**Description:**
The custom `a` component in `MarkdownViewer` passes `href` from the parsed Markdown AST directly to the DOM without any URL scheme validation:

```tsx
a: ({ children, href, ...props }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" ...>
```

If a user-authored description contains a `[click me](javascript:alert(1))` link, `react-markdown` will emit that raw `href` value. `react-markdown` v10 does NOT strip `javascript:` URIs by default — it only prevents rendering raw HTML blocks. This means stored XSS is possible anywhere a user can write a Markdown description (configuration docs, etc.).

**Exploitation path:** Attacker edits a configuration description via the Keboola API → victims open the description → `javascript:` link executes in their browser context, stealing their Storage API token from `localStorage`.

**Fix:** Add a URL allowlist inside the `a` component:

```tsx
a: ({ children, href, ...props }) => {
  const safe = href && /^https?:\/\//i.test(href) ? href : undefined;
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer" ...>
      {children}
    </a>
  );
},
```

Alternatively, add `rehype-sanitize` as a remarkPlugins entry.

---

#### H2 — Storage API Token Persisted in `localStorage` (CWE-312)

**Files:**
- `src/stores/connection.ts:97-107` — `persistProjects()` writes full `ProjectEntry[]` (including tokens) to `localStorage`
- `src/stores/connection.ts:105-106` — additionally persists legacy `kbc_storage_token` key

**Description:**
All Storage API tokens for all configured projects are stored in `localStorage` in plaintext:

```ts
localStorage.setItem(STORAGE_KEY.PROJECTS, JSON.stringify(projects)); // contains tokens
localStorage.setItem(STORAGE_KEY.TOKEN, active.token);                // legacy copy
```

`localStorage` is accessible to any JavaScript running on the same origin, including via XSS. It is also accessible through browser developer tools and, in some threat models, through browser extension content scripts with `storage` permission.

**Scope of impact:** Given this is a power-user tool for Keboola project management, the stored tokens likely have `canManageBuckets`, `canManageTokens`, and potentially `isMasterToken` permissions (visible in `SettingsPage.tsx:59-74`). Compromise of these tokens allows an attacker to read/write all data in all configured projects.

**Fix options (in order of preference):**
1. **sessionStorage only** — move token storage to `sessionStorage`. Tokens survive page reload within a tab but are cleared when the tab closes. Breaks the "remember me" UX.
2. **Encrypt before storing** — use `SubtleCrypto` with a key derived from a user PIN or passphrase. Significant UX change.
3. **Minimum scope:** Remove the redundant legacy `kbc_storage_token` key (lines 105-106) since `kbc_projects` already contains the token. Reduces duplicate exposure surface.
4. **Accept risk with documentation** — if this tool is explicitly intended only for trusted local environments (developer machines), document this assumption prominently in the README.

Note: `projects.secret.json` on disk is a similar risk but is correctly in `.gitignore` and is only read by the Vite dev server; it is not copied to `dist/`.

---

### MEDIUM

#### M1 — `projects.secret.json` Served Publicly Over HTTP (CWE-552)

**File:** `src/lib/projectConfig.ts:37`

```ts
const response = await fetch('/projects.secret.json');
```

**Description:**
The file `projects.secret.json` is fetched via a plain HTTP GET from `/`. In development this works because Vite serves the project root. If the production deployment copies this file into `dist/` (e.g., via a naive `cp -r . dist/` in a CI script), it would be publicly accessible at `https://your-host/projects.secret.json` — exposing all Storage API tokens for all configured projects.

**Current state:** The file is not present in `dist/` in the current build (`ls dist/` shows only `index.html` and `assets/`). However, the fetch pattern creates a latent deployment risk.

**Fix:**
1. Add a comment in `vite.config.ts` and in the README that `projects.secret.json` must NEVER be deployed.
2. Add `projects.secret.json` to a `.deployignore` / `.dockerignore` if containerization is used.
3. In production, use `VITE_PROJECTS` env var instead — these are baked into the bundle at build time and do not require a runtime file fetch. (Note: this trades runtime exposure for build-time secrets leaking into the bundle — see M2.)

---

#### M2 — `VITE_*` Env Vars Bake Secrets into Production JS Bundle (CWE-312)

**Files:**
- `src/lib/projectLoader.ts:92,105-106`
- `src/pages/ConnectPage.tsx:29-30`
- `.env.example` — documents `VITE_STORAGE_TOKEN`

**Description:**
Any value set in `VITE_STORAGE_TOKEN` or `VITE_PROJECTS` is inlined verbatim into the Vite production bundle at build time (`dist/assets/index-*.js`). Unlike server-side secrets, these are visible to anyone who can fetch the JS file.

The `.env.example` file explicitly documents `VITE_STORAGE_TOKEN=your-storage-api-token` — suggesting users should place real tokens there.

**Fix:**
- Document clearly in `README` and `.env.example` that `VITE_STORAGE_TOKEN` / `VITE_PROJECTS` should only be used for **local development** and must never be set in production deployments.
- Add a startup check: if `import.meta.env.PROD && import.meta.env.VITE_STORAGE_TOKEN`, warn or throw.

---

#### M3 — `/__save-projects` CSRF Protection Insufficient for Non-SameSite Deployments

**File:** `vite.config.ts:22-29`

```ts
const origin = req.headers['origin'] ?? req.headers['referer'] ?? '';
const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(origin);
```

**Description:**
The Vite dev-server middleware at `/__save-projects` (which writes `projects.secret.json` to disk) gates on whether `Origin` or `Referer` headers indicate localhost. This is a reasonable protection for the intended use case (local dev only).

However, two weaknesses exist:
1. The regex accepts `http://` (not just `https://`) from localhost, which is correct for dev but noted for completeness.
2. If an attacker can get the Vite dev server exposed on a LAN/internet interface (e.g., via `vite --host 0.0.0.0`), a CSRF from a page on a different origin could forge the `Referer` header in some browser environments or use a server-side request (the Origin check does NOT apply to same-site requests without CORS).
3. The body content is a raw JSON object parsed without a schema, allowing injection of arbitrary data into `projects.secret.json`.

**Fix:** Add Zod validation of the parsed `data` body against the `ProjectConfig` schema before writing it to disk. The origin check is adequate as-is given the dev-only intent, but should be combined with schema validation:

```ts
import { ProjectConfigSchema } from '@/lib/projectConfig'; // define a Zod schema
const parsed = ProjectConfigSchema.safeParse(data);
if (!parsed.success) { res.statusCode = 400; res.end('Invalid config'); return; }
await writeFile(..., JSON.stringify(parsed.data, null, 2));
```

---

#### M4 — `KeboolaValidationError` Logs Full cURL Command with Masked Token to Browser Console (CWE-532)

**File:** `src/api/client.ts:133-136`

```ts
console.error('[Keboola] Validation failed for', path, result.error.issues);
console.error('[Keboola] Debug:', curl); // curl includes masked token
```

**Description:**
On any Zod validation failure, a cURL command is printed to the browser console. The token is masked to its last 4 characters (`****XXXX`), which for short tokens (Keboola tokens are ~32 chars) reduces but does not eliminate entropy. More importantly, the endpoint URL, request path, and partial token are visible in the developer console — and in some cases, in browser crash reports or third-party monitoring tools that capture console output.

`KeboolaValidationError` also stores `this.curlCommand` and `this.rawData` as properties on the thrown Error object. If this Error propagates to a logging service (e.g., Sentry), the raw API response and curl command are included.

**Fix:**
1. Remove `console.error('[Keboola] Debug:', curl)` from production builds: guard with `if (import.meta.env.DEV)`.
2. Do not store `rawData` on the Error in production.

---

#### M5 — Event Detail "Copy+Detail" Includes `token` Field From API (CWE-359)

**File:** `src/components/EventsViewer.tsx:39, 167`

```ts
if (e.token) detail.token = e.token;
```

**Description:**
Keboola events returned by the Storage API include a `token` field (the token that triggered the event). This field is included in the expanded event detail view and in clipboard copy via "Copy+Detail". While this is the same token the user is already authenticated with, it serializes the token into clipboard content and could be captured by a clipboard-sniffing extension or paste target.

`maskSensitiveData()` (line 145-148) only masks JWT/Bearer Authorization headers in event _messages_, not the structured `token` field in event details.

**Fix:** Mask or omit the `token` field from `detail` when building event detail JSON. At minimum, apply the same last-4-chars masking as `buildCurlCommand()`:

```ts
if (e.token) detail.token = { description: e.token.description, id: '[REDACTED]' };
```

---

### LOW

#### L1 — No Content Security Policy Header (CWE-16)

**File:** `index.html` (and `dist/index.html`)

**Description:**
The application has no `Content-Security-Policy` meta tag or server header. Without a CSP:
- Any injected script (via XSS) executes without restriction.
- `eval()` and `new Function()` are permitted (though not used by app code, Mermaid and some bundled libs may use them internally).
- The fallback protection against XSS (finding H1) is entirely absent.

**Fix:** Add a `<meta http-equiv="Content-Security-Policy">` in `index.html`. Given the app uses Mermaid (which requires `unsafe-eval` or `wasm-unsafe-eval`) and inline styles (Tailwind), the minimal starting point is:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://*.keboola.com https://*.azure.keboola.com https://*.gcp.keboola.com;
  img-src 'self' data:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
">
```

The `connect-src` directive limits API calls to Keboola domains, providing meaningful protection even if XSS occurs.

---

#### L2 — Missing X-Frame-Options / Clickjacking Protection (CWE-1021)

**File:** `index.html`

**Description:**
No `X-Frame-Options` or `frame-ancestors` CSP directive is set. The app could be embedded in an `<iframe>` by an attacker for clickjacking attacks. Since the app manages API tokens and runs mutations (create/delete tokens, run jobs), clickjacking is a meaningful risk.

**Fix:** Add to `index.html` (or server headers):
```html
<meta http-equiv="X-Frame-Options" content="DENY">
```
Or include `frame-ancestors 'none'` in the CSP directive (L1).

---

#### L3 — `ErrorBoundary` Exposes Raw Error Message to UI (CWE-209)

**File:** `src/components/ErrorBoundary.tsx:40`

```tsx
<p className="mb-4 text-sm text-red-600">
  {this.state.error?.message || 'An unexpected error occurred.'}
</p>
```

**Description:**
`KeboolaValidationError` messages include the endpoint path, field names with unexpected values, and a cURL debug command. If such an error reaches the `ErrorBoundary`, the UI will display:

> `API response validation failed for /v2/storage/... Fields with issues: ... Debug with: curl -H "X-StorageApi-Token: ****abcd" "https://..."`

This leaks internal API paths and partial token values to any user visible at the screen.

**Fix:** Render only a generic fallback message unless `import.meta.env.DEV`. Check the error type before displaying:

```tsx
const displayMessage = this.state.error instanceof KeboolaValidationError
  ? 'API data format error — check the browser console for details.'
  : (this.state.error?.message ?? 'An unexpected error occurred.');
```

---

#### L4 — Mermaid `securityLevel: 'strict'` Relies on DOMPurify Availability (informational)

**File:** `src/components/MermaidDiagram.tsx:20`

**Description:**
`securityLevel: 'strict'` in Mermaid causes it to use a sandboxed iframe for rendering. The rendered SVG is then injected via `dangerouslySetInnerHTML`. Mermaid's strict mode is the correct setting. No action needed, but it is worth noting that `dangerouslySetInnerHTML` on SVG output from Mermaid is safe because: (a) Mermaid sanitizes the SVG using DOMPurify before returning it, (b) `securityLevel: 'strict'` is configured.

---

#### L5 — `VITE_STORAGE_TOKEN` Pre-fills Token Input Field in ConnectPage (CWE-312)

**File:** `src/pages/ConnectPage.tsx:30`

```ts
const [token, setToken] = useState(import.meta.env.VITE_STORAGE_TOKEN ?? '');
```

**Description:**
When a token is set via `VITE_STORAGE_TOKEN`, it is pre-filled in the visible password input field on the connect page. While the input is `type="password"` (masking display), the value is present in the DOM and React state before the user interacts with the page. This is a minor concern for screen-sharing scenarios.

**Fix:** This is acceptable for dev use. No change required for the intended local-developer use case.

---

## Summary

| ID | Severity | Area | Status |
|----|----------|------|--------|
| H1 | HIGH | XSS via `javascript:` href in MarkdownViewer | **Fixed** (URL scheme allowlist) |
| H2 | HIGH | Storage API tokens in localStorage | **Mitigated** (removed redundant legacy keys, documented trade-off) |
| M1 | MEDIUM | `projects.secret.json` served publicly — deployment risk | **Fixed** (`.dockerignore` added, documented) |
| M2 | MEDIUM | `VITE_*` tokens baked into production bundle | **Fixed** (runtime warning in production) |
| M3 | MEDIUM | `/__save-projects` missing body schema validation | **Fixed** (Zod schema validation) |
| M4 | MEDIUM | Debug cURL logs with token info in browser console | **Fixed** (DEV-only guard) |
| M5 | MEDIUM | Token field included in event detail clipboard copy | **Fixed** (token masked to name-only) |
| L1 | LOW | No Content Security Policy | **Fixed** (CSP meta tag in index.html) |
| L2 | LOW | No X-Frame-Options / clickjacking protection | **Fixed** (frame-ancestors 'none' in CSP) |
| L3 | LOW | ErrorBoundary exposes raw validation errors to UI | **Fixed** (generic message in production) |
| L4 | LOW | Mermaid securityLevel: strict — informational | Acceptable |
| L5 | LOW | VITE_STORAGE_TOKEN pre-fills token field | Acceptable for dev |

**Dependency vulnerabilities:** 0

---

## Recommendations

All recommendations have been addressed:

1. ~~**Immediately** fix H1 (javascript: href in MarkdownViewer)~~ — **Done** (v0.6.0)
2. ~~**This sprint** — fix M4, M3, L3~~ — **Done** (v0.6.0)
3. ~~**Before any public deployment** — resolve M1, M2, L1, L2~~ — **Done** (v0.6.0)
4. ~~**Ongoing** — evaluate localStorage token storage (H2)~~ — **Done** — accepted for local tool use case, documented in `CLAUDE.md` Security Rules

---

## Remediation History

- **2026-03-22** — All fixes applied in [PR #6](https://github.com/padak/kbc-ui-next/pull/6) (v0.6.0)
- Security rules codified in `CLAUDE.md` to prevent regressions
- 11 regression tests added in `src/security.test.tsx`
