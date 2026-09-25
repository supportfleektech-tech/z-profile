# PR #2 Post-Merge Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the lost PR #2 hardening pass on top of PR #1, preserving the existing demo architecture while adding authenticated trust boundaries, a scoped machine API, persistence migrations, backup/restore, session controls, expanded tests, and truthful documentation.

**Architecture:** Keep `server/index.mjs` as the composition root and extract substantial responsibilities into focused server modules. Reuse the existing bearer auth, scrypt password, SQLite database, shared TypeScript permission engine, and Vite proxy. Add security checks at the transport boundary, keep external integrations env-gated with simulation fallback, and keep the browser adapter available only when the backend is genuinely unavailable.

**Tech Stack:** Node.js >=22.5, Express 5, built-in `node:sqlite`, React 19, TypeScript 5.9, Vite 6, Tailwind 4, Vitest, ESLint 9, Prettier, jsdom smoke harnesses.

**Spec:** `docs/superpowers/specs/2026-09-25-pr2-hardening-design.md`

## Global Constraints

- Base all implementation on `origin/main` at `7261644`.
- Work on `arena/01a0cbfb-z-profile-pr2`.
- Preserve bearer-only authentication; never add `x-user-id` identity fallback.
- Preserve the 34-item pricing catalogue, proposal provenance, and 0–500-only pricing wiring.
- User-tier requests may access only their own wallet, checkout, usage, and sessions.
- `balance` is never writable through the wallet settings route.
- Daraja and Spin simulation remain available when external credentials are absent; live mode is env-gated.
- API responses must not expose passwords, API secrets, provider credentials, callback secrets, or auth secrets.
- Use existing component, context, service, permission, and SQLite patterns; do not add a second state-management system.
- Final verification must exit 0 through `npm run verify` with 85 unit tests and smoke counts API 114, DOM 44, flows 64, traceability 96.
- Before pushing, squash the implementation work into one commit on the PR branch so the PR does not include the design-only commit separately.

---

### Task 1: Establish the test, lint, and formatting baseline

**Files:**
- Modify: `package.json`
- Create: `eslint.config.js`
- Create: `.prettierrc`
- Create: `tests/unit/engines.test.ts`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

**Interfaces:**
- Produces `npm run lint`, `npm run test:unit`, and `npm run format` scripts.
- Produces Vitest tests for existing exported functions in `src/auth/permissions.ts`, pricing helpers, `src/lib/format.ts`, `server/ratelimit.mjs`, `server/passwords.mjs`, and `server/spin.mjs`.
- Consumes the existing ESM package type and Node >=22.5 runtime.

- [ ] **Step 1: Add failing unit tests for existing engines.**

Create `tests/unit/engines.test.ts` with named cases for:

```ts
import { describe, expect, it } from 'vitest';
import { effectivePermissions } from '../../src/auth/permissions';
import { estimateCost } from '../../src/data/pricing';
import { KES, normalizeMsisdn } from '../../src/lib/format';
import { hashPassword, verifyPassword } from '../../server/passwords.mjs';

describe('permission tiers', () => {
  it('gives super_admin every permission', () => {
    const user = { id: 's', tier: 'super_admin', subRole: 'analyst', permissionOverrides: {} } as never;
    expect(effectivePermissions(user).has('pricing.edit')).toBe(true);
    expect(effectivePermissions(user).has('maintenance.toggle')).toBe(true);
  });
  it('does not give admin pricing.edit', () => {
    const user = { id: 'a', tier: 'admin', permissionOverrides: {} } as never;
    expect(effectivePermissions(user).has('pricing.edit')).toBe(false);
  });
});

describe('pricing and format helpers', () => {
  it('estimates the configured catalogue basket', () => {
    expect(estimateCost(['identity-verification', 'utility-compliance'])).toBe(50);
  });
  it('normalizes Kenyan phone numbers', () => {
    expect(normalizeMsisdn('0712345678')).toBe('254712345678');
  });
  it('formats Kenyan shillings', () => {
    expect(KES(1234)).toContain('1,234');
  });
});

describe('password hashes', () => {
  it('verifies a scrypt password without accepting the plaintext', async () => {
    const hash = await hashPassword('Iprs@2026!');
    expect(await verifyPassword('Iprs@2026!', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
```

