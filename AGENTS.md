# Repository Guidelines

Intent: define the implementation and delivery requirements for work in this repository.

Updated: 2026-10-14. Baseline commit: `83690fe`.

## Mandatory Server Delivery

A task that changes deployed server behavior includes **development → deployment → live verification**. This covers backend APIs, Edge Functions, database schema/RPCs/policies, and server runtime configuration. The user's standing instruction authorizes the required release to the repository's configured staging and production projects after the applicable checks pass; a separate deployment request is not required. An explicit user request for local-only work or a narrower release target overrides this default. Documentation-only and test-only changes do not require deployment.

At planning time, include local validation, staging deployment and live verification, then production deployment and live verification in the task's acceptance criteria. Include previously merged or inherited backend changes required for the requested behavior; assign an owner for their release rather than treating them as an external prerequisite.

Before marking a server task `done`, closing its acceptance checklist, or reporting the feature complete, verify the matching behavior on both deployed environments and record the deployed source/version, database changes, test results, and cleanup evidence. Local tests, a commit, a merge, or a successful deployment response establish intermediate progress only. Commits and merges may happen before release, but do not end the task.

For Supabase changes, execute [supabase-release-workflow.md](tutor-system/docs/supabase-release-workflow.md), including its SQL-before-dependent-Edge order and required live checks. A coding workflow's local-only implementation step ends before this release phase; it does not remove the delivery requirement or permit a spec to redefine completion as local-only.

If a check fails, fix it and rerun before advancing to the next environment. If an external blocker cannot be resolved within available authorization or access, keep the task incomplete and report the exact failing action, evidence, current deployed state, and next required action. A failed deployment prerequisite is work to resolve, not a completed verification step.

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

PRs should include a short problem statement, the approach taken, test evidence, and screenshots for UI changes. If you touch schema or security behavior, update `supabase/migrations/` and the nearest relevant docs such as `tutor-system/README.md` or `tutor-system/docs/`.

## Security & Configuration Tips
Do not commit secrets. Frontend env vars should use `REACT_APP_*`. When changing Supabase-related code, make sure `src/services/supabase.ts` and the SQL migrations stay aligned, especially for RLS and storage policies.

## Supabase Release Delivery
Use the staging-before-production sequence in [supabase-release-workflow.md](tutor-system/docs/supabase-release-workflow.md) for database migrations and Edge Function changes, including Edge-only changes. Apply and verify a schema change in each project before deploying an Edge Function that depends on it. Verify the matching live workflow on both projects, record the evidence, and archive the exact SQL only after both pass. Keep at most one pending migration in `tutor-system/supabase/migrations/`.
