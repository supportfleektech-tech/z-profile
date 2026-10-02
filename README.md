# Fleek IPRS — Kenya's Trusted Identity & Background Intelligence Platform

A three-tier SaaS platform for identity verification across Kenyan data providers: verification searches with full provenance, dossiers with PDF/print, wallet + M-PESA/card payments, provider management, system settings, audit — with **Super Admin / Admin / User** tiers plus **sub-user team seats**.

React 19 + Vite 7 + Tailwind 4, built to a **single self-contained HTML file**, backed by Express 5 + PostgreSQL API the frontend transparently falls back from when it's down.

> The permission engine, signed-session auth, scrypt-hashed passwords, payment state machine, sub-user billing, and 270-assertion test gate are production-ready.

---

## Security model

- **Signed session tokens only** — login issues an HMAC-SHA256 bearer token bound to a live session row (logout revokes instantly, 12 h expiry, secret persisted per-database or pinned via `IPRS_AUTH_SECRET`). The frontend sends `Authorization: Bearer`; the forgeable `x-user-id` header fallback has been **retired entirely** — identity is proven, never claimed.
- **Password hashing** — credentials are stored as salted **scrypt** hashes (`s1$<salt>$<hash>`); plaintext never survives a boot (seeded fixtures are migrated at start-up), account creation and resets hash on arrival, and neither the plaintext nor the hash is ever returned by the API.
- **Server-side RBAC** — every privileged route is guarded by the same `effectivePermissions()` engine the UI uses; a hand-rolled request gets `401`/`403`.
- **Sub-user isolation** — team seats share the host wallet (read-only) and exercise only host-granted permissions; audit trail tracks `actorUserId` + `hostUserId`.

---

## RBAC: Three tiers + Sub-users

| Tier | Permissions | Creates |
|------|-------------|---------|
| **Super Admin** (seeded) | All 57 permissions + platform governance | Admin |
| **Admin** | Analyst + Billing merged: searches, cases, reports, wallet, payments, providers, operational settings | User |
| **User** | Searches, cases, reports, own wallet, pricing, providers, profile | Sub-users (5 free, then 500 KSH/mo/seat) |
| **Sub-user** | Host-granted permissions only; shared wallet (read-only) | — |

---

## Real M-PESA (Daraja) swap

The wallet's STK simulation is replaced by the live Daraja API when these are set:

```bash
DARAJA_CONSUMER_KEY=… DARAJA_CONSUMER_SECRET=… DARAJA_SHORTCODE=… DARAJA_PASSKEY=… DARAJA_ENV=production DARAJA_CALLBACK_URL=https://your-host/api/wallet/topup/mpesa/callback npm run server
```

`GET /api/health` reports `gateway: { mode, env, missing }`. In live mode a failed dispatch is a `502`, never a fabricated success; settlement arrives via the callback route.

---

## Spin Mobile (Kenya) integration

All 21 documented Kenya modules transcribed into `src/data/spinModules.ts`: SuperCrunch auth contract (`POST /analytics/auth/`, consumer key + secret → ~10-minute bearer token), each module's `search_type`, endpoint, request/response parameters, and the priced item it delivers. New Search catalogue badges every check with its real `search_type`; Provider Management shows the full module table; `GET /api/spin/modules` serves the registry; `server/spin.mjs` executes live searches when `SPIN_CONSUMER_KEY`/`SPIN_CONSUMER_SECRET` are set (health reports the mode). Full review: `docs/SPIN_INTEGRATION.md`.

---

## Pricing

All rates live in `src/data/pricing.ts` (single-file edit; UI, wallet debits, PDF price schedule and backend seed all read it). **All 34/34 rates confirmed** from the proposal + platform-priced items. VAT exclusive. Super Admin adjusts every rate live on **Pricing & Tiers** with audit trail.

---

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

---

## Verify

```bash
npm run verify     # typecheck + build + 270 assertions:
                   #   API 77 · DOM 35 · write-flows 64 · requirement-traceability 85
```

`scripts/smoke-requirements.mjs` maps every acceptance criterion to live assertions on the built bundle. `docs/MANUAL_TEST_CHECKLIST.md` covers the visual clicks no automated suite can perform.

---

## Monitoring & Observability

| Tool | Endpoint | Purpose |
|------|----------|---------|
| **Sentry** | Frontend + Backend | Error tracking, performance, session replay |
| **UptimeRobot** | `https://api.fleek-iprs.com/api/health` | 5-min uptime checks |
| **Grafana Cloud** | `https://api.fleek-iprs.com/metrics` | Prometheus metrics, dashboards |
| **Render Logs** | Built-in | Real-time backend logs |
| **Vercel Analytics** | Enabled | Frontend performance |

**Prometheus metrics** at `GET /metrics`: uptime, memory, payments, users, providers, audit, sessions, cases.

Grafana dashboard: `deploy/grafana-dashboard.json` (import → Prometheus datasource).

---

## Deploy to Production

See **`docs/GO_LIVE.md`** for complete step-by-step guide:

- **Frontend**: Vercel (Git push → auto-deploy)
- **Backend**: Render (Git push → auto-deploy) + Neon Postgres
- **DNS/TLS**: Cloudflare (`fleek-iprs.co.ke`, `api.fleek-iprs.com`)
- **Email**: Resend (5 templates)
- **M-PESA**: Daraja production credentials
- **CI/CD**: GitHub Actions (`verify.yml` + `deploy-pages.yml`)

Deploy artifacts in `deploy/`: `render.yaml`, `docker-compose.yml`, `Dockerfile.*`, `nginx.conf`.

---

## Docs

- `docs/GO_LIVE.md` — Complete SaaS deployment guide
- `docs/IMPLEMENTATION_PLAN.md` — Executed plan of record
- `docs/MANUAL_TEST_CHECKLIST.md` — Per-persona visual QA walkthrough
- `docs/SPIN_INTEGRATION.md` — Spin Mobile Kenya deep dive
- `AGENTS.md` — Architecture + gotchas for coding agents
- `deploy/grafana-dashboard.json` — Grafana dashboard import