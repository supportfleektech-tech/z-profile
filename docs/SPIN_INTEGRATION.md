# Spin Mobile (Kenya) — Integration Review & Wiring

Review of **https://docs.spinmobile.co** (Kenya section only, as instructed) and how this
platform now consumes it. The machine-readable outcome of this review is
**`src/data/spinModules.ts`** — the single source of truth every consumer reads.

---

## 1. Integration method

| Concern | How Spin works | How this platform models it |
|---|---|---|
| **Auth** | `POST {base}/analytics/auth/` with `{consumer_key, consumer_secret}` → `{token, expires}`. Token valid **~10 minutes**. Credentials live in the dashboard under *Setup → API Keys*. | `server/spin.mjs` caches the token until 60 s before expiry; engages live mode when `SPIN_CONSUMER_KEY`/`SPIN_CONSUMER_SECRET` are set. The Provider Management rows carry `consumerKey` / `consumerSecret` / `tokenUrl = /analytics/auth/`. |
| **Search call** | `POST {base}/analytics/…`, `Authorization: Bearer <token>`, JSON body `{ search_type, identifier, consent, consent_collected_by }` (+ per-module extras). | Every catalogue item maps to a `search_type` (shown as a badge in New Search); consent captured at search time maps to `consent` / `consent_collected_by`. |
| **Environments** | Sandbox and production share **one base URL — only the keys differ**. | `SPIN_BASE_URL` (default `https://api.spinmobile.co`); mode visible at `GET /api/health → spin.mode`. |
| **Response envelopes** | Two shapes: analytics `{ code: "200.001", data: {…} }` and verification `{ response_code: "200", success, message, data: {…} }`. | Documented per module in the registry; provider logs and dossier payloads use these shapes. |
| **Errors** | Kenya docs carry a dedicated Errors page (envelope-level failure codes). | Live-mode failures surface as errors/`502`-style outcomes — never fabricated success. |

## 2. Module catalogue (Kenya) — docs → system mapping

Legend: ✅ docs publish request+response details · ⚠️ docs section exists, params not retrievable at review · ❌ priced in the proposal but **not in the Kenya docs**.

| Spin module | `search_type` | Identifier | Published endpoint | Key response fields | Priced as | Docs |
|---|---|---|---|---|---|---|
| IPRS Identity | `identity` | ID number | — | photo, signature, fingerprint, names, gender, DOB, citizenship, clan, ethnic group, serial no., birth/residence | `kyc-id` | ✅ |
| IPRS Identity + KRA | `identity-kra` (`conso`) | ID number | — | identity payload + `krapin` | `kyc-id-kra` | ✅ |
| KRA PIN Checker | `pin` / `id_no` | PIN or ID | — | `id_number`, `krapin` | `kyc-kra` | ✅ |
| Passport Check | — | passport no. | — | — | `kyc-passport` | ⚠️ |
| Face ID Match | — | ID + selfie | — | — | `kyc-face` | ⚠️ |
| Alien ID | `ALIENCHECK` | alien ID | — | `response_code 200`, `data` | `kyc-alien` | ✅ |
| Metropol Summary | `Metropol` | ID number | — | `code 200.001`, summary report | `kyc-crb` (Spin Score) | ✅ |
| Metropol Full | `METROPOLFULLJSON` | ID number (+ `identifier: "National ID"`) | — | `credit_score`, `account_info[]`, `identity_verification`, `identity_scrub`, `lender_sector`, enquiry/cheque counters, fraud flags | `kyc-metropol-full` | ✅ |
| Creditinfo | `CREDITINFO` | ID number | — | personal info, `id_verified`, `score_type_name`, demographics (`report_type`, `document_type`, `client_name` extras) | `kyc-creditinfo` | ✅ |
| Phone Hakikisha | — | phone | — | — | `kyc-namephone` | ⚠️ |
| Bank Account Validation | — | account no. | — | — | `kyc-bank` | ⚠️ |
| M-PESA KYC | `MPESAKYCCHECK` | ID + `phone_number` | — | `responseRefID`, `responseCode 4000`, `status` | `kyc-mpesa` | ✅ |
| SIM Swap (Safaricom) | `sim_swap` (`imsi`) | phone | — | last-swap details | `kyc-sim` | ✅ |
| Phone Number Search | `PHONESEARCH` | ID number | `POST /analytics/account/phonesearch` | `AdditionalContacts.PhoneContacts[]` (skip trace) | `kyc-phonebyid` | ✅ |
| **Full KYC** | `FULLKYC` | ID number | `POST /analytics/account/full_kyc_check` | identity + `employed`/`employer_details` + `KRAPIN`/`StatusOfPIN` | `kyc-fullkyc` | ✅ |
| Employer Verification | `employer` | ID number | `POST /analytics/account/employer` | `employed`, `employer_details.employerName`, `full_name` | `kyc-employer` | ✅ |
| Business Verification | `COMPANYSEARCHREGNO` | reg. number | — | `response_code 200`, company `data` | `kyb-registry` | ✅ |
| Driving Licence | `DRIVERSLICENCECHECK` | licence no. | — | `response_code 200`, licence `data` | `kyc-driving-licence` | ✅ |
| KPLC Location | `kplc` | meter no. | — | `data.address` | `kyc-address` | ✅ |
| E-Statements | — | file/reference | — | 4-step flow: submit → status → analysis → webhook | `kyc-statement` | ⚠️ |
| Combined Analysis | — | file/reference | — | statement + analytics, analyze-all/single | (unpriced) | ⚠️ |
| AML & PEP Screen | — | — | — | — | `kyc-pep` | ❌ priced, not documented |
| Motor Vehicle Ownership | — | — | — | — | `kyc-vehicle` | ❌ priced, not documented |
| Criminal / Deceased | — | — | — | — | `kyc-criminal`, `kyc-deceased` | ❌ priced, not documented |

