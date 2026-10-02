# Fleek IPRS SaaS Go-Live Guide

> **Purpose:** Step-by-step deployment guide for taking Fleek IPRS from development to production for ~500 clients.

---

## 1. Overview & Architecture

**Product:** Fleek IPRS — Kenya's Trusted Identity & Background Intelligence Platform  
**Target Scale:** ~500 concurrent client organizations  
**Stack:** React 19 + TypeScript + Vite 7 + Tailwind 4 (frontend) | Node 22 + Express 5 + PostgreSQL (backend)  
**Build:** Single-file SPA (`vite-plugin-singlefile`) → `dist/index.html`  
**Auth:** HMAC-signed bearer tokens (12h TTL), scrypt password hashing, bearer-only (no `x-user-id` fallback)  
**RBAC:** 3 tiers — Super Admin → Admin → User (no sub-roles); sub-user system for team seats  
**Payments:** M-PESA STK Push (Daraja sandbox → production) + Card (3-DS simulation)  
**Email:** Resend (dev = outbox table, prod = API)  
**Search:** Spin Mobile Kenya (21 modules, SuperCrunch auth)  
**Deploy:** Vercel (frontend) + Render (backend) + Neon Postgres (database)  
**DNS/TLS:** Cloudflare (proxy, WAF, TLS)  
**Monitoring:** Sentry (errors) + UptimeRobot (uptime) + Grafana Cloud (metrics)

---

## 2. Prerequisites

| Item | Purpose | Notes |
|------|---------|-------|
| GitHub repo | Source of truth | All fixes committed, `main` branch |
| Resend account | Transactional email | Verify sender domain (`fleek-iprs.co.ke`) |
| Neon Postgres project | Production database | Free tier → paid as needed |
| Render account | Backend hosting | Node 22, persistent disk not needed (Neon is external) |
| Vercel account | Frontend hosting | Git-based deploys, preview URLs |
| Daraja production credentials | M-PESA live | Consumer Key/Secret/Shortcode/Passkey from Safaricom |
| Cloudflare account | DNS + TLS + WAF | `fleek-iprs.co.ke` + `api.fleek-iprs.co.ke` |
| Sentry project | Error tracking | DSN for frontend + backend |
| UptimeRobot account | Uptime monitoring | 5-min checks on `/api/health` |
| Grafana Cloud | Metrics/Logs | Free tier sufficient for 500 clients |

---

## 3. Environment Variables

### Frontend (Vercel)

```env
NEXT_PUBLIC_API_URL=https://api.fleek-iprs.com
NEXT_PUBLIC_APP_NAME=Fleek IPRS
```

### Backend (Render)

```env
# Runtime
PORT=8787
NODE_ENV=production

# Database
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/fleek_iprs?sslmode=require

# Auth
IPRS_AUTH_SECRET=super-secret-min-32-chars-generated-with-openssl-rand-base64-32

# Email (Resend)
RESEND_API_KEY=re_xxxx
RESEND_FROM=Fleek IPRS <noreply@fleek-iprs.co.ke>

# M-PESA (Daraja Production)
DARAJA_CONSUMER_KEY=xxxx
DARAJA_CONSUMER_SECRET=xxxx
DARAJA_SHORTCODE=123456
DARAJA_PASSKEY=yyyy
DARAJA_ENV=production

# Frontend URL (for CORS, email links)
FRONTEND_URL=https://fleek-iprs.co.ke

# Cron secret (for sub-user billing cron)
IPRS_CRON_SECRET=generated-with-openssl-rand-base64-32

# Optional: Sentry
SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## 4. Database Migration (SQLite → Postgres)

The development backend uses `node:sqlite` at `server/.data/iprs.sqlite`. Production uses Neon Postgres.

### Export from SQLite

```bash
# From project root
sqlite3 server/.data/iprs.sqlite .dump > sqlite_dump.sql
```

### Import to Neon

```bash
# Create schema on Neon first (run the schema creation statements from the dump)
psql "$DATABASE_URL" -f schema.sql

# Then import data (may need to adjust for Postgres syntax)
psql "$DATABASE_URL" -f data.sql
```

**Schema differences to handle:**
- `INTEGER PRIMARY KEY` → `SERIAL PRIMARY KEY` or `BIGSERIAL`
- `BOOLEAN` → `BOOLEAN` (Postgres native)
- `DATETIME` → `TIMESTAMP WITH TIME ZONE`
- `AUTOINCREMENT` → `GENERATED ALWAYS AS IDENTITY`
- SQLite `json()` functions → Postgres `jsonb` functions (`->>`, `#>>`, etc.)

