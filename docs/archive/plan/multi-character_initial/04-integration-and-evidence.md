# 04 — Later integration and inspected repository evidence

## 1. What “ready to merge” means here

The demo lives in the same app and uses the same toolchain/model configuration. It keeps three clean responsibilities: explicit-input sequence generation, a controlled sequence editor, and speaker-aware transcript rendering. This avoids a throwaway UI while preserving isolation.

It does **not** mean shared-room integration will be a flag flip. That stage introduces real persistence and coordination requirements, which must be implemented and verified rather than simulated by client-side state.

### Reuse later

- Call the generation function with a scenario and a delivered, speaker-labeled room transcript.
- Embed the same controlled sequence editor in the tutor view.
- Reuse the character registry and rendering rules.
- Preserve original/generated, edited/approved, and delivered representations in persistent review records.

No generic adapter framework is needed now. These explicit function inputs and component props are the extension points.

### Add only at the shared-room milestone

1. **Distinct presentation setting.** Add a room-level interaction format such as `single_tutor | multi_character`. Do not overload `TutorResponseMode`: number of characters and tutoring/Guard/assessment behavior are separate dimensions.
2. **Stored identities and authorship.** Persist `speaker_id`, `sequence_id`, and `sequence_position` on delivered messages or an equivalent normalized structure. Keep the real human reviewer/author identity. Do not create fake student accounts or use a student role for the misleading peer.
3. **Private drafts and authoritative publication.** Store drafts separately from student-readable messages. Publish each approved message when due; do not insert both into student-readable history and hide the second with CSS. Preserve actual delivery status and retry safely.
4. **Shared turn lock and recovery.** Enforce blocked learner submission at the trusted write boundary while a reviewed sequence is in progress, not only in the UI. Define what happens when a tutor disconnects, a second message fails, or a review is abandoned; prevent permanently locked rooms. Add idempotent publication before supporting retries. A local browser ref is not a cross-device lock.
5. **Teach/assess on actual learner evidence.** Both synthetic characters remain AI-authored content. Their messages must not count as learner mistakes, progress evidence, or extra learner turns. Decide explicitly how a single batch relates to checklist updates and transfer-assessment confirmation; do not call the old one-message processing path twice and assume that is correct.
6. **Resolve behavioral interactions.** Scope misleading-role behavior away from automatic tutor sanctions. An actual safety/Guard/assessment condition should suppress the peer when appropriate. Revisit mandatory ratings (per character or per sequence), tone settings (tutor only), and exports. Test those interactions before enabling the format in ordinary rooms.

For a public/shared deployment, review authorization, credential handling, student visibility, and logging under the actual deployed backend. The sandbox flag and side-by-side panels provide none of those guarantees.

## 2. Why the demo avoids existing room orchestration

All links below are pinned to inspected commit `59fd1f4ec1caca2befa90917022c2e21e1f869c9`.

| Inspected code | Observation and design consequence |
|---|---|
| [`src/App.tsx`](https://github.com/linmou/PhishingTrainingProgram/blob/59fd1f4ec1caca2befa90917022c2e21e1f869c9/tutor-system/src/App.tsx) | Uses `HashRouter` and an application-wide provider tree. Add a separate route; do not reorganize providers for this demo. |
| [`components/AISuggestionBox.tsx`](https://github.com/linmou/PhishingTrainingProgram/blob/59fd1f4ec1caca2befa90917022c2e21e1f869c9/tutor-system/src/components/AISuggestionBox.tsx) | Accepts one `suggestion: string` and copies it into an input. Add a separate sequence editor rather than change its public contract. |
| [`contexts/RoomContext.tsx`](https://github.com/linmou/PhishingTrainingProgram/blob/59fd1f4ec1caca2befa90917022c2e21e1f869c9/tutor-system/src/contexts/RoomContext.tsx) | Coordinates messages, identity decoration, subscriptions/polling, reviewed-send state, and transfer-specific paths. Avoid attaching the local demo to this orchestration. |
| [`services/guardModeService.ts`](https://github.com/linmou/PhishingTrainingProgram/blob/59fd1f4ec1caca2befa90917022c2e21e1f869c9/tutor-system/src/services/guardModeService.ts) | `sendReviewedTutorResponse` accepts one final response and calls the single-message reviewed-send operation. The prototype does not pretend that calling it twice is one review. |
| [`pages/RoomPagePost.tsx`](https://github.com/linmou/PhishingTrainingProgram/blob/59fd1f4ec1caca2befa90917022c2e21e1f869c9/tutor-system/src/pages/RoomPagePost.tsx) | Has a mandatory latest-response rating gate and integrates normal/Guard/assessment composition. A separate demo avoids these gates without deleting them from ordinary rooms. |
| [`components/PostComment.tsx`](https://github.com/linmou/PhishingTrainingProgram/blob/59fd1f4ec1caca2befa90917022c2e21e1f869c9/tutor-system/src/components/PostComment.tsx) | AI-generated names are presented as “AI Assistant”; Guard has a special identity. Render explicit character IDs in the demo rather than using this component unchanged. |
| [`services/ecologicalTutorCall.ts`](https://github.com/linmou/PhishingTrainingProgram/blob/59fd1f4ec1caca2befa90917022c2e21e1f869c9/tutor-system/src/services/ecologicalTutorCall.ts) | Generic assistant history is labeled `Tutor/AI`. Multi-character history needs explicit attribution throughout. |
| [`services/aiService.ts`](https://github.com/linmou/PhishingTrainingProgram/blob/59fd1f4ec1caca2befa90917022c2e21e1f869c9/tutor-system/src/services/aiService.ts) | The inspected suggestion path uses the compatible chat endpoint, parses one tutor decision, and caps output at 100–120 tokens. The new service uses the same configuration pattern but a new contract and a 600-token initial budget. |
| [`prompts/activeTutorAgentPrompt.ts`](https://github.com/linmou/PhishingTrainingProgram/blob/59fd1f4ec1caca2befa90917022c2e21e1f869c9/tutor-system/src/services/prompts/activeTutorAgentPrompt.ts) | Pedagogical rules are interleaved with the single-response schema and Guard policy. Preserve core tutor behavior in a scoped demo prompt; do not append contradictory global instructions. |
| [`package.json`](https://github.com/linmou/PhishingTrainingProgram/blob/59fd1f4ec1caca2befa90917022c2e21e1f869c9/tutor-system/package.json) | React 18/TypeScript 4.9/CRA, Jest/Testing Library, existing Selenium and Promptfoo scripts. Stay within this stack and keep the implementation dependency-free. |
| [AI behavior design/evaluation skill](https://github.com/linmou/PhishingTrainingProgram/blob/59fd1f4ec1caca2befa90917022c2e21e1f869c9/.agents/skills/ai-behavior-design-eval/SKILL.md) | Separates lightweight design/preparation from formal measured acceptance. This isolated demo uses targeted prototype checks rather than the full lifecycle. If shared production tutor behavior changes, run its existing Promptfoo regression; use the full workflow when this behavior becomes a production tutor-policy change. |

## 3. Claims this prototype can and cannot support

A successful implementation can show that the model generates differentiated roles, the tutor can review/edit a short sequence, delivery preserves approved text and identity, and the learner can continue the fictional discussion.

It does not establish independent agent reasoning, stronger learning outcomes, valid resistance-to-persuasion measurement, correct production database behavior, or reliable multi-client delivery. In particular, hearing the tutor before replying is a different intervention from responding to the misleading participant without help.
