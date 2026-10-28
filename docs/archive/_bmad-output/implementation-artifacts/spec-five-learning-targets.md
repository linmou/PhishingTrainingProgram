---
title: Five learning targets per room scenario
type: feature
created: 2026-10-15
status: in-review
baseline_commit: 8441f11eba0331e2481265f3807fe51732218764
context: []
---

Intent: implement the user's approved consolidation of scenario knowledge into at most five learning targets, with matching maintained and persisted room templates.

Current implementation intent: [unified learning targets](spec-unified-learning-targets.md), following the user's revised single-inventory design. This file preserves the earlier approved design and evidence.

<frozen-after-approval reason="user approved the proposed targets and file scope before requesting implementation">

## Intent

**Problem:** Teaching scenarios currently contain many overlapping detection and verification points. Three production privacy templates have no saved AI knowledge configuration. Learners need a bounded set of observable goals rather than a long inventory of repeated details.

**Approach:** Consolidate the six named teaching scenarios to five total learning targets each, keeping the existing detection and verification configuration fields. Maintain separate scenario definitions for Account Security Alert, Nintendo Switch Deal, iTunes Gift Card Survey, Location Sharing, Movie Meetup, and Phone Number Exposure. Account-alert demo variants inherit the same targets.

## Boundaries & Constraints

**Always:** Count detection areas plus verification steps together. Preserve the approved concepts and observable actions. Keep template names, stable IDs, scenario content, dialogue and unrelated settings intact. Keep custom room targets unrestricted. Update persisted template prompts with their inventory. Validate staging before promoting the exact artifact to production and record evidence.

**Ask First:** Changes to existing learner rooms or removal of existing repository files require separate authorization.

**Never:** Rewrite active room inventories, alter frozen evaluation datasets, change assessment scheduling or introduce a new target schema.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Teaching catalog | Any of six named scenarios | Five nonempty unique targets across both lists | Deterministic catalog tests catch invalid entries |
| Account-alert demos | Existing behavior and comparison variants | Same five-target inventory as the teaching scenario | Retain each variant's settings and prompt condition |
| Privacy teaching templates | Existing production scenario content, no AI config | Maintained definitions with appropriate scenario config | Preserve source content and OP settings |
| Checklist initialization | Room config copied from a teaching seed | Five persisted items reach checklist context without extraction | Existing missing-config errors remain supported |
| Custom room | More than five user-authored targets | Existing user-authored inventory retained | No global truncation |
| Hosted data drift | Template missing, duplicate, or unrelated changed settings | Deployment requires explicit checked preconditions and scoped changes | Fail rather than overwrite unrelated values |

</frozen-after-approval>

## Code Map

- `tutor-system/src/services/detectionTemplates.ts` defines detection and verification inventories consumed by prompts and checklist generation.
- `tutor-system/src/services/demoRoomTemplates.ts` packages prompts and inventories for teaching and demo templates.
- `tutor-system/src/services/checklistGenerationContext.ts` combines persisted detection and verification inventories, bypassing LLM extraction.
- `tutor-system/scripts/seed-behavior-demo-templates.js` maintains staging template data.
- `tutor-system/src/services/__tests__/` contains catalog, packaging and checklist-context tests.
- `tutor-system/docs/supabase-release-workflow.md` defines local migration validation and environment acceptance.

## Tasks & Acceptance

**Execution:**
- [x] `tutor-system/src/services/detectionTemplates.ts` — consolidate the six scenario inventories; add a distinct Movie Meetup definition; preserve generic/custom behavior.
- [x] `tutor-system/src/services/demoRoomTemplates.ts` and `tutor-system/scripts/seed-behavior-demo-templates.js` — maintain privacy seeds and wire normal teaching selection and seeding while preserving established ecological case identities.
- [x] `tutor-system/src/services/__tests__/detectionTemplates.test.ts` and `demoRoomTemplates.test.ts` — verify counts, uniqueness, mappings and demo inheritance without asserting generated LLM wording.
- [x] `tutor-system/src/services/__tests__/checklistGenerationContext.test.ts` — verify the real seed-to-persisted-config-to-checklist-context path and custom inventories above five.
- [x] `tutor-system/docs/aiService.md` and a dated documentation record — document target semantics, changed experiment factors, validation, exact artifacts, release status and remaining gates.
- [x] `tutor-system/supabase/migrations/` — prepare a reviewable, scoped template-data artifact with regeneration of compatible prompts and a native PostgreSQL fixture test.
- [ ] `tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_15_five_learning_targets.md` — satisfy MCP inspection and fresh restored-baseline release gates, then verify staging and production with exact-artifact promotion.

