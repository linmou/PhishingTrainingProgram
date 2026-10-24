# Code Review

Read [AGENTS.md](AGENTS.md), the PR intent, diff, affected callers, and relevant contracts before reviewing.

## Review passes (universal)
1. **Bugs:** observable regressions, incorrect logic, races, error paths, and broken assumptions.
2. **Security:** authorization/trust boundaries, injection, secrets, data leaks, and unsafe changes.
3. **Contract:** does the diff satisfy its stated requirements without violating existing behavior or release policy?

## High-value hotspots (PhishingTrainingProgram)
- Cross-room permissions, browser-managed identity, Supabase RLS/RPCs, and Edge authorization.
- Assessment grading, private answer data, Guard Mode, learner progress and response-rating rules.
- LLM provider failure/malformed output, prompt behavior and tutor/learner-visible state.
- Concurrent fixtures, Staging project lease, migrations, SQL-before-Edge ordering and exact deployed artifacts.
- Default-branch changes: Render auto-deploy and merge/production compatibility.

## Findings and noise control (universal)
- Start with `Important: N | Nits: N | Pre-existing: N`. Say explicitly if no actionable issues were found.
- For **Important** findings give `file:line`, trigger, consequence, evidence, and a focused fix/test. Distinguish verified defects from hypotheses.
- Separate pre-existing defects from regressions introduced by this PR. Do not restate CI diagnostics as review findings.
- Report **at most 3 Nits**. Do not repeat previous findings; after 3 review/fix rounds, ask the owner to reassess rather than looping indefinitely.
- State any verification gaps. A clean review does not establish Staging/Production acceptance or authorize merge.
