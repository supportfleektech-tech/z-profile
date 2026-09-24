# z-profile — IPRS Kenya identity-verification platform (demo)

A three-tier identity-intelligence demo: verification searches across mock Kenyan data
providers, dossiers with full provenance, wallet + M-PESA/card payments, provider
management, system settings, audit — with User / Admin / Super Admin tiers getting
genuinely different dashboards, tools and access. React 19 + Vite 7 + Tailwind 4,
built to a **single self-contained HTML file**, backed by an optional Express +
`node:sqlite` API the frontend transparently falls back from when it's down.

> Demo-grade by design: seeded data, a simulated M-PESA gateway by default. The
> permission engine, signed-session auth, scrypt-hashed passwords, payment state machine
> and 270-assertion test gate are real.

## Security model

- **Signed session tokens only** — login issues an HMAC-SHA256 bearer token bound to a
  live session row (logout revokes instantly, 12 h expiry, secret persisted
  per-database or pinned via `IPRS_AUTH_SECRET`). The frontend sends
  `Authorization: Bearer`; the forgeable `x-user-id` header fallback has been
  **retired entirely** — identity is proven, never claimed.
- **Password hashing** — credentials are stored as salted **scrypt** hashes
  (`s1$<salt>$<hash>`); plaintext never survives a boot (seeded fixtures are migrated
  at start-up), account creation and resets hash on arrival, and neither the plaintext
  nor the hash is ever returned by the API.
- **Server-side RBAC** — every privileged route is guarded by the same
  `effectivePermissions()` engine the UI uses; a hand-rolled request gets `401`/`403`.
- Known demo shortcuts, honestly: the browser-mock adapter compares passwords
  client-side (it has no server to hash against), and there is no TLS story. Fix both
  (plus real session infra) before any production use.

## Real M-PESA (Daraja) swap

The wallet's STK simulation is replaced by the live Daraja API when these are set:

```bash
DARAJA_CONSUMER_KEY=… DARAJA_CONSUMER_SECRET=… DARAJA_SHORTCODE=…   DARAJA_PASSKEY=… DARAJA_ENV=sandbox   DARAJA_CALLBACK_URL=https://your-host/api/wallet/topup/mpesa/callback npm run server
```

`GET /api/health` reports `gateway: { mode, env, missing }`. In live mode a failed
dispatch is a `502`, never a fabricated success; settlement arrives via the callback route.

## Run it

```bash
npm install
npm run dev:all    # Express API on :8787 + Vite on :5173 (proxies /api)
```

Frontend only (in-browser mock adapter): `npm run dev`.
Production single-file bundle: `npm run build` → `dist/index.html`.

**Demo password for every seeded account:** `Iprs@2026!`

| Sign in as | Email | Tier |
|---|---|---|
| John Kamau | `superadmin@iprs.co.ke` | Super Admin (seeded, cannot be created) |
| David Mbugua | `admin@iprs.co.ke` | Admin |
| Sarah Wanjiku | `analyst@iprs.co.ke` | User · Analyst |
| Mike Ochieng | `officer@iprs.co.ke` | User · Officer |
| — | `viewer@iprs.co.ke` / `billing@iprs.co.ke` | User · Viewer / Billing |

## Verify

```bash
npm run verify     # typecheck + build + 270 assertions:
                   #   API 77 · DOM 44 · write-flows 64 · requirement-traceability 85
```

`scripts/smoke-requirements.mjs` maps every acceptance criterion from the original
brief (distinct profile tabs, Summary ≠ Full Report, settings that persist, provider
config that saves, tier denials that deny, pricing provenance) to live assertions on
the built bundle. `docs/MANUAL_TEST_CHECKLIST.md` covers the visual clicks no automated
suite can perform.

## Spin Mobile (Kenya) integration

All 21 documented Kenya modules from docs.spinmobile.co are transcribed into
`src/data/spinModules.ts`: the SuperCrunch auth contract (`POST /analytics/auth/`,
consumer key + secret → ~10-minute bearer token), each module's `search_type`, endpoint,
request/response parameters, and the priced item it delivers. The New Search catalogue
badges every check with its real `search_type`; Provider Management shows the full module
table; `GET /api/spin/modules` serves the registry; and `server/spin.mjs` executes live
searches when `SPIN_CONSUMER_KEY`/`SPIN_CONSUMER_SECRET` are set (health reports the
mode). Full review: `docs/SPIN_INTEGRATION.md`.

## Pricing

All rates live in `src/data/pricing.ts` (single-file edit; UI, wallet debits, PDF price
schedule and backend seed all read it). The **full proposal has been received** and the
0–500 batch is transcribed exactly as quoted, VAT exclusive — **28 of 34** line items
confirmed: Identity Verification APIs 30 (back-up 45), Alien/AML-PEP/Passport 75,
Utility & Compliance 20, Phone-by-ID 50, Spin Score 130, Scanned Statement 120 + 4/page,
Motor Vehicle Ownership 1,160, Driver's Licence 200 (back-up 260), Metropol 85/150/300,
CreditInfo 50/350/2,000, and BRS (KYB) APIs at 1,300. The six rates the proposal never quoted (criminal, deceased, business tax
compliance, CRB business report, and the two Spin-documented composites) were
**priced by platform decision** through the Super Admin price editor and are
recorded as such in the catalogue — the platform is now **fully priced (34/34)**
and every provisional banner has dropped. Higher volume bands are quoted but not
wired, per instruction.

**Price governance:** the Super Admin adjusts every rate live on **Pricing & Tiers** —
per-item unit, overage, back-up and per-page rates plus bundle prices, via inline inputs
and a per-row edit drawer. `pricing.edit` is deliberately Super-Admin-only (Admin holds
`pricing.view`); every committed change is audit-logged with its old → new values and
takes effect immediately across New Search, wallet debits, the PDF schedule and the
backend (they all read this one catalogue).

## Docs

- `docs/IMPLEMENTATION_PLAN.md` — the executed plan of record (original audit → delivery)
- `docs/MANUAL_TEST_CHECKLIST.md` — per-persona visual QA walkthrough
- `AGENTS.md` — architecture + gotchas for coding agents
