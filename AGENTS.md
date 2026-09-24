# Z-Profile IPRS — Agent Instructions

## Project Overview

React + TypeScript + Vite + Tailwind CSS demo of an IPRS Kenya identity-verification
platform: three RBAC tiers (User / Admin / Super Admin) with distinct dashboards,
wallet + payments monitoring, a schema-driven system settings module, case/report
tooling, and a real Express + `node:sqlite` backend scaffold. Demo-grade by design —
but the permission model, payment state machine and test gates are meant to be taken
seriously.

## Commands — the gate is `npm run verify`

```bash
npm run dev:all      # Express :8787 + Vite :5173 (Vite proxies /api → :8787)
npm run verify       # typecheck + build + API(63) + DOM(44) + flows(63) + traceability(77)
npm run db:reset     # wipe the backend SQLite (reseeds on next start)
```

- `npm run verify` is **the** definition of done: 247 assertions. Never claim work is
  finished without it green.
- `scripts/smoke-{api,dom,flows,requirements}.mjs` run against the **built bundle** or a
  live child server — they need `npm run build` first (verify handles the ordering).
- `node_modules` and `dist` can be wiped between sessions; `npm install && npm run build`
  restores the world. `.gitignore` covers both — keep it that way.

## Architecture

- **Permission engine** — `src/auth/permissions.ts` is the single source of truth.
  Both the frontend (`can()`) **and** the backend (`server/index.mjs` → `requirePerm()`)
  call `effectivePermissions()` from this one module (sub-roles + per-user overrides +
  scope implication). Never duplicate role logic; extend the engine.
- **Tier rules** — Super Admin is seeded (`isSystem`) and can never be created, edited,
  demoted or deleted from any UI/API. Only a Super Admin may create an Admin. Enforced
  in the UI (`canCreateTier`), the services **and** `POST /api/users`.
- **State** — `AppDataContext` over `src/services/db.ts` (localStorage). Persisted key
  is **`iprs.v1.workspace`** (`NS='iprs.v1'` + `'workspace'`), value = the raw state
  object (not a wrapper). `src/services/http.ts` `apiOr()` treats 4xx as a business
  answer (served locally, session stays `API`) and flips to the `LOCAL` adapter only on
  network errors / 5xx; mutations dual-write so both stores stay coherent.
- **Routing** — hash-based; `platformRoutes` in `src/types/routes.ts` drives sidebar
  visibility, router guards and access-denied, from `tiers` + `permission` alone.
- **Pricing** — `src/data/pricing.ts` is the ONLY place rates live (UI, wallet debits,
  PDF schedule, backend seed all read it). Provenance is per item:
  `confirmedFromProposal` (15 of 25 confirmed; vehicle arrived truncated, extract has
  no criminal/deceased/KYB products → those 10 stay flagged, catalogue-level flag stays
  `false` until all are confirmed). `pricingProvenance()` feeds every banner.
- **Backend** — `server/index.mjs` (Express 5, `node:sqlite`, port 8787) seeds from the
  same `src/data/*.ts` modules the browser mock uses, so the two cannot drift.
- **Auth** — login issues an HMAC-signed bearer token (`server/auth.mjs`) bound to a live
  session row: logout revokes instantly; 12 h expiry; secret in the kv store or
  `IPRS_AUTH_SECRET`. `actorOf()` trusts Bearer FIRST (invalid token = hard reject, never
  a silent fallback) and only then the legacy `x-user-id` header, which `ALLOW_HEADER_AUTH=0`
  disables. The frontend gets the token from `authService.login`, stores it in the
  workspace state (`authToken`), and `http.ts` sends `Authorization: Bearer` via the
  provider registered in AppDataContext. In LOCAL mode there is no token and no headers.
- **Spin Mobile (searches)** — `src/data/spinModules.ts` is the transcribed Kenya module
  registry (21 modules, `search_type`, endpoints, params, response shapes) that the UI,
  `GET /api/spin/modules` and `server/spin.mjs` all read; review in
  `docs/SPIN_INTEGRATION.md`. Same pattern as pricing: one file, many consumers.