**Key tables to verify:** `users`, `wallets`, `wallet_transactions`, `payments`, `providers`, `provider_configs`, `audit`, `sessions`, `settings`, `pricing`, `search_history`, `usage`, `cases`, `invoices`, `pending_registrations`, `sub_user_invitations`, `email_outbox`.

---

## 5. Backend Deployment (Render)

1. **New Web Service** → Connect GitHub repo
2. **Settings:**
   - Name: `fleek-iprs-api`
   - Region: `Frankfurt` (closest to Kenya)
   - Branch: `main`
   - Runtime: `Node` (auto-detects Node 22 from `engines` in `package.json`)
   - Build Command: `npm install && npm run build`
   - Start Command: `node server/index.mjs`
3. **Environment Variables:** Add all from Section 3 (Backend)
4. **Persistent Disk:** Not needed (Neon is external)
5. **Health Check Path:** `/api/health` (auto-configured by Render)
6. **Custom Domain:** `api.fleek-iprs.com` → Render provides SSL

**Deploy:** Push to `main` → Render auto-deploys. Check logs for `IPRS demo backend listening on http://0.0.0.0:8787`.

---

## 6. Frontend Deployment (Vercel)

1. **New Project** → Import GitHub repo
2. **Framework:** Vite (auto-detected)
3. **Root Directory:** `.` (project root)
4. **Build Command:** `npm run build` (outputs `dist/index.html`)
4. **Output Directory:** `dist`
5. **Environment Variables:** Add from Section 3 (Frontend)
5. **Deploy:** `vercel --prod` or push to `main`
6. **Custom Domain:** `fleek-iprs.com` → Vercel provides SSL
7. **Preview Deployments:** Enabled by default on PRs

**Note:** The single-file build (`vite-plugin-singlefile`) produces one `index.html` with inlined JS/CSS — no asset hosting issues.

---

## 7. Email (Resend)

1. **Verify Domain:** Add `fleek-iprs.co.ke` in Resend dashboard → DNS records (DKIM, SPF, DMARC)
2. **Create Templates** (5 total):
   - `fleek-iprs-registration-approved` — credentials email for approved orgs
   - `fleek-iprs-pending-registration` — Super Admin notification + applicant rejection
   - `fleek-iprs-sub-user-invite` — sub-user invitation with temp password
   - `fleek-iprs-sub-user-billing` — monthly billing receipt for host
   - `fleek-iprs-sub-user-suspended` — suspension notice for host
3. **Set Environment:** `RESEND_API_KEY` + `RESEND_FROM` in Render
4. **Test:** Trigger registration → check Super Admin email → approve → check applicant email

---

## 8. M-PESA (Daraja Production)

1. **Apply for Production:** Safaricom Developer Portal → Go Live request
2. **Receive Credentials:** Consumer Key, Consumer Secret, Shortcode, Passkey
3. **Set Environment:** Add to Render (Section 3)
4. **Switch Gateway:** In `server/index.mjs`, `gateway.mode` will auto-detect live credentials → `gateway.mode = 'live'`
5. **Test:** STK Push with real Safaricom number → verify callback → wallet credit
6. **Fallback:** If Daraja fails, gateway returns 502 (honest failure) — never fabricated success

---

## 9. Monitoring & Observability

| Tool | Config | Purpose |
|------|--------|---------|
| **Sentry** | DSN in env; `@sentry/node` + `@sentry/react` | Error tracking, performance |
| **UptimeRobot** | Monitor `https://api.fleek-iprs.com/api/health` every 5 min | Uptime alerting (email/Slack) |
| **Grafana Cloud** | Prometheus endpoint (add `/metrics` to Express if needed) | Metrics dashboards, alerting |
| **Render Logs** | Built-in log streaming | Real-time backend logs |
| **Vercel Analytics** | Enabled in project settings | Frontend performance |

**Add `/metrics` endpoint** (optional, for Prometheus):
```js
// In server/index.mjs
app.get('/metrics', (req, res) => {
  // Return Prometheus-format metrics
  res.set('Content-Type', 'text/plain');
  res.send(`fleek_uptime_seconds ${process.uptime()}\n...`);
});
```

---

## 10. CI/CD (GitHub Actions)

Existing workflows (`.github/workflows/`):
- `verify.yml` — Runs on every push/PR: `typecheck + build + smoke-api + smoke-dom + smoke-flows + smoke-trace` (270 assertions)
- `deploy-pages.yml` — Manual dispatch for Vercel preview (or change to `push` to `main` for auto-deploy)