Use the exact catalogue IDs exported by `src/data/pricing.ts`; do not add duplicate catalogue entries. Add the new rate-limiter and Spin-normalization unit cases in Tasks 2 and 5 after their production exports exist.

- [ ] **Step 2: Install the test and lint dependencies.**

Run:

```bash
npm install -D eslint@9 typescript-eslint vitest prettier @eslint/js
```

Add the exact installed versions to `devDependencies` through npm, then create `vitest.config.ts` with `test.environment = 'node'`, `test.include = ['tests/**/*.test.ts']`, and `test.setupFiles = ['./tests/setup.ts']`.

- [ ] **Step 3: Configure ESLint and Prettier.**

Create an ESLint flat config that parses `src/**/*.{ts,tsx}` with `typescript-eslint`, enables recommended rules, and adds an explicit no-unused-vars rule matching the project’s strict compiler. Add a separate `.mjs` override with `no-unused-vars: ['error', { argsIgnorePattern: '^_' }]`. Add `.prettierrc` with:

```json
{
  "printWidth": 120,
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all"
}
```

- [ ] **Step 4: Run the baseline unit and lint commands.**

Run:

```bash
npm run test:unit
npm run lint
```

Expected: the new tests either pass or fail only on missing production exports; lint reports no configuration errors. Record exact failures before implementing production modules.

- [ ] **Step 5: Add the 85-test coverage count.**

Keep the existing permission, pricing, format, and password cases and add explicit cases for permission scope implication, pricing basket sums, Kenyan number edge cases, both Spin envelopes, rate-window reset/header metadata, scrypt malformed hashes, and password timing-safe verification until the suite contains exactly 85 passing `it` cases.

- [ ] **Step 6: Commit checkpoint locally.**

```bash
git add package.json package-lock.json eslint.config.js .prettierrc vitest.config.ts tests
git commit -m "test: establish lint and unit-test baseline"
```

Do not push this checkpoint; it will be squashed before delivery.

---

### Task 2: Harden transport, ownership, and payment settlement

**Files:**
- Modify: `server/index.mjs`
- Modify: `server/db.mjs`
- Modify: `server/daraja.mjs`
- Create: `server/ratelimit.mjs`
- Create: `server/security.mjs`
- Create: `tests/unit/security-boundaries.test.ts`
- Modify: `scripts/smoke-api.mjs`

**Interfaces:**
- `security.mjs` produces `securityHeaders()`, `originAllowed(origin)`, `callbackToken()`, and `assertRequestShape(body, shape)`.
- `ratelimit.mjs` produces `FixedWindowRateLimiter` and `rateLimitMiddleware(config)`.
- All protected routes continue to use `actorOf`, `requireActor`, `requirePerm`, `targetUserId`, and `ownOrAll` from the existing server foundation.
- The callback route is `POST /api/wallet/topup/mpesa/callback/:token`; the tokenless route is absent and returns 404.

- [ ] **Step 1: Add failing server boundary tests.**

Extend `scripts/smoke-api.mjs` with assertions for anonymous `PATCH /api/wallet/:id`, anonymous provider logs, anonymous API-key revocation, cross-user wallet mutation, cross-user STK confirm/cancel, callback wrong token, callback amount mismatch, old callback 404, rate-limit headers, and global security headers.

- [ ] **Step 2: Implement fixed-window rate limiting.**

Create `server/ratelimit.mjs` with a `FixedWindowRateLimiter` that stores `{count, resetAt}` per key, returns `{allowed, limit, remaining, resetAt}`, and prunes expired entries. Add middleware that sets `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset`; on rejection set `Retry-After` and return:

```json
{ "ok": false, "message": "Too many requests." }
```

Use login `LOGIN_RATE_MAX ?? 15` per IP per 300 seconds, STK `STK_RATE_MAX ?? 10` per actor per 60 seconds, and `/api/v1` `API_V1_RATE_MAX ?? 120` per key per 60 seconds.