- **M-PESA gateway** — `server/daraja.mjs` swaps the STK simulation for the real Daraja
  API when `DARAJA_CONSUMER_KEY/SECRET/SHORTCODE/PASSKEY` are all set; health exposes
  `gateway.mode`. Live dispatch failures are honest 502s, never fabricated success.
- **Build** — `vite-plugin-singlefile`: everything inlines into one `dist/index.html`.

## Test harness gotchas (jsdom)

- jsdom cannot execute `<script type="module">` → strip the tag, then `window.eval(bundle)`.
  `scripts/lib/app.mjs` does all of this; use it, don't hand-roll a new boot.
- Polyfills live in `bootApp()`: `matchMedia`, `ResizeObserver`, `scroll*`,
  `scrollIntoView`, clipboard; `window.fetch` is forced to throw so the LOCAL adapter is
  deterministic. `bootApp({ storage })` pre-seeds localStorage BEFORE boot for
  reload-persistence tests.
- **Scope DOM queries**: unscoped `findButton('top up')` matches the header wallet chip;
  modal lookups must go through `within(dialog())`; tabs by `findTab()`/`aria-selected`;
  `SegmentedControl` uses `aria-pressed` (not `role="tab"`).
- The search flow persists history in ONE atomic step-5 setState; the wallet reserve
  (step 3) flips earlier. Wait on `searchHistory.length`, never on balance.
- Stale process on the API test port? `smoke-api.mjs` self-guards (checks the health
  payload's DB path) — kill the squatter, don't bump the port.

## Critical gotchas (still true)

- **`iconRegistry.tsx` must be `.tsx`** — it contains JSX.
- **`trustLevel`, not `riskLevel`** on IdentityProfile.
- **`App.tsx` `authChecked` gate** — the login redirect only fires after the initial
  auth check; removing it causes redirect loops.
- **Toast timer cleanup** in `AppDataContext.pushToast` — don't remove.
- `applyWalletMovement` (server) must never move balance for `status === 'failed'` —
  a declined top-up crediting the wallet was a real bug once.
- Buttons take `variant=`, not `tone`. StatCard `delta` is `{value, up}`.

## Type System

- `tsconfig.json`: `strict`, `noUnusedLocals`, `noUnusedParameters`,
  `noFallthroughCasesInSwitch` — all must pass. TS compiler is the gatekeeper (no ESLint).
- `@/*` path alias → `src/*`.

## File Organization

```
src/
  auth/           # permissions.ts — the RBAC engine (shared with the server)
  components/
    screens/      # Screen3–13 feature screens + Wallet/PaymentsMonitor/SystemSettings/AuditLog
    dashboards/   # Dashboard{User,Admin,SuperAdmin} — one per tier
    ui/           # primitives (Button, Tabs, Toggle, ResponsiveTable, Overlay/Modal…)
    report/       # dossier detail renderers
    layout/ navigation/ common/ interactive/
  context/        # AppDataContext, RouterContext (hash router)
  services/       # db (localStorage), http (apiOr), auth/wallet/provider/settings/search
  data/           # seed data + pricing.ts (rates live ONLY here) + dossier
  lib/            # format, pdf writer, report builders
  types/          # index.ts (domain model incl. RBAC), routes.ts (platformRoutes)
  pages/          # thin route wrappers resolving tier dashboards
server/           # Express + node:sqlite backend (seeds from src/data)
scripts/          # lib/app.mjs harness + smoke-{api,dom,flows,requirements}.mjs
docs/             # IMPLEMENTATION_PLAN.md (executed plan), MANUAL_TEST_CHECKLIST.md
```

## Demo credentials

Password for every seeded account: `Iprs@2026!`
(`superadmin@` / `admin@` / `analyst@` / `officer@` / `viewer@` / `billing@` / `kevin.mutiso@` iprs.co.ke).
Hardcoded secrets beyond these demo fixtures are still forbidden.
