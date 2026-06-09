# Repository Guidelines

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

## Commit & Pull Request Guidelines
Recent history uses short imperative commits, often with prefixes like `feat(ui): ...` or `fix(ai): ...`. Keep commits focused and readable.

PRs should include a short problem statement, the approach taken, test evidence, and screenshots for UI changes. If you touch schema or security behavior, update `supabase/migrations/` and the nearest relevant docs such as `tutor-system/README.md` or `tutor-system/claude_docs/`.

## Security & Configuration Tips
Do not commit secrets. Frontend env vars should use `REACT_APP_*`. When changing Supabase-related code, make sure `src/services/supabase.ts` and the SQL migrations stay aligned, especially for RLS and storage policies.