- [ ] **Step 3: Apply global CORS and security headers.**

Replace unrestricted `cors()` with an allowlist derived from same-origin requests, `CORS_ORIGINS`, and `http://localhost:5173` in development. Apply:

```js
res.set({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
});
```

Do not expose the SQLite path, auth secret, callback token, provider secrets, or raw database rows in health or public discovery responses.

- [ ] **Step 4: Harden wallet and ownership routes.**

Add `requireActor` to `PATCH /api/wallet/:id`, reject user-tier access to another user’s wallet, and filter the body through exactly:

```js
['autoTopUp', 'autoTopUpTriggerKes', 'autoTopUpAmountKes', 'lowBalanceAlertKes']
```

Reject `balance`, `held`, `userId`, and unknown keys. Add `requirePerm('provider.logs.view')` to provider logs, enforce self ownership on `/api/usage`, and sanitize numeric values with `Math.max(0, Number(value) || 0)`.

- [ ] **Step 5: Add callback token persistence and validation.**

Read `DARAJA_CALLBACK_TOKEN` when set; otherwise generate a cryptographically random token once and store it in the existing `kv` table. Compare the path token in constant time. On a valid token, locate the initiated checkout, compare callback amount to the initiated amount, and settle only on equality. On mismatch return 400 and append a `critical` audit record. Remove the tokenless callback route and include the token segment in the default Daraja callback URL.

- [ ] **Step 6: Harden STK status, confirm, and cancel.**

Resolve the checkout by `CheckoutRequestID` and require the user-tier actor to own its `userId`; return 403 for another user. Preserve the existing KES 500 minimum and payment transaction behavior.

- [ ] **Step 7: Run the security tests.**

Run:

```bash
npm run typecheck
npm run lint
node scripts/smoke-api.mjs
```

Expected: typecheck and lint pass, and every new boundary assertion returns the documented status without leaking secrets.

- [ ] **Step 8: Commit checkpoint locally.**

```bash
git add server scripts/smoke-api.mjs tests/unit/security-boundaries.test.ts
git commit -m "feat: harden transport and payment boundaries"
```

---

### Task 3: Implement the scoped machine API

**Files:**
- Create: `server/apiv1.mjs`
- Modify: `server/db.mjs`
- Modify: `server/index.mjs`
- Modify: `src/types/index.ts`
- Modify: `src/context/AppDataContext.tsx`
- Modify: `src/services/http.ts`
- Modify: `src/components/screens/Screen12_ApiDocumentation.tsx`
- Create: `tests/unit/apiv1.test.ts`
- Modify: `scripts/smoke-api.mjs`

**Interfaces:**
- `POST /api/api-keys` returns `{ ok: true, key: { id, prefix, label, environment, scopes }, secret }` once.
- `GET /api/v1` returns `{ service: 'iprs-machine-api', scopes, endpoints }`.
- `GET /api/v1/pricing` requires `pricing:read`.
- `GET /api/v1/wallet` requires `wallet:read` and returns the key owner’s wallet only.
- `POST /api/v1/verify` requires `verify:run`, body `{ search_type, identifier, consent: true }`, and returns the owner’s search result with wallet debit metadata.

- [ ] **Step 1: Add failing machine API tests.**

Cover missing key 401, wrong scope 403, non-boolean consent 400, insufficient wallet 402, successful debit at catalogue rate, usage/audit attribution, and provider-failure refund. Assert the stored API-key record contains no plaintext secret.

- [ ] **Step 2: Add API-key storage fields.**

Extend the API-key record with `secretHash`, `scopes`, `ownerId`, `lastUsedAt`, and `revokedAt`. Hash secrets with SHA-256 before `putApiKey`; return the secret only from the create response.

- [ ] **Step 3: Implement machine authentication and scope middleware.**

In `server/apiv1.mjs`, parse the public key id from the bearer-style machine credential, load the active record, compare the presented secret hash, attach `{ key, owner, scopes }`, and return 401 for missing/revoked/invalid credentials. Add `requireMachineScope(scope)` returning 403 when absent.

