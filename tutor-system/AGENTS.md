# Repository Guidelines

Intent: define application development conventions and connect them to the repository's delivery requirements.

Updated: 2026-10-24. Workflow revision baseline commit: `18981cc`.

## Server Delivery

Follow [Mandatory Server Delivery](../AGENTS.md#mandatory-server-delivery) for server behavior changes, including inherited backend dependencies. Select tests by changed behavior using [the Supabase release workflow](docs/supabase-release-workflow.md#verification-scope). Worktree candidates may deploy to staging.

Before production mutations, first obtain authorization under the [root Git merge process](../AGENTS.md#git-branch-and-pr-merge-process). Then merge the authorized PR and dependencies into `no_sign_up`, record the release commit, and pass the [merge-before-production gate](docs/supabase-release-workflow.md#merge-before-production). Green CI or Staging acceptance never authorizes an agent to merge. Reuse staging evidence when the integrated artifacts, dependencies, configuration and relevant preconditions still match; otherwise revalidate affected checks. One named release owner coordinates shared deployments.

Ordinary features may wait in a recorded production batch after staging deployment and verification; report `staging verified — awaiting production release`, record pending integration, and keep production acceptance open. Complete delivery only after the exact integrated batch is released and its selected production checks pass.

## Project Structure & Module Organization
- Source in `src/`: `components/`, `pages/`, `services/` (Supabase, AI helpers), `contexts/`, `hooks/`, `types/`, `utils/`.
- Tests in `src/__tests__/` (unit/integration) and BDD specs in `features/*.feature` with step defs in `src/__tests__/step_definitions/`.
- Database migrations in `supabase/migrations/`; static assets in `public/`; utility scripts in `scripts/`.

## Build, Test, and Development Commands
- `npm start` – Run CRA dev server.
- `npm run build` – Production build to `build/`.
- `npm test` – Jest in watch mode; `npm run test:coverage` for coverage HTML in `coverage/`.
- Focused suites: `npm run test:tasks` (Task 1–3), `npm run test:bdd` (room management BDD), or e.g. `npm test -- src/services/__tests__/supabase.test.ts`.

## Coding Style & Naming Conventions
- TypeScript, 2‑space indent, semicolons on, strict types where practical.
- React components: PascalCase files (e.g., `RoomPage.tsx`), one component per file when possible.
- Tests: `*.test.ts` / `*.test.tsx` colocated under `src/__tests__/`.
- Services/utilities use named exports; avoid default exports in shared modules.
- CRA-consumed TypeScript/TSX modules must not start with a Unix shebang; reserve shebangs for standalone executable scripts so Webpack can parse imported modules.
- Linting via CRA ESLint (`react-app`, `react-app/jest`). Configure editor to auto‑fix on save.

## Testing Guidelines
- Frameworks: Jest + React Testing Library; BDD via `jest-cucumber`; selected Selenium suites are available.
- Coverage thresholds (package.json): branches 75%, functions 80%, lines 80%, statements 80% (`npm run test:coverage`).
- Naming: feature files in `features/*.feature`; corresponding step files in `src/__tests__/step_definitions/`.

## Commit & Pull Request Guidelines
- Commits: imperative, present tense, concise (e.g., `fix auth flow redirect`, `feat: room template presets`). Optional scope in prefix.
- PRs must include: summary, rationale, linked issue, screenshots/GIFs for UI changes (e.g., TutorView/RoomPage), and test notes. Use [REVIEW.md](../REVIEW.md) and the [PR template](../.github/PULL_REQUEST_TEMPLATE.md). Stop at review-ready; only an explicit owner decision authorizes merging the current PR head.
- Requirements: all tests pass, coverage meets thresholds, migrations updated under `supabase/migrations/` if schema changes, docs updated (`README.md`, `docs/` when relevant).

## Security & Configuration Tips
- Copy env: `cp .env.example .env`; never commit secrets. CRA requires `REACT_APP_*` keys.
- Supabase config lives in `src/services/supabase.ts`; verify RLS and storage rules match migrations before enabling new features.
