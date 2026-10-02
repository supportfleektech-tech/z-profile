# Fleek IPRS SaaS Transformation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the IPRS Kenya identity-verification platform into a full SaaS product named "Fleek IPRS" with rebranding, RBAC restructure (Super Admin / Admin / User), sub-user system with shared wallet and billing, registration/approval flow with Resend email, search-result filtering, super-admin impersonation, theme selection, notification sounds, matrix typing effect, sidebar scroll fix, and a complete GO_LIVE.md deployment guide.

**Architecture:** Hash-routed React 19 + Vite + Tailwind 4 + Express 5 + `node:sqlite`. Single-file build (`vite-plugin-singlefile`). Backend seeds from the same `src/data/*.ts` modules the browser mock uses. RBAC engine in `src/auth/permissions.ts` shared by frontend `can()` and backend `requirePerm()`. Route table `platformRoutes` in `src/types/routes.ts` drives sidebar, guards, access-denied. State in `AppDataContext` over `src/services/db.ts` (localStorage key `iprs.v1.workspace`). `http.ts` `apiOr()` treats 4xx as business answers, flips to LOCAL adapter only on network/5xx.

**Tech Stack:** React 19, TypeScript 5.9 (strict), Vite 7.3, Tailwind CSS 4, Express 5, node:sqlite, Resend (email), Web Audio API (synthesized fallback), Canvas/CSS (typing effect), sharp (logo optimization).

**Spec:** This document IS the spec (approved in chat 2026-10-02). No separate design doc; chat decisions are binding.

## Global Constraints

