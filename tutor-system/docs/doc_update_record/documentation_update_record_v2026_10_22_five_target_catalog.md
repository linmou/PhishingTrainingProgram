# Five-target catalog cleanup

Intent: record why the scenario catalog now follows the five-target rule everywhere and what was retired.

Date: 2026-10-22. Baseline commit: `9b90c84`.

## Changes

- `General Scam Indicators` keeps its role as the checklist modal's "Use Template" fallback but now has five targets (was 18). The eighteen fragments, which mixed warning signs with verification actions, are merged into five target statements: offer plausibility, urgency, sender and link, requests for personal information, independent verification. Poor-grammar, social-proof and "trust your instincts" fragments are no longer separate targets.
- `Personal Details Protection` (11 targets) is retired from `SCENARIO_TEMPLATES` and the scenario dropdown. No other feature depended on it.
- The catalog has seven entries: six teaching scenarios plus `General Scam Indicators`. `detectionTemplates.test.ts` asserts five unique targets for each and that the retired name is absent.
- The `Template system integration` BDD scenario and `features/checklist_management.feature` now expect the five new targets.
- `src/services/README.md` and `docs/aiService.md` state the rule without the former exemption.
- Earlier commit `9b90c84` gave `Phone Number Phishing Training` its own image, `privacy_3.png`.

## Compatibility

Existing rooms keep their saved targets. A room saved with the old 18-target or 11-target list shows "Custom / General" in the scenario dropdown because it no longer matches a template; unknown scenario names fall back to the saved targets.

## Release state

Not deployed. The catalog is frontend code; the room image change also needs the global templates re-seeded. Both are awaiting a named staging batch.
