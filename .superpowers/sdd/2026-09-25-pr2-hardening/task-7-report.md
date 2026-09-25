# Task 7 Delivery Report — PR #2 Hardening

## Status

Partially delivered. The verified implementation was squashed and pushed, but PR creation and the hosted verification check did not complete successfully.

## Final commit

- Commit: `5c8ec95e3e706b6be16db3f09e04929016212734`
- Subject: `feat: harden platform security and machine API`
- Branch delta: exactly one commit over `origin/main` (`7261644`)
- Tree preservation: the final commit tree matches the verified pre-squash tree
- Force push: not used

## Repository hygiene

- `git diff --check origin/main...HEAD` passed.
- Tracked-file checks found no `node_modules`, generated SQLite/database files, WAL/SHM files, bundles, archives, logs, build output, coverage output, smoke artifacts, or OS artifacts.
- Tracked-content checks found no GitHub, payment, or private-key credential signatures.
- `.env.example` contains empty credential placeholders and non-secret local/default settings only.
- The branch changes 74 files with 7,632 insertions and 789 deletions.
- No source or documentation changes were made during Task 7.

## PR body review

`PR2_BODY.md` matches the requested title and final observed counts:

- 79 unit tests
- 114 API smoke assertions
- 44 DOM smoke assertions
- 64 interactive flow assertions
- 96 requirement-traceability assertions
- Eight verification stages total
- One known ESLint warning and zero ESLint errors

No PR-body/count typo was found.

## Local verification

A fresh `npm run verify` completed successfully on the final source tree:

- TypeScript typecheck passed.
- ESLint passed with zero errors and one pre-existing unused-disable warning.
- 79/79 unit tests passed.
- Single-file Vite build passed.
- API smoke suite passed 114/114 assertions.
- DOM smoke suite passed 44/44 assertions.
- Interactive flow suite passed 64/64 assertions.
- Requirement traceability suite passed 96/96 assertions.

## Push result

The normal push succeeded:

- Remote branch: `refs/heads/arena/01a0cbfb-z-profile-pr2`
- Remote head: `5c8ec95e3e706b6be16db3f09e04929016212734`

The remote branch did not exist before the push. No force push was attempted.

## PR creation result

PR creation was attempted with the exact requested title and `PR2_BODY.md` against `main`, but GitHub rejected it:

- Error: `GraphQL: must be a collaborator (createPullRequest)`
- PR URL: none; no PR exists for this head branch
- Active `gh` identity: `zing254`
- Repository permission observed by `gh`: pull only; push/maintain/admin are false

The pushed git remote could write the branch, but the active GitHub CLI identity lacks collaborator permission to create the PR.

## Hosted checks

The push triggered workflow `verify` as run `36111497632`. The first hosted run failed:

- `verify`: failed
- Primary failure: concurrent SQLite unit-test setup raised `database is locked` in `tests/unit/db-migrations.test.ts` and `tests/unit/apiv1.test.ts`
- Artifact upload was consequently skipped because `dist/index.html` was absent after the failed gate
- A single rerun request was refused by GitHub with: `run 36111497632 cannot be rerun; its workflow file may be broken`

The local full gate passed on the same commit tree; the hosted concurrency failure remains unresolved and must not be reported as passing.

## Limitations and concerns

1. A collaborator-authorized GitHub CLI session is required to create PR #2.
2. The hosted `verify` run is currently red due to SQLite lock contention; no source fix was authorized or made.
3. The isolated worktree is intentionally detached at the final commit because the local `arena/01a0cbfb-z-profile-pr2` ref is checked out in another worktree. The remote PR branch points to the final commit.
4. The local Git `origin` configuration embeds a GitHub credential in its URL. It is not tracked in the repository, but it should be rotated and the remote URL sanitized separately.

## SQLite lock fix — 2026-09-25

### Status

Implemented and locally verified in the isolated worktree. The fix isolates Vitest database imports per worker without changing production database behavior or serializing tests.

### TDD record

- RED: added `tests/unit/test-setup.test.ts`; with `IPRS_DB` unset, the focused test failed because setup left `IPRS_DB` undefined.
- GREEN: `tests/setup.ts` now creates a unique temporary directory and file-backed `IPRS_DB` per Vitest process when no path is supplied, preserves any explicitly supplied path, and removes the temporary directory on process exit.

### Verification

- Focused regression: 1/1 passed.
- Four-worker unit suite: 80/80 passed without SQLite lock errors.
- Full `npm run verify`: passed; typecheck, lint, 80/80 unit tests, build, 114/114 API smoke, 44/44 DOM smoke, 64/64 interactive flows, and 96/96 traceability assertions.
- Lint retains one pre-existing unused-disable warning in `src/components/screens/Screen3_NewSearch.tsx`; there are zero lint errors.
- The hosted workflow was not rerun from this worktree; the previously reported hosted run remains historical evidence of the original failure.

