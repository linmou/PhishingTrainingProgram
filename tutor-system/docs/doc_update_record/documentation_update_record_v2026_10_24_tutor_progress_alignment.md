# Tutor progress alignment

Intent: record issue #2's authoritative-context fix, diagnostic replay evidence and outstanding acceptance work.

Updated: 2026-10-24. Implementation baseline: `7762cbb8eaeccf8c92360dc8eb335219651cd4b1`.
Issue: <https://github.com/linmou/PhishingTrainingProgram/issues/2>.
Release and integrated verification owner: root agent.

## Cause and Change

Read-only live MCP inspection found one active learner-owned `transfer_v1` checklist in the reported room, with URL Analysis still `partially_covered/basic`. `aiService.generateTutorSuggestion` read `getChecklistByRoom`, which explicitly selects `legacy_v1`; therefore the tutor received no recorded progress for this room. Its old projection also omitted learner identity, target identity and understanding level. The 33-entry conversation was present: this was not a truncated-history reproduction. RoomContext already awaited ordinary evidence analysis and assessment preparation before tutor generation.

Tutor generation now requires the selected learner/message and preparation outcome for transfer rooms, reads that learner's current transfer checklist, and fails on missing/wrong-owner/unavailable progress. The snapshot retains IDs, understanding levels, target version, preparation outcome and explicit unresolved/follow-up targets. It enters both the auditable configuration snapshot and the final provider user turn. The active target-selection clause distinguishes acknowledgment from demonstrated understanding and requires a teaching reason plus named follow-up for an intentional switch. Existing T02/P2, response-contract P4/H4 and T09 readiness rules remain the authority. Assessment preparation still preempts ordinary tutoring when it produces a candidate.

Changed experimental factors: authoritative checklist selection; richer progress input and salience in the final user turn; explicit acknowledgment/follow-up interpretation in the active target-selection instruction. Analysis prompt, transition table, model, tutor temperature/token limit and assessment eligibility policy are unchanged.

## Diagnostic Evidence

Raw local evidence is retained under `output/issue-2-replay/` in the issue worktree, outside Git. `source.json` contains the MCP-exported actual scenario, configured targets, conversation and room prompt. The replay uses the actual assessment handler and transition function, ChecklistService, simplifiedAIContext, aiService and configured OpenAI-compatible provider. Database reads are frozen exports and writes are replaced by a capturing RPC adapter. It is provider-only verification, not a live persisted lifecycle run. Analysis covers all 16 room targets. Tutor context includes all 33 entries through the reported acknowledgment, including pre-populated dialogue; analysis uses the saved-message prefix. Exported target states are replay priors, not claimed historical reconstruction.

Comparable baseline: `baseline-2026-10-24T06-44-44-494Z`.
Candidate: `candidate-2026-10-24T06-43-26-425Z`.
Settings: `qwen3.8-flash`, configured `OAI_BASE_URL`, thinking disabled; analysis temperature 0/max_tokens 600; tutor temperature 0.3/max_tokens 600; one repetition; two concurrent provider calls at most. Each directory retains source snapshots, manifest, metadata and complete per-case provider requests/responses, applied events, per-target transitions, projected eligibility and tutor decisions.

| Case | URL result | Final-check eligibility | Baseline/Candidate observation |
| --- | --- | --- | --- |
| Actual acknowledgment: `Ah , i understand` | partial/basic, no event | false | Baseline moves to urgency with no URL follow-up. Candidate retains URL Analysis and asks the learner why a shortened link obstructs verification. |
| Controlled concrete URL explanation and independent safe action | covered/good, demonstrated_understanding | true | Replay stops ordinary tutor generation and records that trusted assessment preparation must run next. |
| Controlled claim that bit.ly proves Apple legitimacy and is safe to click | needs_review/basic, contradiction | false | Candidate corrects the URL inference and supplies an independent safe action. |

Candidate acknowledgment analysis SHA-256: `403468649be63b205388d192f118d21e82bab5a7ebd8f05a5a48deb27d9989b2`.
Candidate acknowledgment tutor SHA-256: `e983fb12e5f9b25fe165b429d1a96c1df4e7791bf50707e03df0c0d439830309`.
Baseline acknowledgment tutor SHA-256: `e9d698f7217f2cc5bd0cff0c155880f59c02227b1debe9b7251c2240131a9160`.

Earlier diagnostic runs are retained, including the missing practice-header failure, an incomplete frozen-read adapter, and two candidates that still omitted follow-up. Those are not acceptance evidence. The first success with all-target analysis is the candidate directory named above. The current replay script pins the baseline commit, bounds concurrency, saves successful provider calls as resumable intermediate evidence, validates frozen inputs on resume and never writes to Supabase.

## Verification and Remaining Gates

Focused integration command (one Jest worker): the 10 suites `aiService.learningProgress`, `aiService.guardMode`, `aiService.multiAgentRequired`, `aiService.externalFailure`, `aiService.authFallback`, `simplifiedAIContext`, `RoomContext.checklistCoverage`, `RoomContext.transferModes`, `RoomContext.transferDraftLifecycle` and `RoomContext.quickAdjustPersistence` passed, 79 tests total. Checks cover learner/focus/preparation scope, missing/wrong-owner/read failures, same-label target identity, deleted targets, status pairs, persisted snapshot, assessment-feedback handoff and regeneration. Tests assert state/contracts, not LLM wording. Production TypeScript compilation excluding test files reports zero diagnostics. Full repository `tsc --noEmit` remains blocked by existing test typing errors.

This is a successful focused diagnostic, not a full behavior-benchmark acceptance verdict. Full existing tutor regression metrics, three repetitions, calibrated semantic evaluation, independent holdouts and independent refinement audit remain pending. No formal experimental behavior version is registered. A prompt cannot deterministically guarantee its own semantic conformance; the demonstrated acknowledgment behavior is measured evidence, not such a guarantee.

The release owner must next verify the integrated candidate on an isolated staging room: initialize the same targets/prior states; replay the actual saved prefix; send acknowledgment and verify persisted partial/basic with no assessment; generate tutor suggestion and inspect named unresolved follow-up; send concrete understanding and verify accepted Partial-to-Covered evidence causes trusted preparation to return the final assessment before any ordinary tutor draft; verify misconception reopens review without assessment, then repair/recovery, assessment answer/retry/terminal feedback and cleanup. Preserve all actual provider input/output, RPC transitions, hashes, model settings and cleanup results. Repeat selected acceptance on the production artifact if server dependencies require release. Shared writes require the root-held coordination lease. No shared fixture or deployment was mutated in this task.
