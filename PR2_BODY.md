# PR #2 — post-merge hardening: webhook auth, machine API, backups, sessions, tooling gates

## Summary

- Harden bearer-only authentication, ownership, CORS, security headers, fixed-window rate limits, and tokenized M-PESA callback settlement.
- Add the six-scope Machine API with server-first one-time key issuance, owner-wallet verification transactions, consent, pricing, usage, audit, and provider-failure refunds.
- Add forward-only SQLite migrations, versioned Super-Admin backup/restore, self-service session listing/revocation, and env-gated live provider adapters with simulation fallback.
- Add skip navigation, the single main landmark, error-boundary fallback, focus restoration, and the optional Pages demo banner.
- Preserve the 34-item pricing catalogue, proposal provenance, visible simulation labels, write-only credentials, and no-secret response policy.

## Verification

`npm run verify` passes all eight stages:

- TypeScript typecheck
- ESLint (0 errors; one pre-existing warning)
- 85 unit tests
- Single-file Vite build
- 114 API smoke assertions
- 44 DOM smoke assertions
- 64 interactive flow assertions
- 96 requirement-traceability assertions

The smoke suites exercise the real Express server and built bundle, use temporary SQLite databases, and clean up child processes and temporary data.

## Manual review

See `docs/MANUAL_TEST_CHECKLIST.md` for Machine API issue-once, 401/403/400/402/429, successful debit, tokenized webhook amount validation, rate limits, backup restore, session revocation, report truthfulness, and responsive checks.

## Notes

- No credentials or provider secrets are committed; environment variables are documented in `.env.example`.
- Live Daraja and Spin credentials remain optional. Without them, deterministic simulation is used and does not claim a live provider call.
- Missing or partial provider values render as `Unknown`, `Unavailable`, or `Not provided`; they are never converted to zero, percentages, or a fabricated risk band.
