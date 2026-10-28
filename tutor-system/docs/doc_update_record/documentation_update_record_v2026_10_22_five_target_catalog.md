# Five-target catalog cleanup

Intent: record why the scenario catalog now follows the five-target rule everywhere and what was retired.

updated: 2026-10-26. Original baseline: `9b90c84`. Recovery commits: `41eb8a1`, `319e472`. Issues: #34, #35. Release owner: root Codex agent.

## Changes

- `General Scam Indicators` keeps its role as the checklist modal's "Use Template" fallback but now has five targets (was 18). The eighteen fragments, which mixed warning signs with verification actions, are merged into five target statements: offer plausibility, urgency, sender and link, requests for personal information, independent verification. Poor-grammar, social-proof and "trust your instincts" fragments are no longer separate targets.
- `Personal Details Protection` (11 targets) is retired from `SCENARIO_TEMPLATES` and the scenario dropdown. No other feature depended on it.
- The catalog has seven entries: six teaching scenarios plus `General Scam Indicators`. `detectionTemplates.test.ts` asserts five unique targets for each and that the retired name is absent.
- The `Template system integration` BDD scenario and `features/checklist_management.feature` now expect the five new targets.
- `src/services/README.md` and `docs/aiService.md` state the rule without the former exemption.
- The AI settings "Scenario Template" dropdown is now generated from `SCENARIO_TEMPLATES`, grouped by `type`, so it can no longer drift from the catalog. This adds the missing `Movie Meetup Social Engineering`; a test asserts every catalog entry is offered.
- Earlier commit `9b90c84` gave `Phone Number Phishing Training` its own image, `privacy_3.png`.

## Compatibility

Existing rooms keep their saved targets. A room saved with the old 18-target or 11-target list shows "Custom / General" in the scenario dropdown because it no longer matches a template; unknown scenario names fall back to the saved targets.

## Release state

Batch: `template-recovery-20261026`. Local focused catalog, settings and checklist tests precede PR review and staging checks. Staging acceptance checks the phone template image, creates a tagged room through the UI, verifies five generic fallback targets and preserves saved custom targets. The image refresh changes only the matching global template's `image_url`; existing rooms and AI configuration stay unchanged. The general seed script skips privacy-template images and must not be used for this refresh.

After authorized merge, compare integrated artifacts, apply the exact image update to production, verify the same affected browser flow and cleanup. The separate dropdown PR #33 is verified on the integrated catalog afterward. Staging/production acceptance is pending; no deployment is claimed by the recovered historical record.

Recovery result (2026-10-26): merged in PR #36 as `97883a6`; image-only correction verified on both projects with unchanged non-image fields. Four focused suites passed 40 tests. Phone-room creation, generic five-target selection, custom save/reopen and cleanup passed in both environments. The combined dropdown acceptance and final public production check are tracked in [the current record](documentation_update_record_v2026_10_26_scenario_dropdown.md) and PR #33.
