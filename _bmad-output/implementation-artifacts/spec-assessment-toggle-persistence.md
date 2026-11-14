---
title: Preserve the tutor assessment choice
created: 2026-11-14
type: bugfix
status: in-review
baseline_commit: 3becd9b
context: []
---

<frozen-after-approval reason="User authorized isolated worktree repair">

## Intent

The in-room assessment checkbox must retain the tutor's explicit choice while conversation or AI configuration updates arrive. Saving must persist the selected value. Reopening an existing room must respect its saved assessment flag even when AI is disabled.

## Boundaries & Constraints

Always preserve unrelated work and use the isolated worktree. Keep the existing explicit Save Settings interaction. Never change server lifecycle or grading behavior as part of this frontend repair.

## I/O & Edge-Case Matrix

| Scenario | State | Expected behavior |
| --- | --- | --- |
| Background update | Tutor unchecked assessment; room/config refreshes | Checkbox remains unchecked; Save persists false |
| Reopen | Saved assessment false, AI disabled | Checkbox remains unchecked |
| New room identity | Settings reused for another room | Hydrate the new room's flag |
| Untouched form | Remote assessment flag changes | Reflect the incoming value |

</frozen-after-approval>

## Code Map

- `tutor-system/src/components/AIAssistantSettings.tsx`: checkbox hydration and save.
- `tutor-system/src/components/__tests__/AIAssistantSettings.test.tsx`: settings interaction tests.

## Tasks & Acceptance

- [x] Reproduce draft reset on background room/config update.
- [x] Preserve explicit assessment edits within a room and respect persisted false independently of AI state.
- [x] Cover room changes, untouched updates, saving, and reopening with focused tests.

Given an unchecked assessment box, when background configuration changes, then Save Settings must still persist false. Given a persisted false flag, when opening settings with AI disabled, then assessment stays off.

## Verification

Run the focused AIAssistantSettings Jest suite, then TypeScript compilation. Live production schema inspection confirmed preparation and send RPCs enforce the room flag. This change is frontend only; no SQL/Edge artifacts or server deployments are required. Browser reproduction of the reported full conversation remains distinct from deterministic form regression evidence.

## Results and limits

- Regression reproduced before production edits: background room/config refresh checked the explicitly unchecked box (1 failed, 16 passed).
- After repair: 18/18 settings tests pass, including room transitions and untouched remote updates.
- Command: `OAI_MODEL=test-model REACT_APP_SUPABASE_URL=https://example.supabase.co REACT_APP_SUPABASE_ANON_KEY=test-key CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/components/__tests__/AIAssistantSettings.test.tsx` from tutor-system. Test configuration uses dummy connection values; no database writes.
- Node v22.14.0 downloaded to /tmp for execution because node/npm were absent from PATH. Existing dependencies reused via ignored node_modules symlink.
- `tsc --noEmit` fails with existing repository errors. Output compared byte-for-byte with the unchanged baseline checkout: identical. No changed-file diagnostics. `git diff --check` passes.
- Three independent reviewers found no implementation defect. Acceptance reviewer correctly notes the form test does not prove the original complete live conversation journey.
- No shared staging mutations, fixtures, migrations, Edge deployments, or production mutations performed. No lease required for read-only live schema inspection. Production RPC preparation and sending both enforce the saved flag.
- Remaining verification: full browser journey uncheck → Save → first student message → explicit understanding → reopen settings; confirm persisted false and absence of assessment. This frontend candidate is committed locally, not deployed. The demonstrated form reset is repaired; a separately reproduced failure after saving would need further investigation.

## Suggested Review Order

- Preserve explicit assessment drafts while still following untouched remote values.
  [AIAssistantSettings.tsx:147](../../tutor-system/src/components/AIAssistantSettings.tsx#L147)
- Track the room owning each explicit checkbox edit.
  [AIAssistantSettings.tsx:391](../../tutor-system/src/components/AIAssistantSettings.tsx#L391)
- Verify background refresh, persistence, room switching, and saved-off behavior.
  [AIAssistantSettings.test.tsx:128](../../tutor-system/src/components/__tests__/AIAssistantSettings.test.tsx#L128)

## Required pre-PR review loop (2026-11-14)

User requires code-smell-monitor and review-with-multi-debate to pass before any PR. Owner: root agent, branch fix/assessment-toggle-persistence. Source review pass is distinct from monitor coverage pass.

Initial monitor /tmp/ptp-assessment-smells/summary.json reports incomplete coverage. Fixed both scoped test lint errors, including an inherited multiple-assertion waitFor. All 18 focused tests pass again (/tmp/ptp-assessment-test-final.log). Rerun with identical source scope and install policy is /tmp/ptp-assessment-smells-final; added Gitleaks to PATH for missing secret-scan coverage.

Known monitor blockers: TypeScript errors (byte-identical baseline), package dependency cycles, depcheck exit 255, behavioral adapter unresolved imports/partial coverage, and dependency audit findings. These are not resolved by the settings fix. No broad dependency or architectural repair is included without investigation. Knip's only scoped candidate is this executed test file, not confirmed dead code. jscpd exits clean under its configured threshold; raw evidence nevertheless reports 17 clones (277 duplicated lines). This is not absence of duplication.

PR gate remains CLOSED unless final coverage is complete and both skills pass; do not treat an incomplete report or source-review consensus as permission to open a PR. Full live conversation journey and deployment remain unverified. Resume by diagnosing monitor coverage failures and separating inherited package findings from introduced defects; preserve exact scope/results. Audits are locally excluded under audits/.
