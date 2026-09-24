# z-profile — IPRS Kenya identity-verification platform (demo)

A three-tier identity-intelligence demo: verification searches across mock Kenyan data
providers, dossiers with full provenance, wallet + M-PESA/card payments, provider
management, system settings, audit — with User / Admin / Super Admin tiers getting
genuinely different dashboards, tools and access. React 19 + Vite 7 + Tailwind 4,
built to a **single self-contained HTML file**, backed by an optional Express +
`node:sqlite` API the frontend transparently falls back from when it's down.

> Demo-grade by design: seeded data, a simulated M-PESA gateway by default. The
> permission engine, signed-session auth, payment state machine and 241-assertion
> test gate are real.

## Security model

- **Signed session tokens** — login issues an HMAC-SHA256 bearer token bound to a live
  session row (logout revokes instantly, 12 h expiry, secret persisted per-database or
  pinned via `IPRS_AUTH_SECRET`). The frontend stores it and sends `Authorization: Bearer`.
- **Server-side RBAC** — every privileged route is guarded by the same
  `effectivePermissions()` engine the UI uses; a hand-rolled request gets `401`/`403`.
- **Legacy header fallback** — `ALLOW_HEADER_AUTH=1` (the default for demo convenience)
  still accepts `x-user-id`, which anyone can forge. Set `ALLOW_HEADER_AUTH=0` to require
  real tokens; `npm run verify` proves both modes.
- Known demo shortcuts, honestly: plaintext seeded passwords, `x-user-id` fallback above,
  and no TLS story. Replace all three before any real deployment.

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
npm run verify     # typecheck + build + 247 assertions:
                   #   API 63 · DOM 44 · write-flows 63 · requirement-traceability 77
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
schedule and backend seed all read it). The 0–500 batch is transcribed from the KYC/KYB
Financial Proposal 2026: **15 of 25** line items carry `confirmedFromProposal: true`;
the Vehicle table arrived truncated and the extract quotes no criminal, deceased or KYB
products, so those 10 stay flagged and every banner reports the exact split.

## Docs

- `docs/IMPLEMENTATION_PLAN.md` — the executed plan of record (original audit → delivery)
- `docs/MANUAL_TEST_CHECKLIST.md` — per-persona visual QA walkthrough
- `AGENTS.md` — architecture + gotchas for coding agents
