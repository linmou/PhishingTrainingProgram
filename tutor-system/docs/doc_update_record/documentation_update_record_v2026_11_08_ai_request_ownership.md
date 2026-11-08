# AI request ownership and history packaging

Intent: record issues #57 and #61, their request boundary and verification evidence.

Date: 2026-11-08. Baseline: `a69b836` (`origin/no_sign_up`). Owner: `ai_requests`; integration/release owner: root orchestration agent.

## Change and scope

One room snapshot at suggestion entry supplies enablement, model/prompt, prior
Guard mode, scenario metadata and pre-populated history. Configuration and context
helpers consume that snapshot; their standalone APIs still acquire room data.
No later room revalidation is introduced. Extended configuration, checklist,
message pagination, assessment readiness and context-message tracking remain
separate responsibilities. Cyberbullying retains its server-owned early return.

Removed the no-op history copy and moved each history serializer into its selected
Phase 0/ecological branch. Full input history and branch-specific role/system
formatting remain intact. The production prompt/provider settings and backend
artifacts are unchanged. No latency improvement is claimed.

## Verification

The orchestration test `aiService.requestOwnership.test.ts` executes the real
context builder and records query projections: one room acquisition supplies
config/scenario/history/Guard, while extended settings and paginated messages
remain independently acquired. It covers disabled/missing/read-failed rooms and
the cyberbullying early return. Packaging cases cover both branches, mixed/empty
history, explicit/inferred/blank focus and frozen input objects. Existing context
tests retain pagination, assessment readiness and standalone-call coverage.

Initial focused checks exposed mocks depending on removed room reads; those mocks
were updated to supply the full request snapshot. No existing test was removed.
Full TypeScript checking reports existing repository test diagnostics; introduced
test timestamp omissions were corrected. Final command outcomes and release
acceptance are recorded below after verification. `rtk mypy
tutor-system/src/services/test_aiService.py` passed the existing Python companion;
it does not typecheck the changed TypeScript, for which build/TypeScript checks
are the applicable evidence.

Final local checks:

- With placeholder local Supabase URL/key, `CI=true npm test -- --watchAll=false
  --runInBand --silent --testPathPattern='(aiService.*test|simplifiedAIContext.test|ecologicalTutorCall.*test)'`:
  **13 suites / 81 tests passed**. The new orchestration and packaging suite has
  12 cases; the existing context suite has 18 cases.
- `CI=false npm run build`: passed; existing lint warnings are outside the changed
  runtime files (ImageUpload, useChecklist, RoomPagePost, imageUpload and
  prompts/parameterConfig).
- `tsc --noEmit --pretty false`: repository-wide test typing failures remain;
  no diagnostics match changed runtime files or the new request-ownership suite.
- Independent `checklist_state` review found no blocking findings and separately
  ran request-ownership/context suites: **2 suites / 30 tests passed**.

## Delivery acceptance

This is a frontend orchestration change, with no SQL, Edge or runtime-secret
artifact. Integration owner must verify the combined staging tutor-suggestion
journey and the released frontend smoke journey, preserving request readiness and
reviewed-send behavior. Applicable checks follow the shared-orchestration row of
`docs/supabase-release-workflow.md`; live evidence remains open until integration.
