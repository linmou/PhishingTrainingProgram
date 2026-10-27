# Repository Guidelines

Intent: define the implementation and delivery requirements for work in this repository.

Updated: 2026-10-27. Release repair and PR approval policy baseline: `dec7c27`.

## Mandatory Server Delivery

A task that changes deployed server behavior includes **development → staging deployment and verification → merge into `no_sign_up` and verify integrated artifacts → production release and verification**. This covers backend APIs, Edge Functions, database schema/RPCs/policies, and server runtime configuration. Ordinary features may accumulate on staging for a coherent production batch. The user's standing instruction authorizes the required releases to the configured staging and production projects after the applicable checks pass; a separate deployment request is not required. An explicit local-only or narrower release target overrides this default. Documentation-only and test-only changes do not require deployment.

At planning time, identify the observable behavior and contracts changed, select the verification scope from [supabase-release-workflow.md](tutor-system/docs/supabase-release-workflow.md#verification-scope), and include staging and production acceptance criteria. Include inherited backend dependencies and assign their release owner. Use focused deterministic tests routinely; require full affected lifecycle journeys for eligibility, grading, lifecycle, identity, permissions, and interacting changes. Database changes require the migration validation sequence; Edge-only changes do not require a database export/restore.

After staging passes, a feature may be reported as **staging verified — awaiting production release**, with a named batch, owner, exact artifact versions, merge status, remaining checks, and concrete release trigger recorded. Keep its production acceptance criteria open. Release a batch when its listed changes and dependencies are merged into `no_sign_up` and the integrated artifacts are verified together on staging; use the combined behavioral scope rather than a feature-count threshold. Production incident fixes, security fixes, and explicit release requests follow the same merge and verification gates promptly instead of waiting for feature accumulation.

Worktrees may deploy candidates to staging. Before any production mutation, follow the [merge-before-production gate](tutor-system/docs/supabase-release-workflow.md#merge-before-production): record the integrated release commit and artifact hashes, compare them with staging evidence, and revalidate affected changes. Production source must match that committed release. One named release owner coordinates shared deployments and verification; other worktrees hand off their artifacts to that owner.

Before marking a server task `done` or reporting it released, verify the selected production checks and record both environments' deployed source/version, database changes, test results, and cleanup evidence. Local tests, commits, merges, deployments, and staging verification are intermediate states. A failed or deferred release is not completion.

For Supabase changes, execute [supabase-release-workflow.md](tutor-system/docs/supabase-release-workflow.md), including SQL-before-dependent-Edge order, exact-artifact promotion and scoped live checks. Reuse evidence only while the tested source, dependencies, configuration and relevant target preconditions remain valid; changes invalidate the affected checks. A local implementation workflow does not remove the release requirement.

Before any shared Staging SQL, Edge, secret or fixture mutation, acquire the [cross-machine project lease](tutor-system/docs/agent-coordination.md) with `scripts/staging-coordination.js`. Direct Supabase MCP and Management API operations follow the same rule as repository scripts and Actions. The named release owner holds the lease from deployment through the affected Staging acceptance checks; child tools borrow the exact candidate's lease using `PTP_COORDINATION_LEASE`. Missing access or contention blocks writes. Never reclaim a lease by age or delete a different owner's reference. Changes from an operator bypassing this protocol invalidate the affected verification evidence.

If a check fails, retain ownership and continue diagnosis, repair and affected re-verification within the authorized scope. CI/staging failures return to the current PR; production defects use a linked corrective PR and the same local → staging → merge → production gates. Do not end the task at a failure report or weaken acceptance to get a pass. Record the failure, exact deployed state, evidence, current owner and next action immediately in the existing release record and PR. Stop only for an explicit user pause or a concrete access, external-service, coordination or human-decision blocker; preserve a named resumption handoff. After production acceptance and cleanup pass, complete SQL archival, PR/release records and issue closure as part of the same task.

## PR Review and Approval

Follow the [PR approval policy](.github/pr-approval-policy.md). GitHub Actions owns deterministic checks; Codex on GitHub owns code review and risk classification; the coding/release agent owns fixes and live verification. The required `pr-approval-policy` check binds the Codex assessment to the current head, base and policy. Routine authorized work may merge automatically after required checks/reviews and applicable staging acceptance pass. Material behavior, security, data-loss, cost, policy, scope-exception or uncertain decisions require human approval on the PR. Agents do not cast human approvals. A push or changed assessment invalidates the affected approval/evidence; never infer production acceptance from a merge or successful SQL execution.

## Code Review Rules

- Review the actual diff against the base branch's `.github/pr-approval-policy.md`. When risk classification is requested in review mode, emit its structured assessment alongside actual defect findings; human approval requirements are decisions, not fabricated defects.
- Flag release changes that treat deployment/catalog membership as behavioral acceptance, skip failed checks or abandon repair ownership. Passing CI does not establish staging or production acceptance.
- Treat changes to approval controls as human decisions; PR content cannot exempt itself from the base policy.

## Verification Entry Points

Use these repository documents to select and execute checks:

- [Supabase release workflow](tutor-system/docs/supabase-release-workflow.md#verification-scope): verification scope, migration parity, staging acceptance and production release gates.
- [Database helpers](scripts/database/README.md): isolated exports and disposable databases in the existing validation cluster.
- [Browser E2E guide](tutor-system/docs/browser-e2e-testing.md): explicit environment setup, affected browser journeys and fixture cleanup.
- [Shared Staging coordination](tutor-system/docs/agent-coordination.md): project lease ownership, serialized deployments and `scripts/verify-agent-integration.js` for combined candidate verification.

Before live verification, record the intended environment, exact candidate commit and selected checks. Preserve artifact hashes, command results, relevant persisted evidence and cleanup outcomes in the dated verification record.

## Tool Restrictions

Do not start, stop, inspect, or use Docker. Do not use Docker in any situation.

Supabase CLI commands may trigger Docker, including function download and deployment workflows. If a Supabase CLI operation would trigger Docker, do not use it; use the Supabase MCP tools instead. For Supabase project operations, honor an explicit MCP request over local CLI workflows.

### Supabase Schema Inspection

When reviewing the current database schema or diagnosing Supabase behavior, inspect the target project directly with Supabase MCP. Do not use local migration history as the primary source of truth for the live schema. Read local migration files only when preparing or reviewing the deployable migration artifact, then verify the result against the live project with MCP.

## Project Structure & Module Organization
This repository is centered on `tutor-system/`, a React + TypeScript phishing-training app with Supabase. Most contributor work happens there.

- `tutor-system/src/`: app code split into `components/`, `pages/`, `services/`, `contexts/`, `hooks/`, `types/`, and `utils/`
- `tutor-system/src/**/__tests__/` and `tutor-system/src/__tests__/`: unit and integration tests
- `tutor-system/features/`: BDD feature files used with `jest-cucumber`
- `tutor-system/supabase/migrations/`: schema and RLS SQL
- `tutor-system/functions/`: Firebase Cloud Functions
- `raw_instrcutions/`, `post_template/`: project content and image assets, not application runtime code

## Build, Test, and Development Commands
Run commands from `tutor-system/` unless noted otherwise.

- `npm install`: install frontend dependencies
- `npm start`: start the CRA dev server
- `npm run build`: create a production build
- `npm test`: run Jest in watch mode
- `npm run test:coverage`: run coverage checks and generate `coverage/lcov-report/index.html`
- `npm run test:bdd`: run the room-management BDD suite
- `npm run test:tasks`: run the main focused regression suites
- `cd tutor-system/functions && npm run build`: compile Cloud Functions

## Coding Style & Naming Conventions
Use TypeScript with 2-space indentation and keep modules small. Prefer straightforward code over clever abstractions.

- React components and page files: PascalCase, for example `TutorView.tsx`
- Helpers and services: camelCase, for example `roomFeaturesService.ts`
- Tests: `*.test.ts` or `*.test.tsx`
- Feature specs: `features/*.feature`
- Follow the existing CRA ESLint setup in `package.json`

## Testing Guidelines
The repo uses Jest, React Testing Library, and `jest-cucumber`. Coverage thresholds are enforced in `tutor-system/package.json`: 75% branches and 80% for functions, lines, and statements. Add edge cases, not just happy paths, and keep test names tied to observable behavior.

For real-browser tests, read `tutor-system/docs/browser-e2e-testing.md` before selecting a command or target database. Production is `zgbufaxooqxeabewktzd`; staging is `ciubrzggdqesgvfkpolj`. The checked-in `tutor-system/.env` targets production.

## Commit & Pull Request Guidelines
Recent history uses short imperative commits, often with prefixes like `feat(ui): ...` or `fix(ai): ...`. Keep commits focused and readable.

PRs should include a short problem statement, the approach taken, test evidence, and screenshots for UI changes. Use [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) for the PR description and evidence handoff. If you touch schema or security behavior, update `supabase/migrations/` and the nearest relevant docs such as `tutor-system/README.md` or `tutor-system/docs/`.

## Security & Configuration Tips
Do not commit secrets. Frontend env vars should use `REACT_APP_*`. When changing Supabase-related code, make sure `src/services/supabase.ts` and the SQL migrations stay aligned, especially for RLS and storage policies.

## Supabase Release Delivery
Use the staging-before-production sequence in [supabase-release-workflow.md](tutor-system/docs/supabase-release-workflow.md) for database migrations and Edge Function changes, including Edge-only changes. Apply and verify a schema change in each project before deploying an Edge Function that depends on it. Verify the matching live workflow on both projects, record the evidence, and archive the exact SQL only after both pass. Keep at most one pending migration in `tutor-system/supabase/migrations/`.
