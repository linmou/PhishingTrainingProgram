# TransferLearning refactor — coding-agent plan

Repository: `linmou/PhishingTrainingProgram`
Inspection baseline: `no_sign_up` at `01b09994e76e7309ca70deea569c69d4bd4007b1`.
Status: implementation handoff; no repository changes or test execution performed by this plan.

## Goal and fixed behavior

Refactor the existing transfer subsystem, rather than building a second tutor.

- The shared tutor makes only `tutoring | guard` decisions. Preserve deprecated multi-agent reading/compatibility; adding or removing multi-agent functionality is out of scope.
- TransferLearning maintains learner progress and independently produces assessment messages. An assessment is not a third shared-tutor decision.
- Learning targets come from this room's configured instructional context or tutor entry. Persisted, tutor-approved checklist items are the runtime target source. No implicit built-in target list or template fallback in the transfer path.
- Once a target is fully assessment-eligible, the next AI-generated response must be an assessment. The shared tutor is not invoked for that response. Eligibility includes the existing protection, correction, Guard, and lifecycle blockers; it is not followed by another optional “should we assess?” decision.
- Keep teacher review and explicit send. Mandatory assessment preparation does not mean automatic publication. Preserve two attempts, exact-set grading, private answer keys, learner ownership, feedback/repair sequencing, and server-owned progress.

```text
Transfer room setup
  → tutor generates or enters learning targets
  → tutor approves; targets are persisted

Persisted student message
  → TransferLearning updates learner state

Next AI-response request
  → ensure focus-message analysis is complete
  → assessment eligible: prepare assessment for review; skip shared tutor
  → not eligible: existing shared tutor generates tutoring/Guard
```

Keep `RoomContext`, the existing service/Edge Function, checklist storage, and assessment UI. No new router service, plugin framework, job queue, React provider, curriculum tables, mastery field, or stored eligibility flag. Follow the existing module's formatting and the repository's TypeScript/Jest/React Testing Library conventions.

## 1. Update the living specs and their plans first

Edit the existing packages in place; do not create `106` or a parallel planning hierarchy.

| Existing package | Required revision |
| --- | --- |
| `specs/101-transfer-domain/` | Separate assessment content from tutor decisions; define mandatory next-response assessment and preserve the existing progress/attempt rules. |
| `specs/102-transfer-backend/` | Define room-derived target initialization, continuous evidence processing, assessment-only generation/delivery, and explicit setup/error outcomes. |
| `specs/103-transfer-room-ui/` | Define the missing-target reminder, generation/manual-entry approval flow, and mutually exclusive assessment/shared-tutor response paths. |
| `specs/104-transfer-evaluation/` | Cover evidence classification, mandatory eligibility-to-assessment behavior, dynamic target grounding, and assessment quality. Preserve shared-tutor regression coverage. |

Revise the associated `plan.md`, affected `contracts/`, `data-model.md`, and `tasks.md`. Keep stable requirement IDs where their meaning is unchanged; add or revise only the affected clauses. Update active orchestration ownership/contract references so they no longer direct agents to implement the old architecture.

Reconcile the active T02/T09 descriptions in `tutor-system/claude_docs/ai-behaviors/` and affected BDD scenarios, including the old “eligible but tutoring is also valid” wording. Those descriptions must agree with the revised specs, not act as an alternative authority. Preserve immutable historical evaluation runs and their original hashes; working specs/plans remain editable, with Git recording their history. Add new, unchecked refactor tasks rather than claiming old completion evidence proves the changed implementation.

## 2. Make room learning-target setup work end to end

Primary files: `src/components/ChecklistPanel.tsx`, `src/hooks/useChecklist.ts`, `src/services/checklistService.ts`, `src/services/checklistGenerationContext.ts`, and `src/pages/RoomPagePost.tsx` under `tutor-system/`.

Reuse the existing checklist panel and manual-input/generation components. Show a tutor-visible reminder when the applicable checklist is absent **or contains zero items**:

> Learning targets required. Generate or enter learning targets for this room before using transfer learning.
>
> Generate Learning Targets · Enter Manually