### Concerns

The fix is ready for the hosted CI rerun. No known production database behavior was changed.

## Regression hardening — 2026-09-25

### Status

Implemented and locally verified. The previous regression test asserted only the single ambient `process.env.IPRS_DB` value, so a constant shared `.sqlite` path would still have satisfied it. The setup module now exposes a testable helper and the suite pins the isolation property directly.

### TDD record

- RED: rewrote `tests/unit/test-setup.test.ts` against the wished-for `createIsolatedDatabasePath(env)` API. The focused run failed 4/6 with `TypeError: createIsolatedDatabasePath is not a function` — the expected missing-behavior failure, not a typo.
- GREEN: `tests/setup.ts` exports `createIsolatedDatabasePath(env)`, which returns an existing `IPRS_DB` unchanged or otherwise creates a unique `mkdtemp` directory, assigns `path.join(dataDir, 'iprs.sqlite')` onto the supplied environment, and returns it.
- Automatic setup is preserved: the module still calls the helper with `process.env` on import.
- Cleanup is preserved and made cumulative: generated directories are tracked in a module-level `Set` and removed by a single `process.once('exit', ...)` handler using `rmSync(..., { recursive: true, force: true })`. The handler registers only when at least one directory was generated, so a supplied `IPRS_DB` schedules no exit work.

### Mutation proof

The strengthened tests were checked against two deliberate regressions, and both were caught:

1. Constant temp directory (`iprs-vitest-constant` instead of `mkdtemp`) — failed `generates a different path for every environment it is given`.
2. Constant shared database file (helper returning `/tmp/iprs-shared/iprs.sqlite`) — failed the same test.

The original single-assertion test would have passed under both mutations.

### Tests added

- automatic setup still assigns an absolute `.sqlite` path outside `server/.data`
- two separate empty environments receive different paths *and* different parent directories
- the generated path is written back onto the supplied environment and stays out of `server/.data`
- re-invoking the helper on the same environment is idempotent
- an explicitly supplied `IPRS_DB` is returned and left unchanged
- the ambient setup path is not the shared repository database

### Verification

- Focused regression (`tests/unit/test-setup.test.ts`): 6/6 passed.
- Four-worker unit suite: 85/85 passed across 7 files, no SQLite lock errors.
- `npx tsc --noEmit`: passed.
- `npx eslint src server tests vitest.config.ts`: zero errors; the single pre-existing unused-disable warning in `src/components/screens/Screen3_NewSearch.tsx` is unchanged.
- `npx prettier --check` on both touched files: clean.
- Full `npm run verify`: passed — typecheck, lint, 85/85 unit tests, single-file build, 114/114 API smoke, 44/44 DOM smoke, 64/64 interactive flows, 96/96 traceability assertions.

### Scope

Production server behavior is unchanged. `server/db.mjs` still resolves `process.env.IPRS_DB ?? path.join(DATA_DIR, 'iprs.sqlite')` and was not touched; `git status` shows only `tests/setup.ts` and `tests/unit/test-setup.test.ts` modified.

### Concerns

The hosted workflow was not rerun from this worktree; the previously reported hosted failure remains historical evidence of the original problem. Unit test count rises from 80 to 85, so `PR2_BODY.md` still states the older counts.

## Final verified state — 2026-09-25

### Cleanup fix

- `tests/setup.ts` now registers the process-exit cleanup when the exported helper first creates a temporary directory, including when setup imported with an ambient explicit `IPRS_DB`.
- Explicit caller paths remain untouched and are never added to the cleanup set.
- The focused regression test passes 6/6 after merging the cleanup assertion into the existing explicit-path case; the initial RED run failed because the later-generated directory remained.

### Documentation and verification

- Updated the operational unit count from stale 79/80 claims to 85 in `README.md`, `AGENTS.md`, `docs/MANUAL_TEST_CHECKLIST.md`, `PR2_BODY.md`, `.github/workflows/verify.yml`, `docs/superpowers/plans/2026-09-25-pr2-hardening.md`, and `docs/superpowers/specs/2026-09-25-pr2-hardening-design.md`.
- Preserved smoke totals: API 114, DOM 44, flows 64, trace 96, total 318.
- `npm run verify`: passed — typecheck, lint, 85/85 unit tests, build, 114/114 API smoke, 44/44 DOM smoke, 64/64 interactive flows, 96/96 traceability assertions.
- `git diff --check`: passed.
- `package-lock.json`: unchanged; no integrity strings modified.

### Concerns

The pre-existing unused ESLint-disable warning in `src/components/screens/Screen3_NewSearch.tsx` remains. The hosted workflow was not rerun from this worktree.
