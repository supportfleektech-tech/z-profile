# Manual QA Checklist — Z-Profile IPRS demo

jsdom drives every automated gate (85 unit tests and 318 smoke assertions across `npm run verify`), but jsdom performs **no layout**. These clicks have never been *seen*. Work top-to-bottom at each width: **360**, **768**, **1280**, **1920**. Log anything that overflows, clips, traps scroll, or mis-stacks.

**Sign in:** password `Iprs@2026!` for every account.

| Persona | Email | Tier |
|---|---|---|
| John Kamau | superadmin@iprs.co.ke | Super Admin |
| David Mbugua | admin@iprs.co.ke | Admin |
| Sarah Wanjiku | analyst@iprs.co.ke | User · Analyst |
| Mike Ochieng | officer@iprs.co.ke | User · Officer |
| (viewer) | viewer@iprs.co.ke | User · Viewer |
| (billing) | billing@iprs.co.ke | User · Billing |

---

## 1 · Global chrome & nav
- [ ] Sidebar shows no “Blueprint”, “Mobile View” or marketing/footer entries (they were removed).
- [ ] At 360px the sidebar collapses to a hamburger; opening it overlays cleanly and closes.
- [ ] Header wallet chip truncates (`KES 18,420`) instead of pushing the mode badge (`API`/`LOCAL`) off-screen.
- [ ] Command palette (⌘K / Ctrl-K) lists no removed screens.
- [ ] Visiting `#/mobile-responsive` lands on a sensible fallback (not the old showcase).

## 2 · Identity profile — 5 tabs (was: tabs broken/identical)
Sign in as Sarah (Analyst) → **Identity Profile**.
- [ ] All five tabs render: **Overview · Personal · Financial · Connections · Logs**.
- [ ] Each tab’s content actually differs (Overview = risk gauge; Personal = civil registry; Financial = KRA/bank/CRB; Connections = graph; Logs = event list).
- [ ] Tab badges (Connections count, Logs count) match visible row counts.
- [ ] At 360px each tab stacks without horizontal scroll; tables become labelled cards.

## 3 · Detailed report — Summary vs Full Report vs print vs PDF (was: same thing)
Still as Sarah → open the dossier report.
- [ ] **Summary** is a brief; switching to **Full Report** shows many more fields (tab label reads “Full Report · N fields”).
- [ ] Full Report shows per-field provenance: source, retrieved-at, confidence, and raw gateway responses.
- [ ] **Print** (Ctrl-P preview): print stylesheet renders the FULL data, no nav/chrome, readable margins.
- [ ] **Summary PDF** downloads (~14 KB); **Download PDF** downloads a much larger file (~340 KB). Open both — the full one carries every section.
- [ ] Masked/unmasked (eye) toggle visibly masks PII on screen **and** in the downloaded PDF.
- [ ] Partial provider responses show `Unknown`, `Unavailable`, or `Not provided`; never
  `null`, `null%`, `0%`, `KES 0`, or a fabricated `Medium risk` conclusion.

## 4 · Profile settings — Security & Notifications (was: identical tabs)
As Sarah → **Profile**.
- [ ] **Security**: toggle Two-factor → enrolment panel (secret + recovery codes) → **Enable 2FA** → badge flips to “2FA on”. Reload the page — it stays on. Toggle off again.
- [ ] **IP allowlist**: enter `41.90.0.0/16`, **Save allowlist**, reload — persists.
- [ ] **Notifications**: delivery matrix (events × in-app/email/SMS/webhook) renders at all widths; toggle cells, **Save preferences**, reload — persists.
- [ ] **Appearance** and **API Keys** tabs remain distinct from the above.

## 5 · Provider management (was: no interaction/config fields)
Sign in as David (Admin) → **Providers**.
- [ ] Each row has **Configure / Test / enable-toggle** actions.
- [ ] Configure exposes **Connection** (Base URL, endpoint, method, environment, certificate, maintenance window, IP allowlist), **Authentication** (auth type, consumer key/secret, token URL) and **Behaviour & resilience** groups.
- [ ] Edit a Base URL → **Save changes** → toast → reload: value persisted. **Discard** reverts the draft.
- [ ] **Test** runs a handshake and shows the staged result; provider logs stream into the detail panel.