- System name: **Fleek IPRS** (brand everywhere: title, header, login, dashboards, emails, health endpoint).
- Logo: `fleek-iprs-logo.png` (1536x1024 RGBA at repo root) → `public/fleek-iprs-logo.png` + optimized variants (32/48/128px) generated via sharp.
- Demo password for every seeded account: `Iprs@2026!`.
- Auth responses never leak password material (existing `publicUser` stripping stays).
- Backend: `node:sqlite` at `server/.data/iprs.sqlite`, port 8787. HMAC bearer tokens, 12h expiry, logout revokes.
- Frontend dev: Vite `:5173`, proxy `/api` → `:8787`. `vite-plugin-singlefile` inlines everything into `dist/index.html`.
- Email: Resend. Dev = outbox table + log; prod = `RESEND_API_KEY` env. Templates prefixed `fleek-iprs-`.
- Node >= 22.5.0.
- `npm run verify` (typecheck + build + API 77 + DOM 44 + flows 64 + trace 85 assertions) must stay green after every task.
- No secrets in source. `IPRS_AUTH_SECRET` from kv store or env.
- TS: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` — all must pass.
- `@/*` alias → `src/*`. `iconRegistry.tsx` must stay `.tsx`. Buttons take `variant=`, not `tone`.
- RBAC: Super Admin seeded (`isSystem`), never creatable/editable/demoted/deleted from any UI/API. `permissions.ts` is the single source of truth — never duplicate role logic.
- Sub-user billing: 5 free per host, then 500 KSH/month each, charged to host wallet on the 1st; insufficient balance suspends ALL of that host's sub-users.
- Sub-user dashboard mirrors host dashboard layout; wallet read-only; only host-granted checks runnable.
- Sub-user grants UI: host checks boxes from the full permission list.
- Theme: `themeMode: 'light' | 'dark' | 'system'` + existing 5 accents (cyan/emerald/violet/amber/rose).
- Sounds: embedded WebM/OGG files in `public/sounds/` (downloaded from the internet), distinct per event; respect `prefers-reduced-motion`/reduceMotion (silent).
- Search loading: terminal/hacker typing effect per stage label (no full-screen code rain).
- GO_LIVE.md targets ~500 clients: Vercel (frontend) + Render (backend) + Neon Postgres, Cloudflare DNS/TLS, Sentry + UptimeRobot + Grafana Cloud, Resend, Daraja production creds. Include Terraform/docker-compose artifacts.

---

### Task 1: Rebranding + Logo Integration

**Files:**
- Modify: `src/components/common/IprsLogo.tsx`
- Modify: `index.html`
- Modify: `src/components/screens/Screen1_Login.tsx`
- Modify: `src/components/common/Header.tsx`
- Modify: `src/components/dashboards/DashboardSuperAdmin.tsx`, `DashboardAdmin.tsx`, `DashboardUser.tsx`
- Modify: `src/data/pricing.ts` (batchLabel/proposalRef only if brand-specific)
- Modify: `server/index.mjs` (health `service` name + any brand strings)
- Create: `public/fleek-iprs-logo.png` (+ `-32x32`, `-48x48`, `-128x128` variants via sharp)
- Modify: `vite.config.ts` only if needed for asset inlining (likely not)
- Grep sweep for remaining "IPRS" brand strings (keep historical demo data/documents content intact).

**Interfaces:**
- Consumes: repo-root `fleek-iprs-logo.png`.
- Produces: `FleekLogo` usage unchanged in props (`size`, `showSubtitle`); `<img alt="Fleek IPRS">`; `document.title === 'Fleek IPRS ...'`; favicon served from `/fleek-iprs-logo-32x32.png`.

**Tests:** `npm run typecheck`, `npm run build`, boot built bundle in jsdom and assert title contains "Fleek IPRS" and login renders logo img with alt text.

- [ ] Step 1: Copy + optimize logo to public/ via sharp script.
- [ ] Step 2: Rewrite IprsLogo to img-based with SVG fallback.
- [ ] Step 3: Update index.html title/meta/favicon.
- [ ] Step 4: Sweep brand strings in login/header/dashboards/server/pricing.
- [ ] Step 5: Typecheck + build + jsdom boot assert.
- [ ] Step 6: Commit (`feat: rebrand to Fleek IPRS with new logo`).

### Task 2: RBAC Restructure — Super Admin / Admin / User

**Files:**
- Modify: `src/auth/permissions.ts` (full rewrite per spec: remove SUB_ROLE_DEFINITIONS; new ROLE_DEFINITIONS; TIER_ORDER/LABELS/DASHBOARDS/META; canCreateTier; canManageUser; legacyRoleToTier; roleLabelFor).
- Modify: `src/types/routes.ts` (tiers/permissions per new model).
- Modify: `src/data/users.ts` (new seeds: super_admin seeded system; admin; plain users; demoPersonas = 3 entries).
- Modify: `src/components/dashboards/DashboardSuperAdmin.tsx` (gain team/providers/payments/analytics entry points).
- Modify: `src/components/dashboards/DashboardAdmin.tsx` (new Admin = analyst+billing merged).
- Modify: `src/components/dashboards/DashboardUser.tsx` (drop sub-role labels).
- Modify: `src/services/auth.service.ts` (create() tier validation).
- Modify: `src/services/db.ts` if seed/migration touches subRole (legacyRoleToTier migration for persisted `iprs.v1.workspace`).

**Interfaces:**
- Consumes: Task 1 brand strings (role labels "Admin", "Super Admin", "User" unchanged).
- Produces: `effectivePermissions()`, `can()`, `RoleTier = 'user' | 'admin' | 'super_admin'` with NO `UserSubRole` dependency (type may remain for legacy migration only); routesForTier() correct per tier. New admin perms = analyst+billing union (exact list in spec).

**Tests:** typecheck; `npm run verify` full; plus targeted asserts: analyst/officer/billing/viewer sub-roles gone from UI; admin@ sees payments/analytics/providers; user sees no governance routes; super_admin sees all.

- [ ] Step 1: Rewrite permissions.ts.
- [ ] Step 2: Update routes.ts tiers.
- [ ] Step 3: Reseed users.ts + persisted-state migration.
- [ ] Step 4: Update the three dashboards + auth.service validation.
- [ ] Step 5: Full verify + targeted asserts.
- [ ] Step 6: Commit (`feat: restructure RBAC to super_admin/admin/user`).

### Task 3: Pluggable Mailer (Resend) + Outbox

**Files:**
- Create: `src/services/mailer.ts` (`sendMail({to, subject, template, vars})`; dev → outbox table + console; prod → Resend API via `/api/email/send` relay or direct fetch with `RESEND_API_KEY` server-side only).
- Modify: `server/index.mjs` (`POST /api/email/send` super_admin-only relay; `email_outbox` table; Daraja-style honest errors).
- Create: `server/mailer.mjs` (Resend fetch wrapper, template renderer for the 5 templates).
- Modify: `src/services/db.ts` (outbox slice in workspace state for LOCAL mode).

**Interfaces:**
- Consumes: `RESEND_API_KEY`, `RESEND_FROM` env.
- Produces: `mailer.sendMail()` promise `{ok, message?, outboxId?}`; templates: `fleek-iprs-registration-approved`, `fleek-iprs-pending-registration`, `fleek-iprs-sub-user-invite`, `fleek-iprs-sub-user-billing`, `fleek-iprs-sub-user-suspended`. Used by Tasks 4 and 5.

**Tests:** typecheck; unit-ish smoke via node script asserting dev-mode outbox write without network; verify suite green.

- [ ] Step 1: mailer.ts + server/mailer.mjs + outbox table.
- [ ] Step 2: POST /api/email/send endpoint with perm gate.
- [ ] Step 3: Template renderer + 5 templates.
- [ ] Step 4: Tests + verify.
- [ ] Step 5: Commit (`feat: pluggable Resend mailer with dev outbox`).

### Task 4: Get Started + Register + Approval Flow

**Files:**
- Create: `src/components/screens/Screen0_GetStarted.tsx`, `Screen2_Register.tsx`, `Screen15_PendingApprovals.tsx`.
- Create: `src/pages/GetStartedPage.tsx`, `RegisterPage.tsx`, `PendingApprovalsPage.tsx`.
- Modify: `src/types/routes.ts` (public `get-started`, `register`; super_admin `pending-approvals` with new perm `registrations.review` or reuse `users.create`).
- Modify: `src/auth/permissions.ts` (add `registrations.review` label + grant to super_admin only; add to PERMISSION_GROUPS People & Access).
- Modify: `src/types/index.ts` (`PendingRegistration` type: company, county, cert files as base64 dataURLs, contact, termsAcceptedAt, status).
- Modify: `server/index.mjs` (`POST /api/auth/register` public with validation + file-size caps; `GET /api/registrations` super_admin; `POST /api/admin/approve-registration/:id`, `POST /api/admin/reject-registration/:id`).
- Modify: `src/components/navigation/PageRouter.tsx` + `App.tsx` wiring for new routes.
- Modify: `Screen1_Login.tsx` (Get Started / Register links; keep demo box).

**Interfaces:**
- Consumes: Task 3 mailer (approval + rejection emails).
- Produces: registration `POST` → `{ok, pendingId}`; approve → creates `user` tier=user Active + temp password + Resend credentials email. Username rule: email local-part + 4 random alphanumerics uppercased.

**Tests:** typecheck + build; API asserts (register validates, approval creates login-able user, non-super-admin denied); DOM asserts (register two-panel renders, file inputs present, back-to-login works).

- [ ] Step 1: Types + permission + routes.
- [ ] Step 2: GetStarted + Register screens + pages + router.
- [ ] Step 3: Server register/approve/reject endpoints.
- [ ] Step 4: PendingApprovals screen + login links.
- [ ] Step 5: Tests + verify.
- [ ] Step 6: Commit (`feat: public registration with super-admin approval`).

### Task 5: Sub-User System (model, auth, wallet, dashboard, billing)

**Files:**
- Modify: `src/types/index.ts` (SystemUser: `parentUserId?`, `isSubUser`, `subUserLimit=5`, `subUserCount`, `subUserFeatures: Permission[]`; `SubUserInvitation` type).
- Modify: `src/auth/permissions.ts` (add `users.create.sub`, `users.manage.sub`; sub-user effective-perm intersection in `effectivePermissions()`; `roleLabelFor` sub-user suffix).
- Modify: `src/services/auth.service.ts` (`createSubUser()` with limit/balance validation; login resolves host context).
- Modify: `src/services/wallet.service.ts` (all ops on host wallet; tx records `actorUserId` + `hostUserId`).
- Create: `src/services/billing.service.ts` (`chargeSubUserBilling()` monthly; invoice; suspend-all on insufficient funds; Resend receipts).
- Modify: `src/services/settings.service.ts` (`subUserPriceKes = 500` default).
- Modify: `src/components/screens/Screen13_UserProfile.tsx` (Team Members tab + add/edit/suspend/delete + checkbox grant list + limit/billing summary).
- Create: `src/components/screens/Screen16_SubUserDashboard.tsx` + `src/pages/SubUserDashboardPage.tsx` (mirror host layout, wallet read-only, granted checks only, assigned cases only).
- Modify: `src/types/routes.ts` (`/sub-users`, `/sub-dashboard` routes + perms).
- Modify: `server/index.mjs` (`POST /api/users/sub-user`, `GET /api/users/:id/sub-users`, `PATCH /api/users/:id/sub-features`, monthly cron hook `POST /api/cron/sub-billing` gated by `IPRS_CRON_SECRET`).
- Modify: `src/components/ui/primitives.tsx` (sub-user badge + limit indicator).

**Interfaces:**
- Consumes: Tasks 2 (perms), 3 (mailer).
- Produces: host wallet sharing (`getHostWallet()`); monthly charge `(count-5)*500` KES; suspend-all semantics; audit actions `sub_user.created/permissions_updated/suspended/billing_charged`.

**Tests:** typecheck + build; API asserts (create validates limit, 6th requires balance, login as sub-user resolves host wallet, patch features gated); DOM asserts (Team Members tab renders, checkbox list present, sub-dashboard wallet read-only).

- [ ] Step 1: Types + permissions + settings default.
- [ ] Step 2: auth.service createSubUser + login host resolution + wallet host routing.
- [ ] Step 3: billing.service monthly charge + suspend-all + cron endpoint.
- [ ] Step 4: Team Members UI + sub-dashboard + routes.
- [ ] Step 5: Server endpoints.
- [ ] Step 6: Tests + verify.
- [ ] Step 7: Commit (`feat: sub-user accounts with shared wallet and billing`).

### Task 6: Search Filtering by Selected Checks + Skip-Tracing

**Files:**
- Modify: `src/components/screens/Screen3_NewSearch.tsx` (skip-tracing checkbox; catalogue filter via `TRACING_IDS` set; presets respect it; pass `skipTracing` through `runSearch`).
- Modify: `src/services/search.service.ts` (persist `checkIds` + `skipTracing` into dossier meta + searchHistory entry).
- Modify: `src/types/index.ts` (Dossier meta + SearchHistory entry gain `checkIds: string[]`, `skipTracing: boolean`).
- Modify: `src/components/screens/Screen4_IdentityProfile.tsx` (derive visible tabs/sections from dossier meta checkIds; hide empty tabs; mask note for unrun sections).
- Modify: `src/data/dossier.ts` if meta assembly lives there.
- Spin: verify-only — assert `runSearch` dispatches providers solely for selected checkIds (already true); add code comment + smoke assert; NO behavior change.

**Interfaces:**
- Consumes: dossier meta shape (defined here).
- Produces: `dossier.meta = { checkIds, skipTracing, consentRef, purpose }`; profile renders subset only.

**Tests:** typecheck + build; flow assert (run 2-check search → profile shows only those sections, other tabs hidden); DOM assert (skip-tracing checkbox filters catalogue).

- [ ] Step 1: Types + TRACING_IDS + screen checkbox/filter.
- [ ] Step 2: Persist meta through service + dossier.
- [ ] Step 3: Profile section filtering.
- [ ] Step 4: Tests + verify.
- [ ] Step 5: Commit (`feat: results filtered to selected checks + skip-tracing`).

### Task 7: Super-Admin Impersonation ("Act as User")

**Files:**
- Modify: `src/context/AppDataContext.tsx` (`impersonatingUserId` state, host-wallet/perms resolution, `setImpersonatingUserId/clear`, banner data).
- Modify: `src/components/dashboards/DashboardSuperAdmin.tsx` (user picker dropdown + acting-as banner + User Activity panel).
- Modify: `src/services/auth.service.ts` if login/session needs actor override notes (search actor stays impersonated user; audit appends `impersonatedBy`).
- Modify: `src/types/index.ts` (AuditEntry gains `impersonatedBy?: {id, name}`).

**Interfaces:**
- Consumes: Task 2 (super_admin perms), Task 5 (host-context pattern reuse).
- Produces: `useAppData().impersonatingUserId`, wallet/perms resolve to target; audit `impersonation.started/stopped`, search audit carries impersonator id.

**Tests:** typecheck + build; flow assert (super admin picks user → wallet/searches reflect target → stop restores); audit assert.

- [ ] Step 1: Context impersonation state + resolution.
- [ ] Step 2: Dashboard picker + banner + activity panel.
- [ ] Step 3: Audit trail wiring.
- [ ] Step 4: Tests + verify.
- [ ] Step 5: Commit (`feat: super-admin act-as-user troubleshooting`).

### Task 8: Theme System (Light/Dark/System + Accents)

**Files:**
- Modify: `src/types/index.ts` (AppearanceSettings += `themeMode`).
- Modify: `src/services/db.ts` (default appearance `themeMode: 'system'`; migration of persisted state).
- Modify: `src/context/AppDataContext.tsx` (apply `data-theme-mode`, matchMedia listener for system).
- Modify: `src/index.css` (`[data-theme-mode="light"]` full light palette; dark stays default; reduce-motion guard).
- Modify: `src/components/screens/Screen13_UserProfile.tsx` (Appearance panel: theme radio + accent swatches; existing density/scale/motion controls stay).
- Modify: `src/lib/format.ts` if display helper needed.

**Interfaces:**
- Consumes: existing appearance pipeline.
- Produces: `document.documentElement.dataset.themeMode`; persisted `appearance.themeMode`.

**Tests:** typecheck + build; DOM assert (toggle persists across reboot via bootApp storage, dataset attribute set).

- [ ] Step 1: Type + defaults + migration.
- [ ] Step 2: Context application + system listener.
- [ ] Step 3: Light palette CSS.
- [ ] Step 4: Profile Appearance UI.
- [ ] Step 5: Tests + verify.
- [ ] Step 6: Commit (`feat: light/dark/system themes`).

### Task 9: Notification Sounds + Terminal Typing Effect + Sidebar Scroll Fix

**Files:**
- Create: `public/sounds/*.webm` (7 files, downloaded, <30KB each, permissively licensed).
- Create: `src/lib/sounds.ts` (`playSound(type)`, cache, reduced-motion silent, autoplay-catch).
- Modify: `src/context/AppDataContext.tsx` (pushToast gains optional `sound`; call sites: login/logout, runSearch complete/reject, wallet credit/decline, refund).
- Create: `src/components/common/TerminalTypingEffect.tsx` (types text, blinking cursor, onComplete, reduced-motion instant).
- Modify: `src/components/screens/Screen3_NewSearch.tsx` (stages list uses typing effect).
- Modify: `src/components/layout/AppShell.tsx` (nav gains `min-h-0`; verify scroll).
- Modify: `src/components/common/ToastContainer.tsx` if animation classes needed.

**Interfaces:**
- Produces: `playSound('success'|'error'|'warning'|'info'|'search-start'|'search-complete'|'payment')`; `<TerminalTypingEffect text speed onComplete>`.

**Tests:** typecheck + build; DOM assert (typing effect renders full text when reduced-motion; scroll container has min-h-0 + overflow-y-auto). Sounds: manual QA (autoplay policies block headless assert).

- [ ] Step 1: Download sounds to public/sounds.
- [ ] Step 2: sounds.ts + pushToast wiring.
- [ ] Step 3: TerminalTypingEffect + search stages.
- [ ] Step 4: Sidebar min-h-0 fix.
- [ ] Step 5: Tests + verify.
- [ ] Step 6: Commit (`feat: notification sounds, terminal loader, sidebar scroll fix`).

### Task 10: GO_LIVE.md + Deploy Artifacts

**Files:**
- Create: `docs/GO_LIVE.md` (full guide per spec: stack, env vars, SQLite→Postgres migration, Render + Vercel + Neon steps, Resend, Daraja prod, Sentry/UptimeRobot/Grafana, Cloudflare DNS/TLS, backups, runbooks, security checklist).
- Create: `deploy/render.yaml`, `deploy/docker-compose.yml`, `deploy/Dockerfile.backend` (or document why not), `deploy/terraform/` skeleton if timeboxed (guide-first, IaC second).
- Modify: `server/index.mjs` ONLY if a `/metrics` endpoint is added (optional; guide may mark it follow-up).
- Modify: `.github/workflows/` only to document (no behavior change without approval).

**Tests:** docs-only; final full `npm run verify` green; link-check the guide's commands against repo scripts.

- [ ] Step 1: Write GO_LIVE.md.
- [ ] Step 2: Add deploy artifacts.
- [ ] Step 3: Self-review guide for placeholders/contradictions.
- [ ] Step 4: Commit (`docs: GO_LIVE SaaS deployment guide`).

---

## Self-Review (controller pre-flight)

| # | Check | Finding / Ruling |
|---|-------|------------------|
| 1 | Tasks share `permissions.ts` (T2 adds perms; T4 adds `registrations.review`; T5 adds sub perms) | Order T2→T4→T5 sequential; later tasks extend, never rewrite earlier blocks. Ruling: implementers must append, not restructure — carry in each dispatch. |
| 2 | `SystemUser` extended in T4 (pending?) and T5 (sub-user fields) | T4 uses separate `PendingRegistration` type (no conflict). Ruling: no merge risk. |
| 3 | Mailer (T3) required by T4/T5 | T3 dispatched before T4/T5. Ruling: order enforced. |
| 4 | Dashboard edits overlap T2 (Admin/Super) and T7 (impersonation picker) | T7 appends picker panel only. Ruling: carry constraint in T7 dispatch. |
| 5 | `Screen13_UserProfile` touched by T5 (Team tab) and T8 (Appearance panel) | Different panels, same file. Ruling: T8 appends new panel; conflicts resolved by anchor (append after existing panels). |
| 6 | Verify suite counts may change (new screens/routes) | Smoke scripts enumerate routes dynamically except requirement-trace counts. Ruling: implementers must keep `npm run verify` green and update smoke scripts if counts shift, documenting the change in the report. |
| 7 | Plan mandates committed plan file + ledger | Done in setup (this file; ledger next). |

Scan rows complete. No blocking conflicts. Proceeding sequential T1→T10 (dependencies chain), never parallel implementers.