Make the reminder visible from the room even when the checklist panel is collapsed. Do not add another setup page. Restrict generation/approval controls to the tutor; a learner may see a waiting-for-setup notice. Keep target setup permissions separate from the existing read-only transfer-progress controls so the setup action is not disabled merely because this is a transfer room.

Generation uses the room's existing structured configuration/system prompt and generation helpers. Reuse the current editing UI for tutor approval before saving. Insufficient context or an empty generation result prompts configuration editing/manual entry; it must not select `General Scam Indicators`, `SCENARIO_TEMPLATES`, or demo targets automatically. Preserve legacy-room template behavior.

Change transfer initialization from a template name to explicit items using existing field names:

```ts
type LearningTargetInput = Pick<
  ChecklistItem,
  'area_text' | 'item_type' | 'priority'
>;
```

Use the existing `initialize_checklist` operation and learner-scoped initialization helper with `items: LearningTargetInput[]`. The server validates a nonempty list, nonblank text, allowed item types/priorities, and the authorized room/learner scope. It assigns IDs and initializes progress as `pending/none`. Client-supplied progress is not accepted. Reuse `session_checklists` and `checklist_items`; no new target-definition tables. Repeated initialization must not duplicate items, overwrite approved objectives, or reset progress. After saving, refresh the same learner-scoped checklist used by both the panel and TransferLearning.

**Bootstrap detail:** a transfer-enabled room must remain recognizable before its targets exist. The inspected `RoomContext` currently discovers transfer behavior through an existing transfer checklist. Reuse an existing persisted room capability setting if one is available; otherwise add one boolean room setting, defaulting to false and backfilled for rooms with existing transfer checklists. Wire it into the existing room configuration/setup path. This is capability configuration, not another participation mode. Do not infer it from a room title, prompt text, or target availability.

Until setup is complete, keep the room in an explicit setup-required state. Do not run transfer analysis/assessment or silently downgrade it to a normal room. Manual messaging and existing Guard controls remain available. Existing normal rooms are unaffected.

## 3. Separate assessment contracts without replacing the shared tutor

Primary files: `src/types/assessment.ts`, `src/types/index.ts`, `src/services/assessmentValidation.ts`, and `src/services/tutorDecisionContract.ts`.

Replace active assessment use of `TutorDecisionV3` with an assessment-only draft:

```ts
interface TransferAssessmentDraft {
  reason: string;
  target_item_id: string;
  assessment: PrivateAssessment;
}
```

Reuse existing `PrivateAssessment` fields and assessment validation/rendering. The draft has no tutor `decision.mode`, no teaching instruction, and no duplicate `response`; the stem is the assessment content. It is an in-memory review value, not a new persisted draft entity.

Keep the ordinary tutor contract and its parser. Move/extract the assessment-specific validation into the existing assessment validation module and update its callers. Leave `messages.response_mode = 'assessment'` as the stored message discriminator. Preserve existing message rendering and historical multi-agent decoding. Do not globally remove `assessment` from message types or introduce another tutor contract version merely to rename the old one.

## 4. Complete continuous evidence processing and mandatory eligibility

Primary files: `src/services/transferAssessmentService.ts`, `src/services/ecologicalTutorCall.ts`, `src/services/learningProgressTransitions.ts`, `supabase/functions/assessment-api/index.ts`, and one forward migration where required.

Keep `TransferAssessmentService` as the existing file/class implementing the conceptual TransferLearning component; do not wrap it in a second service. Preserve the current application-identity integration and provider configuration. An authentication redesign is out of scope.

### Evidence processing

Make `analyzeMessage()` perform server-side semantic analysis of the persisted learner message against the actual room/learner items. The inspected SQL operation currently returns an empty `applied` result without updating evidence; changing its name alone is insufficient.

Validate returned target IDs and source-message ownership. Apply all supported concept evidence through the existing learning events and progress authority, including initial evidence, contradiction, spontaneous transfer, and valid post-repair evidence. A tutor statement or a newly generated target is not learner evidence. Preserve Guard deferral and replay behavior rather than writing progress while locked.

