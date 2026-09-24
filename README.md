# z-profile — IPRS Kenya identity-verification platform (demo)

A three-tier identity-intelligence demo: verification searches across mock Kenyan data
providers, dossiers with full provenance, wallet + M-PESA/card payments, provider
management, system settings, audit — with User / Admin / Super Admin tiers getting
genuinely different dashboards, tools and access. React 19 + Vite 7 + Tailwind 4,
built to a **single self-contained HTML file**, backed by an optional Express +
`node:sqlite` API the frontend transparently falls back from when it's down.

> Demo-grade by design: seeded data, simulated gateways, `x-user-id` header auth.
> The permission engine, payment state machine and 231-assertion test gate are real.

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
npm run verify     # typecheck + build + 231 assertions:
                   #   API 48 · DOM 44 · write-flows 63 · requirement-traceability 76
```

`scripts/smoke-requirements.mjs` maps every acceptance criterion from the original
brief (distinct profile tabs, Summary ≠ Full Report, settings that persist, provider
config that saves, tier denials that deny, pricing provenance) to live assertions on
the built bundle. `docs/MANUAL_TEST_CHECKLIST.md` covers the visual clicks no automated
suite can perform.

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
