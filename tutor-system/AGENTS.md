# Repository Guidelines

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
- PRs must include: summary, rationale, linked issue, screenshots/GIFs for UI changes (e.g., TutorView/RoomPage), and test notes.
- Requirements: all tests pass, coverage meets thresholds, migrations updated under `supabase/migrations/` if schema changes, docs updated (`README.md`, `claude_docs/` when relevant).

## Security & Configuration Tips
- Copy env: `cp .env.example .env`; never commit secrets. CRA requires `REACT_APP_*` keys.
- Supabase config lives in `src/services/supabase.ts`; verify RLS and storage rules match migrations before enabling new features.