**Acceptance Criteria:**
- Given a teaching template, when its configuration initializes a room checklist, then exactly five unique nonempty targets are available with both recognition and safe-action coverage.
- Given an account-alert demo, when its configuration is built, then its knowledge inventory matches the consolidated account scenario while its individual behavior condition remains intact.
- Given an existing production template, when the release artifact runs, then only intended knowledge configuration and generated prompt data change; existing room state and unrelated template content remain intact.
- Given staging verification, when production receives the same artifact, then readback and affected application checks confirm the five-target contract and record cleanup.
- Given missing release access, when local work completes, then the result remains incomplete for deployment and records the exact prerequisite without claiming release.

## Spec Change Log

## Design Notes

Use four recognition targets and one action target for scam scenarios. Use three recognition targets and two action targets for privacy scenarios. This preserves the current schema and keeps five total checklist items. Privacy scenario source content was read directly from production on 2026-10-15; staging currently contains two global templates and production nineteen, so deployment must handle missing staging rows explicitly. Frozen evaluation inventories remain historical baselines; tests should compare current catalog against current scenario definitions rather than require equality to frozen inventories.

## Verification

- Focused Jest catalog, demo packaging, checklist-context and affected integration suites must pass.
- TypeScript checking and build must pass or distinguish unchanged baseline errors with exact evidence. Run the requested mypy check where applicable and record that runtime files are TypeScript.
- SQL changes require MCP live inspection, fresh hosted baseline validation, existing-data/atomicity checks, staging application and integrated verification, then exact-artifact production promotion and verification.
- Record changed factors: target wording, inventory size/grouping, regenerated prompt knowledge and newly configured privacy templates. Tutor policy, model settings and evaluation methodology are separate preserved controls.

## Review and delivery state

Local implementation review is complete. Three independent reviewers' targeted
rechecks found no remaining defects after the seeder and SQL preservation fixes.
Four Jest suites passed (56 tests), four CLI fixtures passed, native PostgreSQL
fixture checks passed, and the build passed. Six read-only staging provider smoke
calls returned complete decision JSON using the consolidated local configurations.

Release acceptance remains open: this session has no Supabase MCP tools for the
repository-required live schema inspection. No template/schema/room data was
changed remotely. Fresh restored-baseline validation and affected staging and
production journeys must pass before this spec can be marked done. Exact hashes
and evidence are in the dated release record.

## Suggested Review Order

- Start with the five-target recognition/action grouping.
  [detectionTemplates.ts:7](../../../../tutor-system/src/services/detectionTemplates.ts#L7)
- Follow privacy source content into the maintained teaching catalog.
  [demoRoomTemplates.ts:568](../../../../tutor-system/src/services/demoRoomTemplates.ts#L568)
- Check prompt-condition preservation for controlled comparisons.
  [demoRoomTemplates.ts:518](../../../../tutor-system/src/services/demoRoomTemplates.ts#L518)
- Inspect scoped migration updates and drift checks before release.
  [20261015000000_five_learning_targets.sql:464](../../../../tutor-system/supabase/archived_migrations/20261015000000_five_learning_targets.sql#L464)
- Check privacy seeding rejects incompatible existing configurations.
  [seed-behavior-demo-templates.js:95](../../../../tutor-system/scripts/seed-behavior-demo-templates.js#L95)
- Verify the real seed-to-checklist configuration path.
  [checklistGenerationContext.test.ts:46](../../../../tutor-system/src/services/__tests__/checklistGenerationContext.test.ts#L46)
- Read remaining release gates and the full evidence index.
  [documentation_update_record_v2026_10_15_five_learning_targets.md:55](../../../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_15_five_learning_targets.md#L55)
