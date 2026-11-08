# Checklist state consolidation — issues #59 and #60

Intent: record the checklist ownership cleanup, progress correction, and verification evidence for integration into the issues #57–#66 batch.

Updated: 2026-11-08. Source baseline commit: `a69b836b7a46d801beb8139415691f4cb3b494ae` (`origin/no_sign_up`). Implementation owner: `checklist_state`; integration and release owner: root orchestration agent.

## Changed behavior

Legacy manual submission counts detection and verification inputs directly instead of building a discarded synthetic checklist. Only the saved service result enters checklist state; initial pending/important counters retain their input-count contract. Transfer submission continues through learner-owned target initialization.

Generation, smart generation, fallback generation, refresh, and trusted progress edits share the existing `progressForChecklist` calculation. Trusted edits now recompute all six priority counters alongside aggregate counts. Partially covered items count as pending within their priority, and completion uses rounded covered/total percentage. Existing null-progress guards, zero-item behavior, absent-item behavior, failure retention, and service-level progress semantics are preserved.

## Local verification

From `tutor-system/`, with `REACT_APP_SUPABASE_URL=http://127.0.0.1:54321` and `REACT_APP_SUPABASE_ANON_KEY=ci-placeholder`:

```sh
rtk npm test -- --watchAll=false --runInBand --silent --runTestsByPath src/hooks/__tests__/useChecklist.progress.integration.test.tsx src/hooks/__tests__/useChecklist.smartGeneration.test.tsx src/hooks/__tests__/useChecklist.earlyMessages.integration.test.tsx src/components/__tests__/ChecklistPanel.transfer.test.tsx
rtk proxy ./node_modules/.bin/tsc --noEmit --pretty false
```

The four focused suites pass: **75 tests**, including 21 new hook integration cases. Cases exercise empty/detection-only/verification-only/mixed manual input, null and failed saves, transfer target submission, all generation branches, all three priorities, both item types, covered/partial/pending transitions, rounding, trusted returned status, an absent item, an empty checklist, rejected writes, and deletion while a trusted edit is pending. The late edit leaves a deleted checklist and its progress null.

An initial run without explicit environment values failed to import the existing smart-generation suite (`supabaseUrl is required`); the three other suites passed. The rerun uses the deterministic placeholders above and passes all four suites. No hosted requests are needed by these checks.

Full TypeScript checking exits 2 with **439 diagnostics** in the repository. Neither modified `useChecklist.ts` nor the new progress integration test has a diagnostic. Root owns the baseline comparison and combined build gate. Mypy does not apply to this TypeScript-only change. `git diff --check` passes.

Local untracked logs are `output/issues-59-60/jest.log` and `output/issues-59-60/typescript.log` in the worktree `PhishingTrainingProgram-worktrees/issues-59-60-20261108`.

## Integration acceptance

Scope is browser checklist state; no SQL, Edge Function, authorization, provider prompt, or server runtime configuration changes. Root must review and verify the combined candidate, run the affected staging checklist creation/edit interaction, and verify that interaction after frontend release. The selected production smoke must show persisted IDs after manual creation and correct counters after a trusted priority/status edit. Local evidence alone does not claim staging or production verification.
