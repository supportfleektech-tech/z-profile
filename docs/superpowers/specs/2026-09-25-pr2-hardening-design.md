# PR #2 Post-Merge Hardening Design

**Date:** 2026-09-25
**Branch:** `arena/01a0cbfb-z-profile-pr2`
**Base:** `origin/main` at `7261644`
**Status:** Implemented and verified

## Goal

Rebuild the lost PR #2 hardening pass on top of PR #1. Preserve the existing React/Vite frontend, Express/SQLite backend, shared TypeScript RBAC, bearer authentication, and browser fallback. Add the security boundaries, machine API, migrations, backup/restore, session management, test gates, and documentation described in the rebuild brief.

## Scope

### Trust boundaries

- Require authentication and permission checks on wallet mutation, provider logs, API-key operations, maintenance changes, and all other privileged routes identified by the baseline audit.
- Add a tokenized M-PESA callback route. The callback token is deployment-specific, persisted in the database, and overridable with `DARAJA_CALLBACK_TOKEN`. Validate the initiated amount before settlement and write a critical audit event on mismatch.
- Enforce ownership for STK status, confirmation, and cancellation.
- Sanitize usage ownership, costs, and latency values.
- Add fixed-window in-memory rate limiting for login, STK dispatch, and `/api/v1`, including `RateLimit-*` and `Retry-After` headers.
- Apply pinned CORS and baseline security headers to every response.
- Document all new environment variables in `.env.example`.

### Machine API

- Add server-side API-key issuance under `apikeys.manage`; return the secret once and persist only its SHA-256 hash.
- Add `/api/v1` discovery plus scoped pricing, wallet, and verification endpoints.
- Enforce key scopes, owner wallet access, consent, sufficient funds, transactional debit/usage/audit behavior, and refund-on-provider-failure.
- Add server-first key issuance to the API documentation UI, with local fallback only when the backend is unavailable.
- Update the API documentation tab type, content, render path, endpoint table, and scope catalogue.

### Engineering and data

- Add a top-level React ErrorBoundary.
- Add ESLint 9, Vitest, Prettier, and the requested 85 unit tests.
- Add `PRAGMA user_version` forward-only migrations and baseline stamping.
- Add Super-Admin backup export and transactional restore, excluding sessions and in-flight STK intents while preserving signing and callback secrets.
- Add self-service session listing, per-session revocation, and revoke-others.
- Normalize both documented Spin response envelopes and keep live integrations env-gated with simulation fallback when credentials are absent.
- Add skip navigation, main landmark, overlay focus restoration, and the optional static demo banner.

## Architecture

The existing `server/index.mjs` will remain the application composition root while route responsibilities are extracted into focused modules where the change is substantial. `server/apiv1.mjs` owns machine API authentication, scope checks, and verification transactions. `server/ratelimit.mjs` owns fixed-window counters and headers. Existing `server/auth.mjs`, `server/passwords.mjs`, `server/db.mjs`, `server/daraja.mjs`, and `server/spin.mjs` remain the foundation for bearer auth, scrypt passwords, SQLite persistence, and external adapters.

The frontend continues to use the shared permission engine and service-layer contract. API mode uses the Express backend; local mode remains a browser fallback for demos without backend availability. The fallback must not be used to bypass a successful backend authorization response.

## Data and error flow

1. Browser login obtains a live bearer session when the API is available.
2. Backend middleware resolves the session, actor, permissions, and ownership before protected handlers run.
3. Wallet, usage, payment, API-key, and audit changes use existing SQLite transactions where multi-record consistency is required.
4. Machine requests authenticate by key, resolve scopes, validate request shape, reserve/debit the owner's wallet, call the provider, and refund on post-debit provider failure.
5. Webhook callbacks validate token and initiated amount before changing settlement state.
6. Failures return structured status codes without exposing credentials or secret configuration.
7. Daraja and Spin use live adapters only when all required environment variables are present; otherwise deterministic simulation remains available for local/demo gates.

## Verification

The final gate is `npm run verify` with the following stages:

1. Strict TypeScript check.
2. ESLint with zero errors.
3. Vitest unit suite: 85 tests.
4. Vite single-file build.
5. API smoke suite: 114 assertions.
6. DOM smoke suite: 44 assertions.
7. Interactive flow suite: 64 assertions.
8. Requirement traceability suite: 96 assertions.

Smoke tests must boot the real Express server and built frontend where applicable. New coverage must include authentication and ownership rejection, webhook amount/token validation, API-key scope/secret handling, rate-limit headers, backup/restore round trips, session revocation, and the existing payment/pricing/RBAC invariants.

## Delivery

Work proceeds on `arena/01a0cbfb-z-profile-pr2` from `origin/main`. Changes are grouped internally by foundation, trust boundaries, machine API, data/session features, UI/docs, and verification, but are delivered as one final commit and one PR against `main` as requested. The PR body must use the supplied PR #2 description and report only observed verification results.

## Non-goals and invariants

- Do not reintroduce forgeable `x-user-id` authentication.
- Do not make live Daraja or Spin credentials required for local verification.
- Do not allow balance mass assignment through the wallet settings route.
- Do not change the 34-item pricing catalogue, its provenance, or the 0–500-only wiring.
- Do not make the user tier a provider-log, admin-audit, or cross-owner resource reader.
- Do not treat simulated external success as proof of a live provider call.