**Resulting catalogue change:** 5 new priced items (`kyc-id-kra`, `kyc-fullkyc`,
`kyc-metropol-full`, `kyc-creditinfo`, `kyc-driving-licence`) — all documented by Spin but
**absent from the received proposal extract**, so they carry
`confirmedFromProposal: false` and the banners now read **15 of 30 confirmed / 15 provisional**.

## 3. Where each piece lives

| Layer | File | What it does |
|---|---|---|
| Module registry | `src/data/spinModules.ts` | All 21 documented modules: `search_type`, endpoint, identifier, request/response params, priced-item mapping, fidelity flags, `spinRequestBody()` builder. |
| Live adapter | `server/spin.mjs` | Token caching (`/analytics/auth/`, ~10 min TTL), per-module `search()` execution, `describe()` for health. |
| Modules API | `GET /api/spin/modules` | Registry as JSON (`providers.view` permission). |
| Health | `GET /api/health` | `spin: { mode, baseUrl, missing[], configured, modules }` alongside the Daraja `gateway`. |
| New Search UI | `Screen3_NewSearch.tsx` | Each catalogue row badges its SuperCrunch `search_type`. |
| Provider UI | `Screen10_ProviderManagement.tsx` | "Spin Mobile Kenya — SuperCrunch module catalogue" panel: module → type → endpoint → identifier → returns → priced-as, plus the request/envelope conventions. |
| Provider seeds | `src/data/providers.ts` | `tokenUrl: /analytics/auth/` on every gateway row; Employer row uses the documented `/analytics/account/employer` path. |

## 4. Going live

```bash
SPIN_CONSUMER_KEY=CK_…  SPIN_CONSUMER_SECRET=CS_…  npm run server   # spin.mode → 'live'
SPIN_BASE_URL=…         # only if onboarding provides a different host
```

Until then everything runs modelled — and the modelled responses keep the exact field
shapes documented above, so swapping in live credentials changes the transport, not the
contracts.

## 5. Honest gaps

- **⚠️ section-only fidelity** for Passport, Face ID, Hakikisha, Bank Account Validation,
  E-Statements and Combined Analysis: the docs sidebar lists them, but the parameter
  tables were not retrievable during this review (pages 404 on direct fetch). The registry
  marks them explicitly rather than inventing shapes.
- **❌ priced but undocumented**: AML/PEP, Vehicle, Criminal, Deceased remain proposal-only
  line items with no Spin module to map to.
- The docs' own sample for Phone Number Search shows a mismatched `search_type`
  (`CREDITINFOSKIPTRACE`) in the sample body vs `PHONESEARCH` in the table — the table was
  treated as authoritative.
- Environments page uses placeholder base URLs (`{{sandbox-base-url}}`); the real host must
  come from onboarding (`SPIN_BASE_URL`).