- [ ] **Step 4: Implement discovery, pricing, and wallet endpoints.**

Return the exact six scope names from the brief and the three endpoint rows. Use the existing pricing data and `walletFor(owner.id)`. Do not accept a caller-supplied owner id for the machine wallet route.

- [ ] **Step 5: Implement transactional verification.**

Validate `search_type`, identifier, and `consent === true`; resolve the catalogue rate; return 402 with `{ requiredKes }` when the owner wallet is short. In one SQLite transaction, debit the wallet, append usage, and append audit attribution. If the live provider call fails after debit, use the existing wallet movement transaction to restore the same amount and record the provider failure.

- [ ] **Step 6: Wire server-first key issuance in the frontend.**

Add `createMachineApiKey` and `revokeMachineApiKey` service methods in `AppDataContext`/the existing provider service. In API mode call `/api/api-keys`; in local mode use the existing mock only after the backend is unavailable. The UI must clear the one-time secret from state after the user dismisses it.

- [ ] **Step 7: Add the Machine API documentation tab.**

Change the tab union to include `Machine API`, add the render-array entry, content block, and four endpoint rows. Replace fictional local base URLs with the configured backend origin and show `401/403/402/429` contracts.

- [ ] **Step 8: Run machine API verification.**

Run:

```bash
npm run test:unit
npm run typecheck
npm run lint
node scripts/smoke-api.mjs
```

Expected: machine API tests pass, no secret appears in responses, and the user tier cannot cross wallet ownership.

- [ ] **Step 9: Commit checkpoint locally.**

```bash
git add server src tests scripts/smoke-api.mjs
git commit -m "feat: add scoped machine API"
```

---

### Task 4: Add forward-only migrations, backups, and session management

**Files:**
- Modify: `server/db.mjs`
- Modify: `server/index.mjs`
- Modify: `src/types/index.ts`
- Modify: `src/context/AppDataContext.tsx`
- Modify: `src/components/screens/Screen13_UserProfile.tsx`
- Modify: `src/components/screens/SystemSettingsScreen.tsx`
- Create: `tests/unit/db-migrations.test.ts`
- Modify: `scripts/smoke-api.mjs`

**Interfaces:**
- `migrateDb()` applies forward-only `PRAGMA user_version` migrations and stamps pre-versioned databases at the current baseline.
- `GET /api/admin/backup` returns `{ format: 'iprs-backup', version: 1, data }` and excludes sessions and in-flight STK intents.
- `POST /api/admin/restore` accepts only versioned backup payloads and applies changes transactionally while preserving auth/callback secrets.
- `GET /api/auth/sessions` returns the current user’s sessions.
- `DELETE /api/auth/sessions/:id` revokes only the owner’s session.
- `POST /api/auth/sessions/revoke-others` revokes every other session for the current user.

- [ ] **Step 1: Add failing migration and backup tests.**

Test a new database reaching the current user version, an old unversioned database being stamped without destructive resets, backup exclusion of sessions/STK intents, secret preservation, invalid-version rejection, and transactional restore rollback.

- [ ] **Step 2: Implement migration registration.**

Define a migration list in `server/db.mjs` with the current schema version, read `PRAGMA user_version`, run only higher migrations in ascending order, and stamp databases that already contain all required tables but have version zero.

- [ ] **Step 3: Add backup serialization.**

Create a backup object from the existing database collections, explicitly delete `sessions` and in-flight STK records, and include only stable IDs and public domain data. Preserve the signing secret and callback token from the `kv` table without including other credential material.

- [ ] **Step 4: Add transactional restore.**

Validate `format`, `version`, and required data arrays before opening a transaction. Apply users, wallets, pricing, settings, providers, and audit records in dependency order. Reject a duplicate or malformed ID rather than partially applying the snapshot.

- [ ] **Step 5: Add self-service session routes.**

Require an actor for all three routes, filter session lists by `actor.id`, and delete matching session rows. Ensure `auth.mjs` checks live session existence on every token verification so a revoked token fails immediately.

- [ ] **Step 6: Add profile and settings UI.**

