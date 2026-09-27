# Quickstart: Transfer Room Lifecycle and UI Integration

## Intent

Give the implementation owner a focused verification order for W7-W8. These commands test browser-boundary behavior locally and do not deploy migrations, call live providers, or run release-browser evidence.

## Preconditions

- Work from `tutor-system/` with the existing lockfile installed.
- Use component 101's shared assessment/progress exports and component 102's exported six-operation facade (`initializeChecklist`, `postMessage`, `prepareTurn`, `sendReviewed`, `processMessage`, `analyzeMessage`), DTOs, and typed service boundary. Component 102 unwraps envelopes; the 103 adapter maps canonical service projections into React view state. Keep React-only view-state types in `src/contexts/transferAssessmentUiAdapter.ts`; do not edit shared type files, `transferAssessmentService.ts`, or its service tests from component 103. There is no draft DTO, no `review_draft`, no `reject_draft`, and no `regenerate_draft`.
- Consume component 102's canonical `PublicAssessmentDTO { id, student_id, selection_type, stem, options }` and `ProcessedMessageDTO { message_id, assessment_id, processing_state, answer_outcome, attempt_number, attempts_used, attempts_remaining, selected_option_ids, terminal, transition, feedback_required, code, already_processed, terminal_failure_feedback }` without redefining or renaming fields. Stop on contract drift; do not add a browser counter, compatibility DTO, or text parser.
- Keep `TRANSFER_ASSESSMENT_ENABLED` disabled unless the release owner has authorized a gate-complete environment.
- Use isolated test data. Do not target a linked hosted project with reset, seed, migration push, or destructive commands.

## Red-green verification order

1. Add or update focused tests before implementation and confirm the new tests fail for the missing behavior.
2. Implement the smallest React state-adapter and merge change while consuming component 102's DTOs unchanged.
3. Run the focused suite and confirm it passes.
4. Run the room regression suite and build.

## Focused commands

This list is the component's verification gate. It is a requirement, not a description of what has
been built: every file named here must exist and pass, and the component does not get to redefine the
gate by editing this command.

```bash
cd tutor-system
CI=true npx react-scripts test --watchAll=false --runInBand --runTestsByPath \
  src/components/__tests__/AssessmentDraftEditor.test.tsx \
  src/components/__tests__/PublicAssessmentQuestion.test.tsx \
  src/components/__tests__/PostComment.transfer.test.tsx \
  src/components/__tests__/ChatMessage.transfer.test.tsx \
  src/components/__tests__/ChecklistPanel.transfer.test.tsx \
  src/contexts/__tests__/RoomContext.transferDraftLifecycle.test.tsx \
  src/contexts/__tests__/RoomContext.transferAnswer.test.tsx \
  src/contexts/__tests__/transferAssessmentUiAdapter.test.ts \
  src/contexts/__tests__/transferAssessmentUiAdapter.contract.test.ts \
  src/contexts/__tests__/transferAssessmentUiAdapter.lifecycle.test.ts \
  src/contexts/__tests__/RoomContext.transferIngress.test.tsx \
  src/contexts/__tests__/RoomContext.transferConcurrency.test.tsx \
  src/contexts/__tests__/RoomContext.transferModes.test.tsx \
  src/contexts/__tests__/roomExportBuilder.transfer.test.ts \
  src/pages/__tests__/RoomPagePost.transferDraft.test.tsx \
  src/pages/__tests__/RoomPagePost.transferLifecycle.test.tsx \
  src/pages/__tests__/RoomPagePost.transferDecision.test.tsx \
  src/__tests__/multi_agent_room_playback.e2e.test.tsx
CI=true npm run test:regression -- --runInBand
npx tsc --noEmit
npm run build
```

`ChatMessage.transfer.test.tsx` retains its historical filename for the earlier gate, but tests
`PostComment`, the component mounted by `RoomPagePost`.

## Required focused scenarios

The focused tests must cover:

- correct focus student/message/checklist/item identity and parent IDs, including `itemId` kept `string | null`;
- public learner fields versus private teacher review-candidate fields, with `assessment_key` and pre-terminal learner-safe explanation asserted absent from UI state, props, and exports;
- dirty edit, reconfirm, an already-open delivery refused as superseded, and mode mismatch;
- tutoring/Guard room participation with assessment turn delivery;
- single-answer radios, multiple-answer checkboxes, explicit disabled-until-selected submission, canonical option IDs, and no free-text assessment input;
- `answer_outcome: retry` without disclosure, terminal `passed` on either attempt with null feedback, terminal `failed` with `terminal_failure_feedback` for applied or deferred processing, rejected/null outcomes, and no third submission;
- initial fetch, realtime duplicate, reconnect catch-up, reload, timeout retry, and duplicate-tab convergence on the same persisted attempts used/remaining and terminal state;
- pre-populated legacy dialogue surviving initial fetch, realtime insertion, and reconnect catch-up in stable order, with persisted messages chronologically ordered and deduplicated;
- a typed success envelope unwrapped by the component-102 service, then mapped from `ProcessedMessageDTO` into unchanged read-only attempts, terminal state, and disclosure;
- stem and options rendered exactly once, expanded-by-default messages, accessible participant-local folding, and preserved selection/result state while collapsed;
- owner-scoped progress views, legacy/transfer separation, and public/private exports;
- structured downstream decision consumption rather than copied suggestion text.
- legacy Multi-agent draft review, scheduled message playback, delayed pair reveal, and send gating until playback completes.

## Deferred gates

The following are deliberately not run by this component's quickstart: hosted SQL/RLS acceptance, trusted-principal authorization attacks, live provider evaluation, Promptfoo, deployment, and release-browser evidence. Component 102/105 own those gates and must provide the real DTO/auth/environment required for integration.
