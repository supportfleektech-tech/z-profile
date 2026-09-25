> **STATUS — EXECUTED.** Every item below shipped on branch `arena/01a0cbfb-z-profile`
> (PR #1). The "current state" audit sections describe the ORIGINAL code, kept as
> history. Authoritative truth now lives in: `README.md`, `AGENTS.md`,
> `docs/MANUAL_TEST_CHECKLIST.md`, and the `npm run verify` gate (397 assertions).
> Pricing update since this plan was written: the proposal extract arrived and the
> 0–500 batch is transcribed — 15 of 25 rates confirmed, 10 still flagged (no KYB /
> vehicle / criminal / deceased rates were quoted).

# IPRS Kenya Platform — Comprehensive Upgrade Plan

**Branch:** `arena/01a0cbfb-z-profile` · **Base:** `999ef74` · **Date:** 2026-09-23

This document is the execution plan for the full upgrade requested. It is written to be
reviewable on its own: each workstream states the problem, the design decision, the files
touched, and the acceptance test.

---

## 0. Current-state audit (what exists today)

| Area | Finding |
|---|---|
| Stack | React 19 + Vite 6 + Tailwind 4, `vite-plugin-singlefile` (whole app inlines into one HTML). No router lib — custom hash router. No backend. |
| State | `src/context/AppDataContext.tsx` — 318 lines, holds *everything* (auth, cases, users, providers, invoices, toasts, UI flags). `useState` only, **no persistence**: a refresh resets the world. |
| Auth | `isAuthenticated` initialised to `true`; `login()` ignores the password and falls back to `initialUsers[0]` for any unknown email. Effectively no authentication. |
| Roles | Flat union `'Super Admin' \| 'Analyst' \| 'Officer' \| 'Viewer' \| 'Billing'`. **No permission model.** Every role sees the identical dashboard, nav, and admin console. |
| Modules | 15 screens + blueprint poster. `Screen2_Dashboard` is the only dashboard. |
| Identity Profile | Tabs `Overview/Personal/Financial/Connections/Logs` exist, but **only `Overview` changes the DOM** (it toggles Key Findings). Personal/Financial/Connections/Logs render the same two cards. |
| Detailed Report | `Summary` and `Full Report` render the same hero + Key Findings; "Full Report" adds one 4-cell placeholder box with lorem-style text. No real extracted data. |
| Print | `window.print()` on the live app. `@media print` only sets `body{background:white}` and hides `.no-print`. The dark UI, sidebar, header and breadcrumb all print; report data does not. |
| Download PDF | `handleDownload()` = `setTimeout` + toast. **No file is produced.** Same for invoice downloads in `Screen8_Billing`. |
| User Profile | Tabs `Profile/Security/Notifications/Appearance` exist but **all four render the identical body**. Toggles are local `useState`, not persisted. |
| Admin Console | Tabs `Users/Providers/Pricing/System Settings`; only Users is implemented. Providers/Pricing/System Settings render "go to the dedicated module" placeholders. Add-user modal has no validation, no edit, no password reset, no role rules. |
| Provider Management | Tabs `Providers/API Keys/Logs/Usage`; only Providers implemented, and only as read-only cards + ping. **No interaction/configuration fields at all** — no endpoint, credentials, timeouts, retries, rate limits, field mapping, cost, enable/disable, webhooks, request logs. |
| Pricing | 4 hard-coded plans in `mockData.ts`. Unrelated to any KYC/KYB proposal; no volume bands, no per-check price list, no VAT, no calculator. |
| Wallet / payments | Does not exist. Billing page shows static usage bars and 3 fake invoices. |
| System Settings | Does not exist anywhere. |

---

## 1. Workstream A — Removals

**Delete the blueprint poster grid and the mobile-responsive showcase page.**

Delete files:
- `src/pages/MasterBlueprintPage.tsx`, `src/pages/MobileResponsivePage.tsx`
- `src/components/blueprint/BlueprintView.tsx`
- `src/components/screens/Screen15_MobileView.tsx`
- `src/components/interactive/LiveAppMode.tsx`, `src/components/interactive/ScreenModal.tsx`
- `src/components/footer/{BrandFooter,DeploymentCiCd,KeyFeatures,SecurityCompliance,SystemArchitecture}.tsx`
  (only ever consumed by `BlueprintView`)

Edit files:
- `src/types/routes.ts` — drop `mobile-view` + `blueprint` routes; add `tiers`/`permission` metadata to every route; module count 15 → 13 (+ new modules).
- `src/types/index.ts` — drop unused `ViewMode`.
- `src/components/navigation/PageRouter.tsx` — drop both cases, add new module cases + RBAC guard.
- `src/components/navigation/PageNavigator.tsx` — drop "All-in-One Blueprint" button.
- `src/components/layout/PageLayout.tsx` — drop Blueprint button; make `#N/15` dynamic (`#N/{total}`).

> **Acceptance:** no reference to `blueprint`, `mobile-view`, `Screen15`, `LiveAppMode`,
> `ScreenModal`, or `components/footer/` survives `grep -rn`. `#/blueprint` deep-links fall
> back to the dashboard instead of a blank screen.

---

## 2. Workstream B — Foundation: domain model, RBAC, persistence, services

Everything else depends on this, so it lands first.

### B1. Types (`src/types/index.ts`)
New/extended: `RoleTier`, `UserSubRole`, `SystemUser`, `Permission`, `RoleDefinition`,
`Wallet`, `WalletTransaction`, `TopUpRequest`, `PaymentMethod`, `PaymentChannel`,
`ProviderConfig`, `ProviderFieldMapping`, `ProviderRequestLog`, `ApiKeyRecord`,
`AuditEntry`, `SessionRecord`, `SystemSettings` (10 groups), `NotificationPreferences`,
`Dossier` (full extracted record), `PricingCatalog`, `PricedItem`, `UsageRecord`.
`IdentityProfile` is extended rather than replaced so existing screens keep compiling.

### B2. Permission model (`src/auth/permissions.ts`)
Three tiers, each with a distinct dashboard, nav, and toolset:

| Tier | Dashboard | Seeded by | Can create | Signature capabilities |
|---|---|---|---|---|
| `super_admin` | Super Admin Console | **System seed only — never creatable from any UI** | `admin`, `user` | Everything: platform revenue, admin accounts, permission matrix, system settings (all groups), maintenance mode, audit trail, provider contracts & costs, config export/import |
| `admin` | Admin Console | `super_admin` only | `user` | Org-wide operations: team management, provider config & logs, payments monitor, wallet oversight, quota/billing, alerts, system settings (non-security subset, read-only elsewhere) |
| `user` | User Workspace | `admin` or `super_admin` | — | Own work only: run searches, own cases, own reports, own wallet & top-ups, own profile/settings. Sub-roles scope it further: `analyst` (full search + case create), `officer` (search + case update), `viewer` (read-only), `billing` (invoices, wallet, pricing) |

Enforcement points (defence in depth — UI hiding is *not* the control):
1. `can(user, permission)` used by nav, page router, and every mutating button.
2. `assertCan()` inside the service layer — a hidden button cannot be invoked directly.
3. Route guard in `PageRouter` → `AccessDenied` screen (no silent redirect loops).
4. **Hard invariant:** `createUser` rejects `tier === 'super_admin'` from any caller; the
   seeded super admin carries `isSystem: true` and cannot be edited, deactivated,
   role-changed, or deleted. The role dropdown simply never offers Super Admin.

### B3. Persistence (`src/lib/storage.ts`)
Namespaced, versioned, crash-safe localStorage wrapper (`iprs.v1.*`) with schema
migration + `resetAll()`. Auth session, wallet, transactions, provider configs, settings,
audit log, notification prefs, appearance, and users all survive a refresh.

### B4. Swappable service layer (`src/services/`)
`http.ts` probes `/api/health` once at boot. If the Express backend answers, every call
goes over HTTP; if not, an in-browser **mock adapter** with identical signatures and
realistic latency serves the same contract. UI never knows which is active (a status chip
in the header shows `API` vs `LOCAL`).

`auth.service.ts`, `wallet.service.ts`, `payment.service.ts`, `provider.service.ts`,
`admin.service.ts`, `settings.service.ts`, `report.service.ts`, `usage.service.ts`.

### B5. Real backend scaffold (`server/`)
Node 22 + Express + built-in `node:sqlite` (no native compilation, no new heavy deps).
Typed routes mirroring the service contract exactly:
`/api/health`, `/api/auth/login`, `/api/users`, `/api/wallet`, `/api/wallet/transactions`,
`/api/wallet/topup/mpesa/stk`, `/api/wallet/topup/mpesa/confirm`,
`/api/wallet/topup/card`, `/api/payments`, `/api/providers`, `/api/providers/:id/test`,
`/api/providers/:id/logs`, `/api/api-keys`, `/api/settings`, `/api/audit`, `/api/sessions`,
`/api/pricing`, `/api/usage`. Vite dev-proxy forwards `/api` → `:8787`.
The M-PESA STK endpoint models the real Daraja shape (`CheckoutRequestID`,
`MerchantRequestID`, `ResultCode`, `ResultDesc`, `MpesaReceiptNumber`) so swapping in live
credentials is a config change, not a rewrite.

---

## 3. Workstream C — Responsive system

New primitives in `src/components/ui/`: `ResponsiveTable` (real `<table>` ≥ md, stacked
cards < md — fixes the "table overflows on phones" class of bug everywhere), `Tabs`
(scrollable, keyboard-navigable, `aria-selected`), `Modal`, `Drawer`, `Toggle`, `Field`,
`Select`, `StatCard`, `Panel`, `Badge`, `EmptyState`, `Skeleton`, `CopyButton`,
`SegmentedControl`, `ProgressBar`, `SearchInput`.

Rules applied to every touched screen: nothing wider than `100vw` at 360 px, all tab
strips scroll horizontally, all grids collapse 4→2→1, all tables degrade to cards,
touch targets ≥ 40 px, sticky headers stay sticky inside their scroll container.

---

## 4. Workstream D — Identity Profile results (Screen 4)

Rebuilt tab-driven, each tab with genuinely different, fully-populated content sourced from
the `Dossier` model:

- **Overview** — subject hero, risk gauge, verdict, provider verification grid, key findings, dossier completeness.
- **Personal** — full civil-registration record: names, aliases, ID/passport, DOB, gender, nationality, county/sub-county, addresses (postal + physical + utility-confirmed), contacts, marital status, next of kin, documents on file, photo match score.
- **Financial** — KRA tax status & compliance history, income band estimate, M-PESA account (tenure, tier, limits, activity band), CRB score + listing status + open facilities table, bank/utility payment behaviour, financial red flags.
- **Connections** — employer & employment history, business/KYB directorships & shareholdings, relationships graph (SVG force-free radial layout), guarantors, shared-address/shared-phone links, PEP & sanctions screening result.
- **Logs** — every verification event for this subject: timestamp, actor, provider called, fields requested, response code, latency, cost, consent reference, data lineage, retention expiry.

Responsive: 1-col at mobile, 2-col at md, 3-col at xl; all sub-tables use `ResponsiveTable`.

---

## 5. Workstream E — Detailed Report (Screen 5): Summary ≠ Full Report, real print, real PDF

### E1. Two genuinely different views
- **Summary** — executive one-pager: verdict, risk gauge, score drivers, key findings, per-section status snapshot (verified/not-verified/insufficient), recommendation, sign-off block.
- **Full Report** — **every section expanded with the raw extracted values**: section rail + anchors, each field rendered with `value / source / retrieved-at / confidence / match-rule`. Includes raw provider response payloads (PII-masked per settings), the audit chain, and the disclaimer/attestation page. This is a different component tree from Summary, sharing only the header.

### E2. Real print
New `src/components/report/PrintReport.tsx` rendered into a dedicated `#print-root` that is
`display:none` on screen and `display:block` in `@media print`, while the app chrome is
`display:none` in print. Light paper theme, `@page` margins, running header (report ID +
confidentiality marking), running footer (page N of M via CSS counters), `break-inside:
avoid` on section cards, forced page break before the attestation. Prints the **complete
extracted dataset**, not the on-screen card.

### E3. Real PDF download (dependency-free)
`src/lib/pdf.ts` — a small PDF 1.4 writer: page tree, Helvetica/Helvetica-Bold/Courier
fonts, text with automatic word-wrap and page-break, rules/rects for tables, header/footer
with page numbers, proper xref table + trailer. Produces a `Blob` → `Object URL` → anchor
`download` → revoke. No new npm dependency, works fully offline inside the single-file
build. Validated by parsing the emitted bytes (object count, xref offsets, `startxref`,
`%%EOF`) and by opening in a reader.

Also wired to: report PDF, invoice PDFs, wallet statement PDF, pricing schedule PDF,
audit-log CSV, user CSV, provider-log CSV.

---

## 6. Workstream F — User Profile & Settings (Screen 13)

Four real, persisted panels:
- **Profile** — identity, contact, organisation, department, timezone/locale/currency, avatar; dirty-state tracking + unsaved-changes guard.
- **Security** — password change with live strength meter validated against the org password policy from System Settings; TOTP 2FA enrolment (secret + recovery codes + verify step); active sessions with per-session revoke & "revoke all other sessions"; login history; personal API keys (create/rotate/revoke/copy, last-used, scopes); trusted devices; personal IP allowlist.
- **Notifications** — matrix of **channels** (in-app, email, SMS, webhook) × **events** (case assigned/updated, report ready, payment success/failed, low wallet balance, quota warning, provider outage, security alert, login from new device, weekly digest), plus quiet hours, digest frequency, SMS number verification, webhook URL + test-send. Preferences actually drive the app (e.g. low-balance threshold triggers a toast + notification).
- **Appearance** — accent colour, density (compact/comfortable), base font scale, sidebar collapsed by default, reduce motion, mono-numerals. Applied live via CSS variables on `:root`.

---

## 7. Workstream G — Admin Console (Screen 9) upgrade

Tabs: **Users**, **Roles & Permissions**, **Sessions**, **Audit Log**, **Organisation**.
- Users — search/filter/sort/paginate, add/edit drawer with validation, role + sub-role + department, activate/deactivate, password reset, MFA reset, delete with typed confirmation; **Super Admin row is lock-badged and immutable**; **Admin row actions are hidden/disabled unless the actor is Super Admin**; CSV export.
- Roles & Permissions — full permission matrix (role × permission, view/create/edit/delete/export/approve), Super-Admin-only editing, diff-from-default highlighting, reset-to-default, live "what this role can see" preview.
- Sessions — every active session platform-wide: user, tier, IP, device, started, last-seen; force-logout.
- Audit Log — immutable append-only trail with filters (actor, action, entity, severity, date), detail payload viewer, CSV/PDF export.
- Organisation — org profile, support contacts, data-protection officer, business hours.

---

## 8. Workstream H — Provider Management interaction fields (Screen 10)

The missing piece. Each provider becomes a fully configurable integration:

**Connection** — display name, code, category, environment (`sandbox`/`live`), base URL, endpoint path, HTTP method, auth type (`api_key`/`bearer`/`oauth2`/`mtls`/`basic`), consumer key, consumer secret, token URL, certificate reference, IP allowlist, enabled toggle, maintenance window.
**Behaviour** — timeout (ms), retries, backoff strategy, rate limit (req/min), concurrency, cache TTL, circuit-breaker thresholds, queue priority.
**Commercial** — cost per call (KES), cost per successful call, monthly included quota, overage rate, billing mode (wallet debit / invoice), SLA target.
**Field mapping** — the interaction contract: table of `platform field ← provider field`, type, required, transform (`none`/`uppercase`/`mask`/`date-iso`/`phone-e164`), default, plus request template and response sample JSON with a live path tester.
**Webhooks** — callback URL, secret, subscribed events, retry policy, test-send.
**Operations** — Test Connection (timed handshake with per-stage results), Save, Reset, Re-sync, request log (time, actor, subject ref, endpoint, status, latency, cost, response code) with masked payload viewer, usage & cost analytics, alert thresholds.

Tabs become real: **Providers**, **Field Mapping**, **API Keys** (create/rotate/revoke/scopes/last-used), **Request Logs**, **Usage & Cost**.

---

## 9. Workstream I — System Settings (new module)

Ten groups, all persisted, all writing audit entries on change, all tier-gated
(super_admin: full write; admin: operational groups writable, security/compliance read-only;
user: no access):

1. **General & Organisation** — org name, legal entity, KRA PIN, address, contacts, timezone, locale, currency, fiscal year, business hours.
2. **Branding** — accent colour, login headline/subtext, email sender name, report footer/disclaimer, white-label toggle.
3. **Security & Access** — password policy (length, complexity classes, expiry days, history depth, breach check), MFA enforcement per tier, session timeout, idle timeout, max concurrent sessions, lockout threshold & duration, IP allow/deny lists, geo-fencing, trusted-device memory, captcha on login.
4. **Compliance & Data Protection** — Kenya Data Protection Act 2019 posture, DPO contact, consent capture mode, lawful-basis register, PII masking rules per field, retention periods per record type, right-to-erasure workflow, cross-border transfer flag, audit retention, purpose limitation text.
5. **Risk Engine** — per-provider score weights, band thresholds (low/medium/high), auto-flag rules (PEP hit, CRB default, address mismatch, deceased flag…), manual-review queue on/off, minimum confidence to auto-approve, model version & changelog.
6. **Billing & Wallet** — currency, VAT rate, invoice prefix & numbering, payment channels (M-PESA shortcode/paybill/passkey, card gateway + keys), wallet policy (min/max top-up, auto top-up trigger & amount, low-balance alert threshold, overdraft allowed, negative-balance block on search), credit terms, discount rules.
7. **Pricing Catalogue** — editor over the KYC/KYB price sheet (see Workstream J): volume bands, per-check prices, bundle composition, plan entitlements, effective date, validity, publish/revert.
8. **Integrations** — outbound webhooks (event, URL, secret, retry, signature), SMTP, SMS gateway, SSO/SAML/OIDC, object storage/backup target, ERP/HR export.
9. **Platform & Performance** — API rate limits per tier, global concurrency, cache TTL, worker count, log level, telemetry consent, feature flags, environment selector, **maintenance mode** (+ banner message, who is exempt).
10. **Backup, Recovery & Danger Zone** — snapshot schedule, last snapshot, export full config (JSON), import config, reset a group to defaults, reset the whole workspace.

---

## 10. Workstream J — Pricing from the KYC/KYB Financial Proposal 2026 (0–500 batch only)

> **Blocker note:** the referenced PDF is not present in the workspace (searched the entire
> filesystem — no PDFs). Rather than stall the whole delivery, pricing is implemented
> against a single source-of-truth config, `src/data/pricing.ts`, with a clearly marked
> `⚠ PLACEHOLDER — replace with figures from "KYC KYB Financial Proposal 2026.pdf"` header.
> Dropping in the real numbers is a **one-file edit** and every consumer (pricing page,
> billing, wallet debit rates, cost calculator, PDF schedule, admin pricing editor) updates
> automatically.

Scope locked to the **0–500 batch** band as instructed — higher bands are not rendered.

Structure modelled on a KYC/KYB financial proposal:
- **KYC line items** — National ID verification, KRA PIN validation, M-PESA name/number match, CRB individual report & score, address/utility verification, employer verification, criminal & court record check, PEP/sanctions screening, deceased-registry check.
- **KYB line items** — company registry search, director/officer verification, beneficial-ownership register, business tax compliance, CRB business report, litigation & insolvency search, trade licence verification.
- Per-item: unit price (KES), included quota in the 0–500 batch, overage rate, turnaround, data source, confidence tier.
- Bundles (Basic / Standard / Comprehensive) composed from line items, with bundle price and per-check effective rate.
- Subscription: monthly access fee for the 0–500 batch, setup fee, VAT 16%, total first invoice, effective date, validity period, payment terms (M-PESA / card / bank transfer), and the commercial notes/exclusions an actual proposal carries.
- **Cost calculator**: pick line items × volume (capped at 500) → subtotal, VAT, total, effective per-check rate, wallet impact; export as PDF schedule.

---

## 11. Workstream K — Wallet management & payments

### K1. User wallet (`/wallet`)
Balance card (available / held / lifetime topped-up / lifetime spent), quick top-up,
transaction ledger (credit/debit, reference, channel, status, running balance) with filters
+ CSV/PDF statement export, payment methods (M-PESA number, saved cards with brand
detection), auto top-up configuration, low-balance alert threshold, wallet statements by month.

### K2. Top-up flows
- **M-PESA (STK push)** — enter phone (validated to `2547XXXXXXXX`/`07XXXXXXXX`) + amount →
  simulated Daraja STK request → "Check your phone" state with countdown → success
  (receipt number, `ResultCode 0`) / cancel (`ResultCode 1032`) / timeout (`ResultCode 1037`)
  / insufficient funds (`ResultCode 2001`) paths, all modelled.
- **Card** — number (Luhn-validated, brand-detected), expiry, CVC, name; 3-D Secure OTP
  step; success/decline paths; card tokenised for display (last 4 only).
- Every outcome writes: wallet transaction, payment record, notification, audit entry, and
  a provider-style gateway log.

### K3. Wallet debits
Running a search prices the selected checks from the pricing catalogue and debits the wallet
(insufficient balance → blocked with a top-up prompt, per the overdraft setting). Each debit
records cost breakdown per provider call.

### K4. Admin payment monitoring (`/payments`, admin + super_admin)
All payments across all users: KPIs (gross top-ups, successful/failed/pending, refunds,
net revenue, average top-up, channel split), filterable ledger (user, channel, status,
amount range, date), per-payment detail drawer with the raw gateway response, refund &
retry-failed actions, reconciliation view (gateway receipt vs wallet credit), revenue trend
chart, CSV/PDF export. Super Admin additionally sees platform-wide revenue, gateway
settlement summary, and per-provider cost-vs-revenue margin.

### K5. System-use & provider-request monitoring
Admin dashboard surfaces live system use (searches, active sessions, API calls, error rate,
latency) and the provider request log (which provider, which user, which subject, status,
cost) — the "monitor all system use, requests from providers" requirement.

---

## 12. Workstream L — Three distinct dashboards

`DashboardPage` resolves by tier; each is a different component with different data,
different quick actions, and different nav:

- **User Workspace** (`DashboardUser`) — greeting, my wallet balance + top-up CTA, my remaining quota for the 0–500 batch, my recent searches, my open cases, my reports awaiting review, provider status (read-only), my notifications. Quick actions: New Search, My Cases, Top Up Wallet.
- **Admin Console Dashboard** (`DashboardAdmin`) — org KPIs (searches, success rate, active users, wallet throughput), team activity feed, provider health + request volume + error rate, payment monitor summary with failed-payment alerts, quota consumption by user, open high-risk cases, security alerts. Quick actions: Manage Users, Providers, Payments, Cases.
- **Super Admin Dashboard** (`DashboardSuperAdmin`) — platform KPIs (gross revenue, net margin, cost-per-verification, tenant counts), admin-account status, permission-matrix drift, full audit trail stream, system settings health (unconfigured groups, expiring certificates/keys, backup age), maintenance-mode control, risk-engine posture, escalation queue. Quick actions: Create Admin, System Settings, Audit Log, Pricing Catalogue.

Nav/sidebar, command palette, header shortcuts, and page access all filter by tier +
permission, so the three experiences are visibly and functionally different.

### L1. Login (Screen 1) rebuilt
Real credential check against the user store (email + password + active status + tier),
per-role demo credential chips to switch personas instantly, lockout after N failures
(driven by the security settings), optional MFA step when the account has 2FA on, and
post-login routing to that tier's dashboard. Session persisted.

---

## 13. Delivery order & verification

1. Foundation (types, permissions, storage, services, data) → 2. Removals → 3. UI primitives
→ 4. PDF + print engine → 5. Identity Profile → 6. Detailed Report → 7. User Profile
→ 8. Admin Console → 9. Providers → 10. System Settings → 11. Pricing → 12. Wallet/Payments
→ 13. Dashboards + Login + routes/nav → 14. Backend scaffold + proxy → 15. Polish.

**Verification gates (all must pass):**
- `npx tsc --noEmit` clean under `strict` + `noUnusedLocals` + `noUnusedParameters`.
- `npm run build` clean; single-file output still self-contained.
- Emitted PDF bytes validated structurally (header, object/xref consistency, `%%EOF`).
- Backend boots and answers `/api/health`; frontend flips to `API` mode automatically.
- Manual matrix: each of the 3 personas logs in and sees only its own dashboard, nav, and
  tools; a `user` cannot reach `/admin`, `/settings`, or `/payments` by hash deep-link;
  `admin` cannot create another `admin`; nobody can create or mutate the Super Admin.
- Responsive pass at 360 / 768 / 1280 / 1920 px on every touched screen.
- State survives a full page refresh (persistence).