Keep analysis attached to ordinary learner-message persistence, independent of the teacher's generation click. Explicit assessment answers go only through `processMessage()`; analysis must not grade them a second time. Replays must not duplicate evidence/history or progress transitions. Before preparing a response, wait for or idempotently catch up analysis through the selected focus message, then read the resulting authoritative state. A cross-tab request must not use stale pre-analysis progress. Use existing message/event identities, not a new queue or polling subsystem.

### Eligibility and generation

Derive eligibility from current state; do not persist another eligibility/mastery field. A current, relevant, room-configured target is eligible when it is `partially_covered/basic`, has learner-owned evidence, and no existing blocker applies: an open assessment, required undelivered feedback, unmet repair/new-evidence conditions, or required protection/correction/Guard handling. Verified targets are not routinely reassessed. A repaired failed target needs a different assessment context.

Reuse the existing target-selection policy to choose at most one relevant eligible target. Preserve evidence updates for other targets; do not introduce a ranking framework or hard-coded IDs. Assess higher-priority protection/correction needs within the same learner-analysis path; checking only an already-active Guard room flag misses a newly unsafe learner message. This produces an assessment blocker, not a Guard response or a third tutor decision.

Once fully eligible, assessment generation is mandatory. The question generator receives the selected target and its evidence/context, and produces assessment content only. It cannot choose tutoring/Guard or decline an otherwise eligible assessment. Reuse the existing provider helper and production/evaluation context-building boundary.

Rename the browser method to `prepareAssessment()`. Keep the existing wire operation `prepare_turn` for this bounded refactor, documenting its narrowed meaning; update active callers/tests together. Return an assessment candidate when due and `null` only after a successful determination that no assessment is due. Missing targets, incomplete analysis, provider failure, and invalid output are explicit errors, not `null`.

Populate feedback/repair blockers from real delivered messages and lifecycle state. Replace placeholder `feedback_required: false`/null repair context where it prevents the required sequencing. Recording a successful shared-tutor feedback/repair delivery must make that fact visible to subsequent eligibility checks; generating an unsent suggestion does not satisfy it.

## 5. Wire the existing room flow and assessment editor

Primary files: `src/contexts/RoomContext.tsx`, `src/contexts/transferAssessmentUiAdapter.ts`, `src/components/AssessmentDraftEditor.tsx`, `src/pages/RoomPagePost.tsx`, and the existing reviewed-send backend.

Keep the response switch inside `RoomContext.generateAIResponse()`:

```text
normal room:
    use existing shared-tutor generation

transfer-enabled room:
    require persisted learning targets
    ensure focus-message analysis is complete
    prepareAssessment using current authoritative state

    candidate returned:
        keep candidate in transferDraft
        show existing assessment editor
        return without shared-tutor generation

    explicit no-assessment result:
        use existing shared-tutor generation

    setup/analysis/provider/validation error:
        show existing error/setup UI
        do not silently fall through
```

Retain stable learner, checklist, target, and focus-message IDs throughout preparation/review/send. Do not switch to another learner's latest message while a request is in flight. Preserve the same routing rule for response regeneration; editing or discarding an assessment draft must not mark assessment completed or bypass the requirement on the next request. Keep drafts UI-local; no persisted rejection/regeneration system.

Narrow the editor and adapter to `TransferAssessmentDraft`. Remove transfer branches that produce/send ordinary tutoring or Guard. Shared-tutor responses continue through the existing ordinary reviewed-send flow. Supply read-only current learner progress and assessment feedback/repair context to its existing request builder where needed; do not create a second tutor prompt or let the tutor write progress.

After teacher confirmation, revalidate current target/room/learner eligibility on the server and insert the assessment through the existing delivery transaction. Always stamp `response_mode='assessment'`. A Guard activation or target invalidation during review blocks delivery; an assessment never clears Guard. Keep private keys/explanations server-private and the public assessment DTO unchanged. Preserve current atomicity, idempotency, and two-attempt grading. Use a forward migration for deployed function/signature changes; do not edit archived/applied SQL to simulate a migration.