**Recommended:** Keep `verify.yml` as gate. Add `deploy-pages.yml` auto-deploy on `main` merge if desired.

---

## 11. DNS & Domain (Cloudflare)

1. **Add Domain:** `fleek-iprs.co.ke` + `api.fleek-iprs.com`
2. **DNS Records:**
   - `fleek-iprs.co.ke` → CNAME → `cname.vercel-dns.com` (proxied)
   - `api.fleek-iprs.com` → CNAME → `fleek-iprs-api.onrender.com` (proxied)
3. **SSL/TLS:** Full (Strict) — Cloudflare manages certs
3. **WAF Rules:** Enable OWASP Managed Ruleset, Rate Limiting (100 req/min/IP on `/api/*`)
4. **Page Rules:** Cache static assets, bypass admin paths

---

## 12. Backups

| Layer | Strategy | RPO/RTO |
|-------|----------|---------|
| **Neon Postgres** | Point-in-time recovery (automatic, 7-day retention) | RPO < 1s, RTO < 5 min |
| **Daily pg_dump** | Cron job → Cloudflare R2 / AWS S3 | RPO 24h, RTO < 1h |
| **SQLite (dev)** | Weekly `sqlite3 .dump` to local/Cloudflare R2 | Manual recovery |
| **Git** | Every commit is a backup | Instant |

---

## 13. Runbooks

### Deploy New Version
1. `git push origin main` → GitHub Actions runs `verify.yml`
2. If green: Render auto-deploys backend; Vercel auto-deploys frontend
3. Verify: `curl https://api.fleek-iprs.com/api/health` → `{"ok":true,...}`
4. Check Sentry for new errors (15 min post-deploy)

### Scale Up
- **Render:** Increase instance count / upgrade plan
- **Neon:** Auto-scales compute; storage auto-expands
- **Vercel:** Edge network auto-scales

### Daraja Failure
1. Sentry alert → `gateway.mode` switches to `simulated` (check `/api/health`)
2. Contact Safaricom support
3. Re-enable when Daraja recovers

### Data Recovery
1. **Neon PITR:** Console → Branch → Restore to timestamp
2. **pg_dump restore:** `psql "$DATABASE_URL" < backup.sql`
3. **Full rebuild:** Fresh deploy → Neon PITR → DNS switch

---

## 14. Security Checklist

- [ ] No hardcoded secrets (all in env vars)
- [ ] CSP header set (`helmet` in Express)
- [ ] Rate limiting on `/api/*` (express-rate-limit: 100 req/min/IP)
- [ ] XSS sanitization on user inputs (React auto-escapes)
- [ ] GDPR: data retention, right-to-be-forgotten workflow (delete user + wallet + transactions)
- [ ] Passwords: scrypt-hashed at rest (already enforced)
- [ ] Session revocation on logout (already enforced)
- [ ] No `x-user-id` fallback (bearer-only auth, already enforced)
- [ ] MFA for Super Admin (enforced in seeds)
- [ ] Audit log immutable (append-only, already implemented)

---

## 15. Final Checklist Before Go-Live

- [ ] `npm run verify` passes locally (270 assertions)
- [ ] `npm run build` produces `dist/index.html` (~1.1 MB)
- [ ] All env vars set in Render + Vercel
- [ ] Resend domain verified + templates created
- [ ] Daraja production credentials tested
- [ ] Neon database migrated + seeded
- [ ] Cloudflare DNS + TLS + WAF configured
- [ ] Sentry + UptimeRobot + Grafana connected
- [ ] DNS propagated (`dig fleek-iprs.co.ke`)
- [ ] End-to-end test: Register org → Super Admin approve → Login → Run search → Wallet top-up → Sub-user invite
- [ ] Sentry test error captured
- [ ] UptimeRobot alert fires on manual downtime

---

## 16. Deploy Artifacts

```
deploy/
├── render.yaml              # Render Blueprint (optional)
├── docker-compose.yml       # Local dev stack (Postgres + Redis)
├── Dockerfile.backend       # Backend container (if containerizing)
├── vercel.json              # Vercel config (if needed)
└── terraform/               # Terraform for Cloudflare/Neon (future)
```

**Note:** These are scaffolding — the live deploy uses Render/Vercel native Git integration.

---

*Generated: 2026-10-02 | Plan: Fleek IPRS SaaS Transformation | Version: 1.0*