---
title: Unified learning target inventory
type: refactor
created: 2026-10-15
status: done
baseline_commit: 7c2c068
context: []
---

Intent: implement the user's revised single-inventory design across room templates, LLM extraction and evidence assessment.

## Approved intent

The six teaching scenarios retain five observable goals each in one `detection_areas`
inventory. Template generation and prompt extraction produce `detection_area`
checklist items. The LLM returns `{"detection_areas": ["target", "target"]}` and
judges distinct goals from the supplied content. Safe choices, recognition and
explanations all belong to that same inventory. Assessment evaluates learner
evidence against each target's actual wording.

This revision supersedes the earlier grouped-target design in
[the five-target spec](spec-five-learning-targets.md). Existing template content,
dialogue, author settings, prompt policy/examples and unrelated AI settings remain
preserved. Existing custom room configuration contributes all authored targets
to generation, including targets in either current persisted input field.

## Implementation map

- `tutor-system/src/services/detectionTemplates.ts`: unified scenario inventories.
- `tutor-system/src/services/demoRoomTemplates.ts`: teaching/demo configuration packaging.
- `tutor-system/src/services/prompts/index.ts`: one target section in rendered prompts.
- `tutor-system/src/services/llmExtractionService.ts`: one configured provider call and single-list JSON validation.
- `tutor-system/src/services/checklistIntegration.ts`: extraction output to uniform checklist items.
- `tutor-system/src/services/checklistGenerationContext.ts`: stored configuration to the same list.
- `tutor-system/src/services/promptDetectionExtractor.ts`: direct async extraction consumer.
- `tutor-system/supabase/functions/assessment-api/index.ts`: evidence applicability follows target text.
- `tutor-system/supabase/archived_migrations/20261015000000_five_learning_targets.sql`: the verified combined template-data release.

## Contracts and boundaries

| Input or condition | Required outcome |
| --- | --- |
| Any of six teaching templates | Five unique nonempty entries in `detection_areas`; generated items use `detection_area` |
| Behavior/comparison/optional legacy multi-agent demo | Current account-alert inventory, preserved individual policy and settings |
| Custom room with more than five targets | All current authored entries reach generation |
| LLM successful response | Exactly one string-array field, valid entries, whitespace trimmed, exact duplicates retained once |
| Empty prompt | Empty result, provider not called |
| Invalid schema, malformed JSON or provider failure | Consistent empty extraction result; checklist creation reports unavailable targets |
| Evidence for a learner's target | Relevant action, recognition or explanation can be credited through existing lifecycle gates |
| Existing template prompt drift | Candidate migration fails atomically before incompatible content is replaced |
| Hosted release | Exact SQL and Edge source verified on staging before production |

The schema retains its current configuration fields for existing application
interfaces. New template output stores every target in `detection_areas` and sets
`verification_steps` to an empty array. Target progress, priorities, learner
identity, evidence ownership, assessment eligibility and grading retain their
existing contracts. Existing room data is not rewritten by the template migration.

## Execution and acceptance

- [x] Consolidate source scenarios and render a single target section.
- [x] Simplify extraction result, integration and direct consumers.
- [x] Remove obsolete extraction categorization and feedback helper calls.
- [x] Evaluate target evidence consistently in the assessment API.
- [x] Update deterministic contracts and browser evidence parsing.
- [x] Prepare combined SQL and exercise native fixture failures.
- [x] Obtain fresh production and staging snapshots and inspect live source/catalogs.
- [x] Finish restored-baseline final unaffected-row checks and post-recovery catalogs.
- [x] Complete independent local review and resolve actionable findings.
- [x] Apply and verify staging SQL, then deploy and verify matching Edge source.
- [x] Promote exact artifacts and verify production, recording fixture cleanup.

Acceptance criteria:

- Given a maintained teaching template, when it creates a room and initializes
  targets, then five entries reach the checklist through one item type.
- Given actual provider output, when Smart Generate persists targets, then the
  stored target texts match the validated single-list result.
- Given a relevant safe-choice statement for a `detection_area` target, when
  assessment analysis runs, then valid evidence can advance progress and enter
  the ordinary assessment lifecycle.
- Given malformed provider output or incompatible template drift, when the path
  executes, then it reports an empty result or atomic failure without invented goals.
- Given a completed staging journey, when production receives the exact artifacts,
  then the same contract and affected assessment journey pass with cleanup evidence.

## Verification and current state

Combined deterministic acceptance: 11 Jest suites, 105 tests passed, 29 opt-in
tests skipped. Edge API: 34 tests passed, including its Deno type check. Browser
runner/seeder unit checks passed. Build passed. Compiler comparison: 454 baseline
versus 453 current diagnostics, zero additions. Three unrelated BDD failures were
reproduced on the original baseline.

Both fresh restored hosted baselines passed SQL contract, preservation,
permission, atomicity, idempotence and unaffected-row checks after authorized
cache cleanup and isolated PostgreSQL recovery. Final catalogs and checkpoint
passed. Three independent reviews completed with findings resolved.
Exact SQL is applied and verified on staging and production; assessment API v57
and v12 respectively use the tested source. Production MCP byte comparison passed
for all ten deployed files. Real extraction, ordinary safe-choice coverage and a
new five-target room's complete assessment journey passed in both environments.
Final cleanup verified zero remaining generated room and workflow records. The
SQL is archived with its tested hash unchanged. The final production build passed
with existing warnings; frontend browser checks used that build locally against
the released production backend.

The release record links full inputs, outputs, commands, failures and resume
instructions. Local evidence is under `output/unified-learning-targets/`; migration
evidence is under `/Users/admin/.transfer-assessment-pg17/runs/unified_learning_targets/20261015T195221Z/`.