## 6. Update tests and evaluation, then verify the complete path

Extend the existing focused Jest/React Testing Library, Edge Function, SQL, and Promptfoo suites rather than creating another harness. Remove only assertions tied to the obsolete combined transfer-tutor contract; retain lifecycle, identity, privacy, and legacy regressions. Keep semantic evidence/target-selection evaluation as well as question quality; testing question quality alone does not prove mandatory routing.

| Acceptance case | Required result |
| --- | --- |
| Normal room | Existing tutoring/Guard path; no transfer model call or new setup requirement. |
| Transfer room with absent or zero target items | Visible tutor setup reminder, including collapsed-panel view; no implicit template or legacy downgrade. |
| Room-specific generation/manual entry | Approved items persist for the correct scope; empty output prompts correction; initial state is `pending/none`. |
| Two rooms with different custom targets | Each analysis/question uses its own persisted items; foreign/invented target IDs are rejected. |
| Ordinary learner evidence | Correct supported progress transitions; duplicate processing does not duplicate effects. |
| Evidence analysis pending/failed | Next response does not use stale state or quietly invoke the shared tutor. |
| Fully eligible target | Next preparation returns an assessment; shared tutor called zero times. |
| Eligible target, question generation fails | Error/retry; shared tutor called zero times. |
| Blocker: Guard, required protection/correction, feedback, open question, or repair | No new assessment; existing appropriate tutoring/Guard or answer lifecycle continues. |
| Spontaneous transfer / later contradiction | Spontaneous transfer avoids an unnecessary quiz; contradiction reopens progress under existing rules. |
| Reviewed assessment | Existing review/send UI works; public message is assessment; private data stays private; no room Assessment Mode. |
| Guard activates / target changes during review | Server rejects stale/ineligible delivery without partial effects. |
| Assessment answer | Existing two-attempt outcomes, reload/tab idempotency, and terminal disclosure; no second evidence-analysis grade. |

Include one integrated fixture starting with custom target setup, then genuine learner evidence, eligibility, preparation, review/send, and answer processing. Do not seed `partially_covered/basic` to bypass the evidence-processing step in that test. Verify shared-tutor call counts, not only the final displayed message.

Run the updated focused suites and repository checks from `tutor-system/`:

```bash
CI=true npm test -- --watchAll=false --runInBand
npm run build
```

Run `git diff --check` from the repository root. Use the existing spec quickstarts for Deno, SQL, and evaluation checks against the revised contracts. Run database tests on a disposable local/test database; do not apply migrations, reset data, or deploy to the hosted project as part of this handoff without explicit authorization. Record pre-existing failures separately and do not represent an unrun lane as passed.

### Handoff

Return changed specs/code paths, test commands/results, any remaining failures, and authored-but-unapplied migration details. The completion criterion is the actual path:

**room-approved targets → learner evidence → authoritative state → mandatory assessment when eligible → reviewed assessment message**, with ordinary tutoring/Guard reused whenever no assessment is due.

## Inspected source anchors

All paths below were inspected at the baseline commit above. Additional dependencies must be read by the coding agent before editing.

- `AGENTS.md`: existing project layout, style, and testing conventions.
- `tutor-system/src/types/index.ts`: current room/message types and checklist-independent room configuration gap.
- `tutor-system/src/contexts/RoomContext.tsx`: transfer-checklist discovery and early-return generation branch.
- `tutor-system/src/components/ChecklistPanel.tsx`: collapsed view and existing generation/manual-entry empty state.
- `tutor-system/src/hooks/useChecklist.ts`: structured-room-config generation and template fallback.
- `tutor-system/supabase/functions/assessment-api/index.ts`: six-operation dispatch, template-based initialization, and application-identity path.
- `tutor-system/supabase/migrations/20260922000000_transfer_assessment_server_authority.sql`: eligible-item SQL, placeholder feedback/repair context, and no-op learner-analysis RPC.
