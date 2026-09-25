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
npm run verify       # typecheck + lint + unit(85) + build + API(114) + DOM(44) + flows(64) + traceability(96)
npm run db:reset     # wipe the backend SQLite (reseeds on next start)
```

- `npm run verify` is **the** definition of done: 85 unit tests and 318 smoke assertions
  (API 114 · DOM 44 · flows 64 · trace 96). Never claim work is finished without it green.
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
  object (not a wrapper). `src/services/http.ts` `apiOr()` serves non-401 4xx business
  answers locally while the session stays `API`, returns 401 directly without downgrade,
  and flips to `LOCAL` only on network errors / 5xx; mutations dual-write so both stores
  stay coherent.
- **Routing** — hash-based; `platformRoutes` in `src/types/routes.ts` drives sidebar
  visibility, router guards and access-denied, from `tiers` + `permission` alone.
- **Pricing** — `src/data/pricing.ts` is the ONLY place rates live (UI, wallet debits,
  PDF schedule, backend seed all read it). The catalogue is fully priced: 34/34 items are
  confirmed, with 28 proposal rates and six explicit platform-priced decisions.
  `pricingProvenance()` feeds every banner.
- **Backend** — `server/index.mjs` (Express 5, `node:sqlite`, port 8787) seeds from the
  same `src/data/*.ts` modules the browser mock uses, so the two cannot drift.
- **Auth** — login issues an HMAC-signed bearer token (`server/auth.mjs`) bound to a live
  session row: logout revokes instantly; 12 h expiry; secret in the kv store or
  `IPRS_AUTH_SECRET`. `actorOf()` is **bearer-only** — the forgeable `x-user-id`
  fallback is retired, and a presented-but-invalid token is a hard reject. Passwords
  are scrypt-hashed at rest (`server/passwords.mjs`): seeded plaintext is migrated at
  boot (`hashStoredPasswords()`, idempotent), creation/resets hash on arrival, and
  `publicUser` strips both plaintext and hash from every response. The frontend gets
  the token from `authService.login`, stores it in workspace state (`authToken`), and
  `http.ts` sends `Authorization: Bearer`; a backend 401 remains an API error and never downgrades to LOCAL.
  In LOCAL mode there is no token and no network calls.
- **Spin Mobile (searches)** — `src/data/spinModules.ts` is the transcribed Kenya module
  registry (24 modules, `search_type`, endpoints, params, response shapes) that the UI,
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
  `scrollIntoView`, clipboard. `bootApp()` defaults `window.fetch` to a deterministic
  network failure for LOCAL tests; server-backed flows pass `fetchImpl`.
  `bootApp({ storage })` pre-seeds localStorage BEFORE boot for reload-persistence tests.
- **Scope DOM queries**: unscoped `findButton('top up')` matches the header wallet chip;
  modal lookups must go through `within(dialog())`; tabs by `findTab()`/`aria-selected`;
  `SegmentedControl` uses `aria-pressed` (not `role="tab"`).
- The search flow persists history in ONE atomic step-5 setState; the wallet reserve
  (step 3) flips earlier. Wait on `searchHistory.length`, never on balance.
- Smoke child servers use `process.execPath` and wait for a healthy response before tests;
  they terminate and remove temporary SQLite files in `finally`. Do not replace that with a
  shell-dependent `node` command.

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
  `noFallthroughCasesInSwitch` — all must pass. TypeScript and ESLint are both gates.
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