Add Security-tab device rows with per-device revoke and revoke-others actions. Add a Super-Admin-only Backup & Recovery panel with download, restore selection, validation messaging, and a visible backend-required callout in local mode.

- [ ] **Step 7: Run migration and session verification.**

Run:

```bash
npm run typecheck
npm run lint
npm run test:unit
node scripts/smoke-api.mjs
```

Expected: migration, backup round-trip, session revocation, and secret-preservation assertions pass.

- [ ] **Step 8: Commit checkpoint locally.**

```bash
git add server src tests scripts/smoke-api.mjs
git commit -m "feat: add migrations backups and session controls"
```

---

### Task 5: Add integration normalization and frontend resilience polish

**Files:**
- Modify: `server/spin.mjs`
- Modify: `server/index.mjs`
- Modify: `src/components/screens/Screen12_ApiDocumentation.tsx`
- Create: `src/components/common/ErrorBoundary.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/interactive/SearchSimulationModal.tsx` and existing overlay components
- Create: `src/components/common/DemoBanner.tsx`
- Create: `tests/unit/spin-response.test.ts`
- Modify: `.github/workflows/deploy-pages.yml`
- Create: `.env.example`

**Interfaces:**
- `normalizeResponse(raw)` accepts both `{ code, data }` and `{ response_code, success, message, data }` envelopes.
- `ErrorBoundary` accepts `{ children: React.ReactNode, fallback?: React.ReactNode }` and renders text containing `Something broke on this screen` after an error.
- `DemoBanner` renders only when `import.meta.env.VITE_DEMO_BANNER` is non-empty.

- [ ] **Step 1: Add failing Spin and ErrorBoundary tests.**

Test both envelope forms, provider failure mapping, banner absence/presence, and fallback rendering after a thrown child.

- [ ] **Step 2: Normalize Spin responses and search route.**

Make `normalizeResponse` return `{ ok, providerCode, message, data }`. Map failed provider responses to an honest error and ensure the simulated path remains deterministic when credentials are absent. Keep the existing `GET /api/spin/modules` route and execute provider search behavior through the machine verification path, which already owns consent, pricing, wallet debit, usage, audit, and refund semantics.

- [ ] **Step 3: Add the ErrorBoundary and semantic accessibility landmarks.**

Wrap the application root in `ErrorBoundary`. Add an `a href="#main-content"` skip link and make the main shell `<main id="main-content">`. Track the trigger element in the existing modal/search overlays and restore focus on close.

- [ ] **Step 4: Add the optional demo banner and environment example.**

Create `.env.example` with the existing Daraja/Spin/auth variables plus:

```dotenv
DARAJA_CALLBACK_TOKEN=
CORS_ORIGINS=http://localhost:5173
LOGIN_RATE_MAX=15
STK_RATE_MAX=10
API_V1_RATE_MAX=120
```

Render the banner only when `VITE_DEMO_BANNER` is set. Update the Pages workflow to set it for static deployment without adding a secret.

- [ ] **Step 5: Run resilience and build checks.**

Run:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

Expected: all pass and the built single-file bundle contains the skip link, main landmark, and optional banner behavior.

- [ ] **Step 6: Commit checkpoint locally.**

```bash
git add server src tests .env.example .github/workflows/deploy-pages.yml
git commit -m "feat: add integration and accessibility resilience"
```

---

### Task 6: Update smoke suites, CI, and documentation

