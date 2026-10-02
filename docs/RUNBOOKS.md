# Fleek IPRS — Operational Runbooks

Quick-reference procedures for production operations.

---

## 1. Deploy New Version

```bash
# 1. Ensure all tests pass locally
npm run verify

# 2. Push to main (triggers CI + auto-deploy)
git push origin main

# 3. Verify deployment
curl https://api.fleek-iprs.com/api/health
# Expected: {"ok":true,"service":"fleek-iprs-api",...}

# 4. Check Sentry for new errors (wait 15 min)
# 5. Check UptimeRobot for uptime
```

---

## 2. Scale Up

| Component | Action |
|-----------|--------|
| **Render (backend)** | Dashboard → Service → Scale → Increase instances or upgrade plan |
| **Neon (database)** | Auto-scales compute; storage auto-expands; upgrade plan for more compute |
| **Vercel (frontend)** | Edge network auto-scales; no action needed |

---

## 3. Daraja (M-PESA) Failure

**Symptoms**: Health endpoint shows `gateway.mode: "simulated"` or `gateway.missing` includes Daraja creds; STK pushes fail.

**Immediate**:
1. Check Render logs for Daraja errors
2. Verify `DARAJA_*` env vars in Render dashboard
3. Contact Safaricom support (reference: your shortcode)

**Recovery**:
- Once Daraja recovers, gateway auto-detects live creds → `gateway.mode: "live"`
- No code deploy needed

---

## 3. Database Recovery

### Point-in-Time Recovery (Neon)
1. Neon Console → Project → Branches → **Restore**
2. Select timestamp → Create branch → Update `DATABASE_URL` in Render → Redeploy

### Full Restore from pg_dump
```bash
# On local machine with DATABASE_URL set
pg_dump "$DATABASE_URL" > backup.sql
# After incident:
psql "$DATABASE_URL" < backup.sql
```

### Full Rebuild (last resort)
1. Fresh deploy to Render + Neon
2. Neon PITR to known-good timestamp
3. Verify `/api/health` → DNS switch

---

## 4. Sub-User Billing Issues

**Symptoms**: Host wallet insufficient → all sub-users suspended.

**Resolution**:
1. Host tops up wallet via `/wallet` (M-PESA or card)
2. Cron runs at 02:00 UTC daily → re-charges → reactivates
3. **Manual reactivation** (if urgent):
   ```sql
   UPDATE users SET status='Active' WHERE parentUserId='<host-id>';
   ```

---

## 5. Sentry Alert Triage

| Alert Type | Action |
|------------|--------|
| **Unhandled Exception** | Check stack trace → link to commit → hotfix if critical |
| **Performance Regression** | Check transaction traces → identify slow query/endpoint |
| **Session Replay** | Watch replay → reproduce → fix |

**Escalation**: Critical errors → PagerDuty/Slack → on-call engineer within 15 min.

---

## 6. UptimeRobot Alert

**Alert**: `api.fleek-iprs.com` down

**Immediate**:
1. Check Render service status (dashboard.render.com)
2. Check Cloudflare status (cloudflarestatus.com)
3. `curl -v https://api.fleek-iprs.com/api/health` from local

**If Render down**: Wait for Render recovery (they notify via email/statuspage).

**If Cloudflare down**: Pause Cloudflare proxy (DNS only) → verify direct to Render.

---

## 6. SSL/TLS Certificate Issues

**Cloudflare manages certs** (Full/Strict mode). If cert expires:
1. Cloudflare dashboard → SSL/TLS → Edge Certificates → **Disable Universal SSL** → wait 5 min → **Enable**
4. Verify: `curl -I https://api.fleek-iprs.com/api/health`

---

## 7. Rate Limit / DDoS

**Cloudflare WAF** handles most. If overwhelmed:
1. Cloudflare → Security → WAF → **Enable "Under Attack Mode"**
2. Security → Rate Limiting → Create rule: `/api/*` 100 req/min per IP
3. Security → Bots → Enable **Bot Fight Mode**

---

## 8. Email Delivery Issues (Resend)

**Symptoms**: Applicants don't receive credentials; Super Admin doesn't get notifications.

**Check**:
1. Resend dashboard → Logs → filter by `fleek-iprs-` templates
2. Verify `RESEND_API_KEY` + `RESEND_FROM` in Render
3. Check domain verification in Resend (DKIM/SPF/DMARC)

**Retry failed emails**:
- Resend dashboard → Logs → Failed → **Retry**

---

## 9. Super Admin Account Recovery

**If Super Admin locked out**:
1. Direct database access (Neon console):
   ```sql
   UPDATE users SET failed_login_attempts=0, lockedUntil=NULL WHERE email='superadmin@fleek-iprs.co.ke';
   ```
2. Or use seeded backup: `superadmin@fleek-iprs.co.ke` / `Iprs@2026!` (never change this)

---

## 10. Log Locations

| Source | Location |
|--------|----------|
| **Backend logs** | Render Dashboard → Service → Logs |
| **Frontend errors** | Sentry → Issues |
| **Frontend performance** | Vercel Analytics |
| **Database queries** | Neon Console → Query Insights |
| **Daraja callbacks** | Render Logs (filter `callback`) |
| **Cron job output** | Render Logs (filter `cron`) |

---

## 11. Environment Variable Reference

| Variable | Service | Required | Notes |
|----------|---------|----------|-------|
| `DATABASE_URL` | Render | Yes | Neon connection string |
| `IPRS_AUTH_SECRET` | Render | Yes | `openssl rand -base64 32` |
| `RESEND_API_KEY` | Render | Yes | Resend dashboard |
| `RESEND_FROM` | Render | Yes | Verified domain |
| `DARAJA_CONSUMER_KEY` | Render | Prod only | Safaricom |
| `DARAJA_CONSUMER_SECRET` | Render | Prod only | Safaricom |
| `DARAJA_SHORTCODE` | Render | Prod only | Safaricom |
| `DARAJA_PASSKEY` | Render | Prod only | Safaricom |
| `DARAJA_ENV` | Render | Yes | `production` or `sandbox` |
| `FRONTEND_URL` | Render | Yes | `https://fleek-iprs.co.ke` |
| `IPRS_CRON_SECRET` | Render | Yes | `openssl rand -base64 32` |
| `SENTRY_DSN` | Both | Yes | Sentry project |
| `VITE_SENTRY_DSN` | Vercel | Yes | Sentry project |
| `VITE_API_URL` | Vercel | Yes | `https://api.fleek-iprs.com` |

---

*Keep this document updated. Last review: 2026-10-02*