## 6 · Wallet & payments (as Sarah, then David)
- [ ] **Top up → M-PESA**: KES 1,000 to `0712 345 678` → STK “waiting for handset” → settles → balance +1,000, ledger shows an `MPESA-` reference.
- [ ] **Top up → Card**: `4242 4242 4242 4242`, any future expiry, OTP `000000` → **declined**, balance unchanged, failed payment recorded.
- [ ] As David → **Payments Monitor**: totals/chart render, filter by channel, open a payment’s raw gateway response, **Refund** the successful payment (confirm dialog) → status `refunded`, ledger reversal present.

## 7 · Pricing — fully priced catalogue (34/34 confirmed)
- [ ] **New Search**: NO provisional banner — every rate is confirmed. The six items the proposal quotes nowhere are keyed as platform-priced decisions and their rows say so.
- [ ] Catalogue shows proposal groupings (Identity Verification APIs, Utility & Compliance, Identity & CRB, Spin Score, Scanned Statement); platform-priced rows state their origin group.
- [ ] Spot-check quoted rates: IPRS Standard **30** (back-up 45) · Alien/AML-PEP/Passport **75** · Utility APIs **20** · Phone-by-ID **50** · Spin Score **130** · Statement **120 + 4/page** · Vehicle **1,160** · Licence **200** · Metropol Full **300** · CreditInfo CRB Status **2,000** · BRS **1,300**.
- [ ] Spot-check platform-priced six: Criminal **500** · Deceased **150** · KYB Tax Compliance **250** · KYB CRB Business **1,500** · ID+KRA **45** · Full KYC **200**.
- [ ] Bundle “KYC Standard” = **KES 250** (exact sum of its items).
- [ ] As Super Admin → Pricing & Tiers: inline rate edit + save works, the change is audit-logged with old → new, and provenance never flips.

## 8 · Machine API and trust boundaries

With `npm run dev:all` running:

- [ ] As John, open **API documentation → Keys**, issue a sandbox key with only the
  scopes the integration uses. The secret is shown once; after dismissal, reload does not
  reveal it or its hash.
- [ ] `GET /api/v1/pricing` without a key returns `401`; a pricing-only key cannot read
  `/api/v1/wallet` (`403`); a verification request with `consent: "true"` returns `400`.
- [ ] A correctly scoped key debits exactly the catalogue rate, writes usage/audit, and
  returns the owner wallet only. An insufficient wallet returns `402` with `requiredKes`.
- [ ] Trigger the API limiter and confirm `RateLimit-Limit`, `RateLimit-Remaining`,
  `RateLimit-Reset`, and `Retry-After` headers; the rejected body is the documented `429`.
- [ ] Submit the M-PESA callback once with the wrong token (`401`), then with the right
  token and a mismatched amount (`400` plus a critical audit event). Only the matching
  token/amount can settle.
- [ ] As John, open **System settings → Backup & Recovery**, download the versioned JSON,
  confirm sessions and in-flight STK intents are absent, then restore it and confirm the
  current auth/callback secrets and session remain usable.
- [ ] As any signed-in user, open **Profile → Security**, revoke another session or use
  **Revoke other sessions**; the revoked bearer token immediately returns `401`.
- [ ] Confirm the server database reports `PRAGMA user_version = 1` after first boot and
  remains forward-only; no reset or destructive migration is required.

## 9 · Tiers & access (3 tiers, distinct dashboards)
- [ ] Sign in as each persona — each lands on its **own** dashboard (User wallet/quota · Admin org KPIs · Super Admin revenue/permissions/audit).
- [ ] Sarah: **Admin console** and **Payments Monitor** are access-denied; no such nav links.
- [ ] David: Payments Monitor opens; platform settings group is **read-only** (Save disabled).
- [ ] John (Super Admin) → Admin console → **Create account**: tier picker offers Super Admin but **disabled**; creating an Admin succeeds and is audited.
- [ ] David → Create account: Admin tier **disabled**; submission refused.
- [ ] Nobody can create a Super Admin from the UI anywhere.

## 10 · System settings
- [ ] As John: all nine groups editable; configuration-health panel reports the fully priced catalogue; maintenance toggle gated to Super Admin.
- [ ] Flip maintenance on: New Search shows the maintenance banner; flip back.