**Files:**
- Modify: `scripts/smoke-api.mjs`
- Modify: `scripts/smoke-dom.mjs`
- Modify: `scripts/smoke-flows.mjs`
- Modify: `scripts/smoke-requirements.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/verify.yml`
- Modify: `.github/workflows/deploy-pages.yml`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/MANUAL_TEST_CHECKLIST.md`
- Modify: `docs/SPIN_INTEGRATION.md`
- Create: `PR2_BODY.md`

**Interfaces:**
- `npm run verify` runs typecheck → lint → unit → build → API 114 → DOM 44 → flows 64 → traceability 96.
- Each smoke suite exits non-zero on the first failed assertion and cleans up its temporary database/server/processes.
- `PR2_BODY.md` is the exact title/body/notes source for the final GitHub PR.

- [ ] **Step 1: Add API smoke assertions.**

Add explicit assertions for all new status codes, response headers, API-key scope matrix, webhook matrix, rate limits, backup round-trip, migration baseline, and session revocation. Keep the final API count at 114.

- [ ] **Step 2: Add DOM and flow assertions.**

Add DOM checks for the Machine API tab, error-boundary fallback marker, skip link, main landmark, backup panel, and session controls. Add write flows for server-first key issuance, session revocation, backup export, and restore. Keep DOM 44 and flows 64 exact.

- [ ] **Step 3: Update requirement traceability.**

Add assertions for all scope, webhook, rate-limit, backup, migration, session, and optional-banner requirements. Keep the final traceability count at 96 and remove stale count claims from script output.

- [ ] **Step 4: Update package scripts and CI.**

Add `lint`, `test:unit`, and `format`; replace `verify` with the exact eight-stage chain. Update `verify.yml` to run `npm ci && npm run verify`, retain the single-file artifact upload, and update the comment to report 85 unit tests plus 318 smoke assertions.

- [ ] **Step 5: Update documentation and PR body.**

Align README, AGENTS, manual checklist, Spin docs, and workflow comments with the observed counts and controls. Add Machine API curl examples and manual tests for issue-once, 401/403/400, successful debit, webhook token/amount validation, rate limits, backup restore, and session revocation. Create `PR2_BODY.md` using the supplied PR #2 body and the final verified numbers.

- [ ] **Step 6: Run the full verification gate.**

Run:

```bash
npm run verify
```

Expected: exit code 0, 85/85 unit tests, 114 API assertions, 44 DOM assertions, 64 flow assertions, and 96 traceability assertions. If any count differs, update the assertion implementation or the documentation together before proceeding.

- [ ] **Step 7: Commit checkpoint locally.**

```bash
git add package.json package-lock.json .github scripts README.md AGENTS.md docs PR2_BODY.md .env.example
git commit -m "test: complete PR2 verification gates"
```

---

### Task 7: Review, squash, push, and open the PR

**Files:**
- Verify: all changed files
- Verify: `PR2_BODY.md`
- Verify: `docs/superpowers/specs/2026-09-25-pr2-hardening-design.md`

- [ ] **Step 1: Run the full final gate from a clean checkout state.**

```bash
npm ci
npm run verify
```

Expected: all verification stages pass with the documented counts.

- [ ] **Step 2: Inspect the complete diff and repository hygiene.**

```bash
git status --short
git diff origin/main...HEAD --stat
git diff --check
```

Confirm no credentials, generated databases, temporary bundles, smoke artifacts, or `node_modules` are staged. Confirm `.env.example` contains placeholders only.

- [ ] **Step 3: Review the implementation for the approved invariants.**

Check bearer-only auth, no cross-owner access, no balance mass assignment, no secret responses, env-gated live integrations, simulation fallback, pricing invariants, and exact smoke counts. Fix any issue and rerun the affected tests plus `npm run verify`.

- [ ] **Step 4: Squash the design checkpoint and implementation checkpoints.**

Use an interactive rebase or equivalent non-destructive history cleanup to leave one implementation commit on `arena/01a0cbfb-z-profile-pr2`. Do not push until the branch contains exactly the intended diff from `origin/main`.

- [ ] **Step 5: Push the branch and open the PR.**

```bash
git push -u origin arena/01a0cbfb-z-profile-pr2
gh pr create --base main --head arena/01a0cbfb-z-profile-pr2 --title "PR #2 — post-merge hardening: webhook auth, machine API, backups, sessions, tooling gates" --body-file PR2_BODY.md
```

- [ ] **Step 6: Verify the published PR.**

```bash
gh pr view --repo supportfleektech-tech/z-profile --json number,title,body,url,state,headRefName,baseRefName
gh pr checks --repo supportfleektech-tech/z-profile
```

Confirm the PR targets `main`, uses `arena/01a0cbfb-z-profile-pr2`, has the exact body, and reports passing checks before claiming completion.
