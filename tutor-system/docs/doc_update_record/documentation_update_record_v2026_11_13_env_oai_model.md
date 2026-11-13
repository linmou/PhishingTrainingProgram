# Environment-configured production model release

Owner: root/Codex. Batch: 2026-11-13-env-oai-model. Status: local validation / release incomplete.

## Scope and acceptance

User requests removal of DEFAULT_AI_MODEL and all source-pinned production model names; use existing OAI_MODEL. Both ai-api and assessment-api provider calls and provenance now require that trimmed server secret. Frontend commands bridge canonical OAI_MODEL from CRA env files into public model metadata; no provider credential is exposed. Seed scripts require the same setting. Missing/blank settings fail closed.

No SQL changes. Inherited dependencies: currently released database contracts and analyzer, provider credentials/base URL, and frontend Render configuration. Owner root/Codex owns precondition verification and the release. Latest origin/no_sign_up 1211725 was merged before final validation to retain released analyzer changes.

Acceptance: arbitrary configured model passes deterministic request/provenance tests; missing/blank model never calls provider. On staging and production verify both functions and affected tutor/analysis/assessment behavior using the actual configured provider, persisted evidence and cleanup. Before production, merge reviewed candidate into no_sign_up and compare committed source hashes against staging. Frontend build requires OAI_MODEL configured in Render; keep it aligned with the server. Never promote a stale frontend-imported server model default.

## Local evidence

- Initial focused frontend run: four suites passed; one obsolete model display-name assertion failed, replaced by arbitrary-model/absent-setting checks.
- Focused updated frontend run: five suites passed, 58 tests passed, 29 skipped.
- Original Edge suites: 68 passed. Integrated Edge suites: 73 passed, including missing/blank analyze_message configuration. Temporary Deno runtime, no Docker used. Deno nested check changed lock resolution incidentally; original lock restored.
- Frontend production build passed before and after integrating the latest shared branch.
- Initial full Jest with OAI_MODEL=ci-test-model: 147 suites passed, five failed due obsolete hard-coded expected model names or source-pinning assertions. Fixed those assertions. The rerun exposed three test-file parse failures caused by placing imports before existing shebangs; removed those obsolete shebangs. All three repaired suites passed (20 tests); remainder of full rerun pending.
- Build bridge tests: three passed, covering canonical mapping, mode, shell precedence, forwarding and absent/blank settings.
- Three independent local review roles found seed-script bridge omission and missing bridge tests, both repaired. No server-code blocker found.

## Hosted status and resumption

Read-only Management API preflight: both projects accessible, both contain OAI_MODEL secret name. No hosted mutations yet. Staging: ciubrzggdqesgvfkpolj. Production: zgbufaxooqxeabewktzd.

Remaining gates: final local checks, actual PR CI/review, staging lease, deploy exact candidate and affected real-provider journeys, merge authorization and integrated artifact comparison, production deployment/verification, cleanup evidence. Production acceptance remains open. Trigger: all current candidate checks/review and combined staging acceptance pass. Owner root/Codex resumes from this record and PR, retaining existing deployment state until gates pass.
