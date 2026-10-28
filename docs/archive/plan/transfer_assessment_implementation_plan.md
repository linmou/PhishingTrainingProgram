# Transfer assessment: detailed coding-agent implementation plan

**Repository:** `linmou/PhishingTrainingProgram`  
**Inspected branch:** `no_sign_up`  
**Inspected commit:** `1eeedf8e157b8bcea69b914add0a284a1e603395`  
**Plan revision:** 2 — September 9, 2026  
**Status:** Implementation handoff, not implemented or deployed. No project tests, database migrations, live evaluations, or browser acceptance tests were executed while preparing this package.

This document replaces the earlier implementation plan as the coding-agent handoff. It incorporates the conversation's decisions and supplies explicit implementation defaults where the earlier plan left choices open. `v2` here is a plan revision; proposed model contract `v3` below is not an already deployed contract or an experimental behavior-spec version.

## Reading and execution order

Read §§1–5 before editing. Implement the work packages in §17 in dependency order. The schemas, tables, and pseudocode specify observable contracts; code samples are design material, not tested production code. Proposed files and APIs are explicitly marked NEW. Existing paths and observations refer to the pinned commit, with sources in §21.

Path shorthand: `src/`, `supabase/`, `scripts/`, and `features/` refer to directories under `tutor-system/`; `.agents/` and `evals/` are repository-root paths. Fully prefixed paths are already relative to the repository root.

Companion files:
- `tutor_response_v3.schema.json`: structural model-output contract; semantic/runtime checks are additional.
- `transfer_assessment_golden_cases.json`: normative deterministic fixtures for transitions, option normalization, grading, and contract examples. These are authored test inputs, not evaluation results or independent holdouts.
- `AGENT_HANDOFF.md`: execution instructions and completion-report requirements.

## 1. Authority, scope, and non-goals

### 1.1 Settled user decisions — do not redesign these

| ID | Decision |
|---|---|
| U01 | Correct answers, explanations, appropriate actions, self-corrections, and acknowledgments can all trigger assessment. Do not require strong prior proof of understanding. |
| U02 | Test medium transfer: retain the underlying concept but change the meaningful situation. A cosmetic brand substitution alone is insufficient. |
| U03 | The AI may generate short hypothetical scenarios; they must be accurate, self-contained, and not depend on invented organizational facts. |
| U04 | Retain the existing `status` and `understanding_level` progress fields. Do not add `transfer_state`, `verification_status`, or another parallel mastery state. |
| U05 | Ground `basic` in an initial understanding signal and `good` in successful transfer. New-policy outputs stop using `excellent`. |
| U06 | Do not routinely reassess a transfer-verified concept. Later genuinely contradictory evidence can reopen it. |
| U07 | Required protection/correction precedes transfer assessment; assessment precedes opening a new learning target. |
| U08 | Add turn-level `assessment` and instructional category `transfer_assess`. Assessment is not a room mode. |
| U09 | Replace participation-only `instruction: null` with `instruction: "guard"` in new model outputs. |
| U10 | Mark all newly signaled concepts, but assess one at a time; prioritize safety relevance and current relevance. |
| U11 | Valid spontaneous medium transfer can establish verification without an explicit quiz. |
| U12 | After failure, teach/correct, wait for a new learner signal, then use a different transfer context. A subsequent acknowledgment can be that signal. |
| U13 | The assessment question occupies one tutor turn. The response to its answer is tutoring or Guard, not an automatic second assessment. |
| U14 | A correct selection on a multiple-choice/multiple-answer question is sufficient to pass. No explanation or confidence report is required. |
| U15 | Preserve the existing human-review workflow. A generated but unsent AI suggestion is not a delivered assessment. |

### 1.2 Implementation defaults adopted for this handoff

These are explicit engineering defaults, not statements that the user separately approved every storage or UI detail. Implement them unless later instructions replace them; do not reopen the entire product discussion.

| ID | Default |
|---|---|
| D01 | Four options, displayed in fixed label order A–D. `single` has one correct option; `multiple` has two or three. Use one correct option with `single`, not a disguised multiple-answer question. |
| D02 | Multiple-answer grading uses exact-set equality; no partial-credit promotion. Deduplicate repeated labels and ignore selection order. |
| D03 | Use the existing chat for learner answers. Add a structured teacher-only assessment editor, not a separate learner quiz application. |
| D04 | One outstanding delivered assessment per `(room_id, student_id)`. Never send a second while the first is unresolved. |
| D05 | An explicit but uncertain selection such as `B?` may be graded. An alternative such as `B or D` is ambiguous. Do not impose a confidence threshold. |
| D06 | A recognized correct selection controls the grade even when the same message contains an unnecessary explanation. Do not let a separate classifier overturn that grade using the same message. |
| D07 | Assessment rendering is at most 80 word-like segments including labels/instructions/options; the stem is at most two sentences. Ordinary response policy remains unchanged. |
| D08 | Keep a question/key interaction record separate from learner progress. Storage for question lifecycle, identity, policy version, and idempotency does not introduce another mastery variable. |
| D09 | Bind every new-policy checklist to one explicit student. Existing room-shared checklists remain legacy; never certify other students from one student's answer. |
| D10 | Apply the new policy to newly created, explicitly enabled checklists. Do not reinterpret historical `covered/good/excellent` as transfer verification. |
| D11 | First valid submitted selection resolves a question. Later edits or additional guesses cannot earn a second grade on that question. |
| D12 | After grading, use a tutoring feedback turn before any new assessment. Successful-result feedback may use target-local `consolidation` even when other objectives remain. It does not imply session completion. |
| D13 | Preserve an unresolved question through format-only clarification. Content help that could coach the solution closes it as assisted, without a failing grade; use a fresh context after subsequent learner evidence. |
| D14 | Rejection/ignoring suppresses automatic re-proposal for the same item and triggering message. The teacher can explicitly regenerate, and a later new learner message can create new eligibility. |
| D15 | No learner-selected option is sent to an LLM for exact-key grading. Models judge conceptual evidence and question quality, not set equality. |
| D16 | Authentication and server-side answer-key protection are release gates. Do not silently implement a new sign-in product or pretend local role selection provides trustworthy authorization. |

### 1.3 Non-goals

Do not add a third progress state, a room-level Assessment Mode, a new assessment avatar, time limits, points/leaderboards, adaptive psychometric scoring, a fine-tuned model, a question-bank dependency, automatic outward tutor messages, or cross-room concept equivalence. Keep verification local to a student's checklist item. Do not overhaul unrelated architecture or edit frozen historical evaluation records.

## 2. Repository facts and changes they require

These are verified source observations, not claims about the hosted database's applied migrations.

| Observation at the pinned revision | Required consequence |
|---|---|
| `ChecklistItem` has four status values and optional four-level understanding metadata. [R1] | Add a narrowed new-policy type while retaining a legacy read type. |
| The detector promotes `good/excellent` immediately and can promote repeated `basic` evidence. [R2] | Replace these rules for new-policy checklists; do not merely append a transfer prompt. |
| `applyChecklistUpdates` writes state, evidence, and history separately and records placeholder old values in one path. [R3] | Introduce an atomic transition operation with actual before/after values. |
| `updateItemStatus` can update status alone. [R3] | New-policy updates must derive and write the pair together. |
| `RoomContext.sendMessage` inserts ordinary learner messages but the inspected path does not invoke the checklist detector. Its real-time handler appends messages to local state. [R4] | Wire ingestion explicitly; do not claim a service's existence proves automatic tracking. |
| `generateAIResponse` selects the latest learner line and passes its text rather than a full stable learner/message identity to suggestion generation. [R4] | Pass focus message ID, focus student ID, and checklist ID. Resolve them against stored messages. |
| `TutorResponseMode` serves room, message, raw/final decision, and review state consumers. [R5,R6] | Split room participation from tutor turn types and database enums. |
| `sendReviewedTutorResponse` calls a single RPC whose final mode is written to the room. [R6,R7] | Add a versioned send RPC that persists assessment on the message but maps room mode to tutoring. |
| `TutorSuggestionService.generateSuggestion` caps completion at `Math.min(config.max_tokens, 120)`. [R8] | Explicitly replace this cap for v3 generation and mirror it in evaluations. Otherwise the richer JSON is liable to truncate. |
| The active prompt and T02 favor progression over re-testing, and consolidation previously assumes no useful unmet target. [R9,R10] | Amend the transfer exception and mandatory feedback exception in specifications, prompt, and rubrics together. |
| Checklist schema is room-scoped and has no student owner column. [R11] | Add identity metadata to new-policy checklists and owner-scoped reads. |
| `AuthContext` derives user IDs from names/roles and restores locally stored profiles. [R12] | Do not treat `user.id` or `current_role` from the request as authenticated authorization. |
| `AISuggestionBox` currently receives text and copy/regenerate controls. [R13] | Carry structured assessment review data rather than lose the key/target during text copying. |
| Product and Promptfoo share `ecologicalTutorCall.ts`. [R14] | Extend this shared contract rather than create evaluation-only context. |

### 2.1 Required implementation preflight

Record `git rev-parse HEAD` and `git status --short`. Read root/project agent instructions and the repository's AI behavior skill. Compare the symbols in this plan with the current checkout. Preserve unrelated changes. Use the next available forward migration identifier rather than assume a hard-coded migration number is free.

Inspect the actual local schema, enabled RLS policies, function grants, and realtime publication before migration tests. The repository's old schema files are evidence of intended structure, not proof of deployed structure. Record discrepancies as preflight findings.

## 3. Domain types and the single progress authority

### 3.1 Type definitions

NEW `src/types/learningProgress.ts`:

```ts
export type ProgressPolicyVersion = 'legacy_v1' | 'transfer_v1';
export type TransferUnderstandingLevel = 'none' | 'basic' | 'good';
export type TransferProgress =
  | { status: 'pending'; understanding_level: 'none' }
  | { status: 'partially_covered'; understanding_level: 'basic' }
  | { status: 'needs_review'; understanding_level: 'basic' }
  | { status: 'covered'; understanding_level: 'good' };

export const LEVEL_BY_STATUS = {
  pending: 'none',
  partially_covered: 'basic',
  needs_review: 'basic',
  covered: 'good',
} as const;
```

Do not expose independent controls for status and understanding in transfer-enabled checklists. The level is derived from status. Persist both existing columns for compatibility, but validate the pair at the database boundary. Legacy readers still allow `excellent` and optional metadata.

### 3.2 Meanings

| Pair | Meaning | Does not mean |
|---|---|---|
| `pending/none` | No positive evidence recorded under this policy. | The person knows nothing. |
| `partially_covered/basic` | A positive signal has made the item eligible for verification. | The signal is already validated; an assessment is already delivered. |
| `needs_review/basic` | Transfer failed or conflicting evidence reopened the item; repair is required. | The learner is disruptive or all prior learning is erased. |
| `covered/good` | Valid medium-transfer evidence satisfies this product's verification criterion. | Permanent mastery, mastery of the whole checklist, or statistically established generalization. |

### 3.3 Event vocabulary

NEW `src/services/learningProgressTransitions.ts` exports a pure reducer. It does not call an LLM or a database.

```ts
export type LearningEventKind =
  | 'initial_signal'
  | 'post_repair_signal'
  | 'spontaneous_transfer'
  | 'contradiction'
  | 'assessment_pass'
  | 'assessment_fail'
  | 'no_change';

export interface LearningEvent {
  event_id: string;                 // application-generated, stable on retry
  room_id: string;
  student_id: string;
  checklist_id: string;
  item_id: string;
  source_message_id: string | null; // null only for tutor-attested external evidence
  kind: LearningEventKind;
  evidence_text: string;            // excerpt or concise description of the observation
  source_evidence_message_ids: string[];
  assessment_id?: string;
  repair_message_id?: string;
  classified_by: 'model' | 'deterministic_grader' | 'tutor';
}

export type TransitionResult =
  | { disposition: 'apply'; next: TransferProgress }
  | { disposition: 'no_change'; next: TransferProgress }
  | { disposition: 'reject'; error_code: string };
```

Identity, valid question delivery, causal evidence, and stale-snapshot checks run before the reducer. The reducer then applies the following complete table. `same` means unchanged; `reject` means no write and a surfaced transition error, not a failing learner grade.

| Event | pending/none | partially_covered/basic | needs_review/basic | covered/good |
|---|---|---|---|---|
| initial_signal | partially_covered/basic | same | same | same |
| post_repair_signal | same | same | partially_covered/basic | same |
| spontaneous_transfer | covered/good | covered/good | covered/good | same |
| contradiction | same | needs_review/basic | same | needs_review/basic |
| assessment_pass | reject | covered/good | reject | reject |
| assessment_fail | reject | needs_review/basic | reject | reject |
| no_change | same | same | same | same |

An assessment result for an already-resolved question is handled as an idempotent replay before this table. A newly presented, stale assessment is not allowed to change a now-covered item.

### 3.4 Event guards

**Initial signal:** map a bare acknowledgment only to the most recent clearly identified teaching target in the learner's own exchange. Do not apply it to every inventory item. If the target is ambiguous, ask a focused clarification; do not fabricate a target ID.

**Post-repair signal:** require a delivered tutor message addressing this item after its most recent failure/contradiction, followed by the learner's new positive signal. The tutor's draft and the tutor's own explanation do not count as a learner signal. A duplicate of the original trigger is not new evidence. A manual teacher explanation may count as repair when its target is recorded/confirmed; do not require that it be AI-authored.

**Spontaneous transfer:** require the model or tutor to identify the same concept, original learning context, changed context, and actual learner application, with message references. It cannot be inferred from a claim such as “I could apply this elsewhere.” The normalizer routes recognized assessment replies to the grader first; they must not also become spontaneous-transfer events.

**Contradiction:** require later learner evidence conflicting with the concept, not silence, hesitation, a request to repeat, or lack of an explanation. For the assessment's target, exclude the same submitted message from competing conceptual state updates. The grade wins for that message. A genuinely later message can reopen the item.

**Assessment pass/fail:** require a valid delivered question, matching learner/room/item, a recognized submission after delivery, an unassisted immutable key, unresolved first-attempt status, and a current eligible item snapshot. A model cannot emit these events directly.

### 3.5 Repair and readiness without an extra progress field

Find repair and triggering evidence from immutable message/event records. Keep an unresolved question in the assessment interaction table. Do not overload `last_addressed` to mean “question awaiting answer,” and do not add `assessment_pending` to the checklist state enum.

A corrected explanation from the tutor leaves `needs_review/basic` unchanged. Only a subsequent positive learner signal moves it to `partially_covered/basic`. An acknowledgment after a format-only instruction does not count as conceptual repair.

## 4. Turn mode, message mode, and room state

### 4.1 Exact types and consumer split

```ts
export type RoomParticipationMode = 'tutoring' | 'guard';
export type TutorTurnMode = RoomParticipationMode | 'assessment';
export type TeachingInstruction =
  | 'protective_instruction' | 'correction' | 'scaffolding'
  | 'explanation' | 'consolidation';
export type TutorInstruction = TeachingInstruction | 'transfer_assess' | 'guard';
```

| Consumer | Type |
|---|---|
| `Room.active_response_mode`, `setRoomResponseMode`, manual room toggle, Guard progression lock | `RoomParticipationMode` |
| `Message.response_mode`, raw/final suggestion modes, teacher's final-turn control | `TutorTurnMode` |
| Model `decision.mode` | `TutorTurnMode` |
| Prior participation context | `RoomParticipationMode \| 'unknown'` |
| Prior tutor-turn context, when useful | Separate `TutorTurnMode`; never inferred to be the room mode |

Valid new-output combinations:
- tutoring + one of the five teaching instructions; no assessment payload.
- assessment + transfer_assess + one known target item + valid assessment payload.
- guard + guard for participation-only intervention; target null and no assessment payload.
- guard + a teaching instruction when content instruction is actually present; no assessment payload.

Reject null/missing instruction, assessment+explanation, tutoring+transfer_assess, and guard+transfer_assess. `assessment: null` on nonassessment responses is allowed; the ban is on null **instructions**.

### 4.2 Reviewed send and Guard recovery

Map the reviewed final turn to a room participation state:

```text
final_turn_mode == guard      => room mode guard
final_turn_mode == tutoring   => room mode tutoring
final_turn_mode == assessment => room mode tutoring
```

This mapping is applied only in the authorized reviewed-send transaction, not when a draft is generated. Never cast `assessment` into the existing room enum.

If the room is already Guard, a fresh assessment cannot be used as an implicit way around the progression lock. The default first recovery response is a reviewed tutoring response. It sets the room back to tutoring and allows deferred evidence to be processed; a subsequent eligible response can assess. Generating any suggestion alone changes no room state.

Wrong answers do not cause Guard. Protection can still be necessary in either participation mode. Preserve the existing semantic participation criteria and human override authority.

### 4.3 Exact one-turn lifecycle

1. A learner signal makes an item eligible.
2. A teacher sends one reviewed assessment question, tagged `assessment/transfer_assess`.
3. The learner submits a selection.
4. The server grades and commits the state/evidence atomically when progression is permitted.
5. The next generated tutor response is feedback in tutoring, or Guard/protection if independently required. It contains no new assessment payload.
6. A later learner contribution can make the next pending item schedulable.

The room stays tutoring throughout the ordinary exchange. The unanswered question remains an interaction record, not a persistent mode. The feedback-turn obligation survives reloads; derive it from a resolved attempt without a linked delivered feedback message. An unsent feedback suggestion does not discharge it.

**Successful feedback:** normally tutoring/consolidation, target-local, e.g. “Correct. A familiar sender name alone is not proof of who sent a message.” This is an explicit new exception to the old global-only consolidation rule.

**Failed feedback:** tutoring/correction with the accurate solution and a concise targeted explanation/safe action. Do not infer why the learner chose a distractor unless their text supports it.

**Format-only clarification:** tutoring/scaffolding with neutral selection instructions. Do not count it as a new assessment turn or as repair of the concept.

## 5. Question generation, validation, and option grading

### 5.1 Private model response contract

The schema file is the structural authority. Runtime validation additionally enforces serialized `reason` first, word/sentence bounds, item membership, exact label order, and consistency with supplied context.

```json
{
  "reason": "The learner acknowledged the identity-verification principle in the account-alert example; this item is unverified.",
  "decision": {
    "mode": "assessment",
    "instruction": "transfer_assess",
    "target_item_id": "11111111-1111-4111-8111-111111111111"
  },
  "response": "Imagine a game teammate sends a prize link from their familiar account. Which conclusion is justified?",
  "assessment": {
    "selection_type": "single",
    "options": [
      {"id":"A","text":"A familiar account proves the link is safe"},
      {"id":"B","text":"The account could have been compromised"},
      {"id":"C","text":"Every prize message is necessarily a scam"},
      {"id":"D","text":"Opening the link proves the sender's identity"}
    ],
    "correct_option_ids": ["B"],
    "transfer_basis": {
      "concept_rule": "Familiar displayed identity is not sufficient authentication.",
      "source_context": "An account-warning email using a familiar organization name.",
      "changed_context": "A prize link from a known game teammate's account.",
      "source_evidence_message_ids": ["22222222-2222-4222-8222-222222222222"]
    }
  }
}
```

The example IDs are fixture values, not real repository record IDs. In production the model may only choose IDs provided in context. The application assigns draft, question, version, and idempotency IDs.

For ordinary turns, require `assessment: null`. Require `decision.target_item_id` to be either a known item ID or null. It must be non-null for assessment. Keep `reason` separate from learner text and limit it to 40 word-like segments of observable evidence/purpose, not hidden deliberation.

The renderer, not the model, appends the selection instruction. This prevents contradictory “choose one/select all” wording:

```text
{response}
Choose one.
A. {option A}
B. {option B}
C. {option C}
D. {option D}
```

For multiple answers, render `Select all that apply.` instead. Store and show exactly this final rendered text. Do not embed selection instructions, options, keys, or explanations redundantly inside the stem.

### 5.2 Structural/runtime validation

Before displaying a draft as ready to send:
1. Parse the v3 JSON and enforce mode/instruction compatibility.
2. Require a target in the current learner's active checklist and approved eligibility set.
3. Require exactly A, B, C, D in this order, unique nonblank option texts after normalized whitespace/case comparison.
4. Require one key ID for single, two or three for multiple; no duplicates or nonexistent labels.
5. Require a nonblank explicitly hypothetical stem and a concise transfer basis referencing real source messages. “Imagine” is an example, not a mandatory keyword.
6. Enforce total rendered text ≤80 word-like segments; stem ≤2 sentence segments; reason ≤40 words. Normalize whitespace and use the same `Intl.Segmenter('en', ...)` counting behavior as the current response-length checker. [R15]
7. Do not trim an overlong question or truncate options to make it pass. Regenerate or surface a validation error.
8. Preserve ordinary response behavior: active prompt target ≤35 words/2 sentences and existing canonical supporting limit ≤50 words/3 sentences. Do not silently change those unrelated bounds.

Schema validation cannot establish that the key is substantively correct or the context is real medium transfer. The teacher reviews those properties before sending; calibrated semantic evaluation tests the generator independently. Store the teacher's final confirmation and question hash. Do not advertise a model-generated key as independently validated merely because JSON is valid.

### 5.3 Semantic question requirements

The changed situation must require applying the same rule beyond the source example. Change the scenario's situation, relationship, channel, task, or representation in a meaningful way; do not enforce a superficial numeric count of changes. Preserve the principle being tested, not just phishing-related vocabulary.

Use plausible distractors tied to that concept. Prohibit answer-revealing stems, irrelevant trivia, unjustified institutional claims, “all/none of the above,” duplicate/overlapping answers, impossible requirements, and questions that test a different concept. Do not preface an assessment with the solution. A correct response need not include reasoning.

Do not runtime-shuffle options after key validation. The model can vary key positions across generated items; any explicit later reordering must update, revalidate, and refreeze the key before delivery.

### 5.4 Exact normalization contract

NEW `src/services/assessmentAnswerParser.ts`:

```ts
export type ParsedSelection =
  | { kind: 'selection'; option_ids: Array<'A'|'B'|'C'|'D'> }
  | { kind: 'clarification_required'; code: string }
  | { kind: 'not_selection' };
```

Algorithm:
1. Normalize Unicode with NFKC; trim; normalize full-width/ideographic commas to commas. Matching is case-insensitive.
2. Optionally remove one explicit prefix: `answer:`, `my answer is`, `I choose`, `I select`, `I think`, or `maybe` (case-insensitive). Tentativeness does not disqualify an otherwise explicit choice.
3. Split off optional explanation beginning with `because` as a separate word, an em dash, or a newline **after** an explicit completed selection. Never scan the explanation for option letters.
4. Accept one standalone label, or labels separated by comma, semicolon, `and`, `&`, or `+`. Trailing `.`, `!`, or `?` may follow the selection.
5. Deduplicate, sort A–D, and validate cardinality: single requires exactly one distinct label; multiple allows any nonempty subset for grading, including an incomplete or overinclusive set.
6. Reject alternatives (`or`, `/`), negation (`not B`), incomplete separators (`B and`), nonexistent labels, numeric references, and arbitrary prose as ambiguous/invalid rather than guessing.
7. Unseparated letters such as `BD` are not accepted in v1; ask for comma-separated labels. Do not accidentally read the word “bad” as B,A,D.
8. A complete normalized answer exactly equal to one unique option text may map to that option. Do not use semantic similarity to turn arbitrary prose into a selection.
9. Empty input is not a submission. A clear content question is `not_selection` and routes to clarification/help, not failure.

The companion fixtures disambiguate these rules. Additional formats can be supported later only by adding explicit tests; never use unanchored regex extraction of every A–D letter in a message.

### 5.5 Deterministic grading

NEW `src/services/assessmentGrading.ts`:

```ts
export function gradeSelection(
  selected: ReadonlyArray<'A'|'B'|'C'|'D'>,
  key: ReadonlyArray<'A'|'B'|'C'|'D'>
): 'pass' | 'fail';
```

After normalization, return pass exactly when the selected set equals the frozen key. Incomplete sets and extra incorrect selections fail. This function does not inspect explanations, confidence, or model scores.

For key `{B,D}`, `D,B`, `B and D`, and `B,B,D` pass; `B`, `B,C,D`, and `A,B,C,D` fail. `B or D` is not graded. On a single-answer item, `A,B` requires selection-format clarification, not a fabricated single choice.

A correct selection plus an unsolicited inaccurate explanation still passes this submitted item (D06). The tutor may address that explanation, but the conceptual classifier cannot immediately revoke this pass from the same message. Later independent contradictory evidence follows the normal reopening rule.

### 5.6 Assistance, retries, and defective items

An answer resolves the question once. Wrong-answer feedback may reveal the key; repeating it cannot pass the old question. Any retry requires repair, a later positive learner signal, and a different medium-transfer context.

Format-only help can keep a question open using neutral wording such as “Reply with the letters you choose, separated by commas.” Never use an example selection that inadvertently leaks the key.

For content help or an answer-revealing teacher intervention before submission, close the question as `cancelled` with reason `assisted`. Do not change progress solely for cancellation. Preserve help in the conversation; after new learner evidence, issue a different context. A genuine misconception in the help request may independently require `needs_review`.

A malformed/ambiguous question or incorrect key is an item defect, not a learner failure. Before grading: invalidate it without changing progress. After grading: follow the evidence-reconciliation operation in §9.6; do not silently overwrite the key or historical grade.

## 6. Evidence classification and tutor context

### 6.1 Reuse the detector, change its responsibility

For `transfer_v1`, replace the detector's subjective `basic/good/excellent` output with classified evidence events. Keep the old parser only on an explicitly selected legacy path. The model must not directly assign a new progress pair.

The new private detector output has this shape:

```ts
interface EvidenceClassification {
  observations: Array<{
    item_id: string;
    kind: 'initial_signal' | 'post_repair_signal' |
          'spontaneous_transfer' | 'contradiction';
    source_message_id: string;
    supporting_message_ids: string[];
    evidence_text: string;
    explanation: string; // concise observable rationale, not hidden reasoning
    transfer_basis?: {
      concept_rule: string;
      original_context_message_ids: string[];
      changed_context: string;
    };
    repair_message_id?: string;
  }>;
}
```

Validate every referenced item and message against the actual request snapshot. Do not invent missing evidence, accept an assessment pass/fail from this model, or let a room's quoted fictional dialogue certify its real participant.

Include all relevant items, including `needs_review` and `covered`, so repair and regression can be recognized. Do not filter exclusively to pending/partially-covered items. Acknowledgment detection is semantic and broad; it is not a keyword checklist or fixed confidence threshold.

A recognized option-only answer is not a general acknowledgment for other checklist targets; classify additional concepts only when additional learner content actually supports them.

For an item, keep at most one effective observation per new learner message. Contradiction takes precedence over initial signal when both concern the same current evidence. A spontaneous-transfer claim with an unresolved contradiction about the same rule is not valid verification. Preserve competing raw observations for review rather than arbitrarily accepting the most favorable one.

Classify only the newly ingested learner message; history supports interpretation and causal references. Do not repeatedly reclassify the entire old dialogue as new evidence. When processing a recognized assessment answer, exclude that question's target from this classifier for this message. Other concepts can still receive evidence, but must not displace the required feedback turn.

### 6.2 Structured input to the tutor generator

Extend `EcologicalCaseVars` and generation options with:

```ts
interface TransferTurnContext {
  progress_policy_version: 'legacy_v1' | 'transfer_v1';
  focus_student_id: string;
  focus_student_message_id: string;
  checklist_id: string | null;
  prior_participation_mode: 'tutoring' | 'guard' | 'unknown';
  checklist_items: Array<{
    id: string;
    area_text: string;
    priority: 'critical' | 'important' | 'optional';
    status: 'pending'|'partially_covered'|'needs_review'|'covered';
    understanding_level: 'none'|'basic'|'good';
    relevant_evidence_message_ids: string[];
    repair_message_id: string | null;
  }>;
  unresolved_assessment: PublicAssessment | null;
  assessment_result_for_feedback: PrivateFeedbackContext | null;
  eligible_assessment_item_ids: string[];
  feedback_required: boolean;
  progress_snapshot_hash: string;
}
```

Use stable IDs in both product and fixtures. Include relevant source/repair/assessment messages even if older than the recent chat window. Do not trust history truncation as the memory of verification. Do not pass judge expected labels, scoring rubrics, holdout labels, or test-only coverage sets into the target model.

`PrivateFeedbackContext` can include a resolved question's key for the tutor to explain after submission. Never feed unrelated outstanding keys into another learner's context. `PublicAssessment` excludes the key and supervision rationale.

### 6.3 Scheduling and action authority

The model retains semantic responsibility for engagement, safety, misconceptions, and appropriate instructional language. Deterministic scheduling supplies eligible item IDs and enforces structural/state constraints. Do not silently change a raw model decision after generation to make it appear correct.

Response priority for productive participation:

```text
required protective instruction
> required misconception correction
> feedback/clarification for the current assessment exchange
> one eligible transfer assessment
> a new unmet learning target
> consolidation
```

Guard is an independent participation decision. A safety duty is not erased by Guard; a mistaken answer is not obstruction.

Candidate ordering: eligible `partially_covered/basic` items without an outstanding question or same-trigger suppression. After assisted cancellation, require a newly recorded positive learner event after the help message before the item is eligible again, even if its stored pair never changed. Administrative cancellation suppresses the old trigger unless the teacher explicitly requests a fresh draft; assistance never permits reuse of the disclosed question. Derive these boundaries from interaction/event records, not a new progress column. Sort by priority (`critical`, `important`, `optional`), then relevance to the latest learner exchange as classified by the model, then oldest readiness event, then stable item ID. The model may choose a different relevant item only with an evidence-grounded explanation; evaluate semantic target choice rather than hard-code keyword relevance. Persist all initial signals even when only one item is selected.

If the just-answered assessment still requires feedback, prohibit a fresh assessment payload. Use target-local feedback, not a claim that all objectives are complete. If an unresolved question needs content help, follow D13 rather than starting another question.

## 7. Model budgets, retries, and prompt changes

### 7.1 Explicit v3 generation settings

Introduce versioned settings rather than silently persisting overrides into a room's historical config:

| Setting | v3 implementation default |
|---|---|
| Tutor response maximum output tokens | 1,200, for the whole v3 JSON; not the 80-word learner limit |
| Evidence-classifier maximum output tokens | 4,096; errors/truncation must surface, not become an empty-evidence pass |
| Model identity/provider | Reuse the active project model/provider; no model replacement in this feature |
| Tutor temperature/provider options | Preserve configured values; record the effective values |
| Evidence classifier temperature | 0.1, matching the inspected detector's intent |
| Format/schema repair | At most one automatic repair retry: two attempts total |
| Automatic semantic regeneration | None beyond the bounded invalid-draft retry; teacher-requested regeneration is explicit and separately recorded |

Apply the 1,200-token budget in the actual `TutorSuggestionService` request builder and in the evaluation target adapter. The existing 120-token cap must not survive on the v3 path. Inspect truncation/provider finish reasons; never treat truncated JSON as a learner failure. Preserve both invalid attempts and the retry outcome privately.

Reject unsupported model fields and invalid IDs. Do not infer missing `mode`, `instruction`, or answer keys from prose. A provider outage leaves the teacher able to teach manually; it does not auto-pass, auto-fail, or create a dummy assessment.

### 7.2 Specification-first prompt edits

Update the canonical specification before the active prompt. Amend at least:
- **T02:** four state pairs, permissible evidence, no repeated-basic shortcut, regression, and target-local feedback exception.
- **T09 (new):** broad eligibility trigger, medium-transfer multiple choice, delivery, pass/fail/ambiguity handling, no retest, and one-turn lifecycle.
- **T01:** preserve protection and correction priority during assessment exchanges; do not invent a misconception merely from a missing explanation.
- **T03:** acknowledge an initial signal without calling it verified; make post-pass praise proportionate to the one concept.
- **T08:** assessment rendering's explicit 80-word/two-sentence-stem alternative; all learner-visible options are counted.
- **G01–G03 and response contract:** distinguish participation state from turn mode and replace new participation-only null instructions with `guard`.

Ground the new learning behavior in existing P2, constrained by accuracy, dignity, identity honesty, and truthful supervision. Record the user's actual approved priorities. Do not adopt a new constitutional principle merely because a prompt/evaluation would be easier.

In the checklist-aware prompt, replace “good/excellent” inference and any `covered = mastered forever` phrasing for new-policy records. Do not append `[PROGRESS: ...]` markers to a new structured learner response. Structured evidence owns tracking; existing markers remain legacy-only.

## 8. Persistence design: exact responsibilities

All names in this section are proposed NEW schema or extensions. Use forward migrations. No third progress/mastery field is added to a checklist item.

### 8.1 Extend existing tables

| Table | New/changed metadata | Invariants |
|---|---|---|
| `session_checklists` | `student_id uuid NULL` FK users; `progress_policy_version text NOT NULL DEFAULT 'legacy_v1'` | `transfer_v1` requires student_id. Existing rows remain legacy; don't infer a historical owner. |
| `checklist_items` | No new mastery fields. Existing status/level remain. | Parent policy determines validation; `transfer_v1` permits only the four pairs. Preserve legacy `excellent` values. |
| `messages` | Convert `response_mode` to a NEW `tutor_turn_mode` enum. | Students normally have null response mode; assessment is a tutor-turn label only. |
| `ai_suggestion_feedback` | Raw/final mode columns use `tutor_turn_mode`; add `contract_version`, `final_instruction`, and nullable `assessment_id` | Raw and final decisions remain distinguishable. New v3 instructions cannot be null. Legacy nulls are not reconstructed. No answer key or private draft JSON here. |
| `checklist_updates` | Add nullable `event_id uuid` and `assessment_id uuid` links | Existing rows unchanged. New applied events require the actual before/after pair and evidence ID. |
| `coverage_evidence` | Add nullable `event_id uuid` and `assessment_id uuid` links | Store public-safe evidence, not unresolved answer keys or private supervision text. |

Create a partial unique index for one active `transfer_v1` checklist per `(room_id, student_id)`. Legacy room-shared records do not satisfy that ownership invariant and are queried separately. Deactivating/resetting a student's checklist affects only that student's record.

The first-release UI enables automatic assessment in 1:1 rooms. If several real students are present, show an explicit unsupported-scope notice rather than silently choose one or share progress. The owner-scoped schema prevents future multi-student support from requiring a new mastery model.

### 8.2 NEW public assessment-question table

`public.assessment_questions` — only learner-safe fields:

| Column | Type/constraint |
|---|---|
| `id` | uuid PK, application/server generated |
| `room_id`, `student_id`, `checklist_id`, `item_id` | non-null UUID FKs; all must refer to the same authorized scope |
| `tutor_message_id` | UUID FK messages, unique, non-null after delivery |
| `source_student_message_id` | UUID FK messages, non-null |
| `selection_type` | text: single/multiple |
| `stem`, `rendered_text` | nonblank text |
| `options` | JSONB public array A–D, validated by the service and DB function |
| `public_payload_hash` | text hash of canonical public payload |
| `lifecycle` | delivered/answered/cancelled/invalidated |
| `answer_message_id` | nullable UUID FK messages |
| `selected_option_ids` | nullable text[]; assigned only on recognized valid submission |
| `result` | nullable pass/fail; never an answer key |
| `closed_reason` | nullable controlled reason, e.g. assisted, invalid_item, teacher_cancelled, superseded_checklist |
| `feedback_message_id` | nullable UUID FK messages |
| `created_at`, `answered_at`, `closed_at` | timestamps |

Partial unique index: `(room_id, student_id)` where lifecycle=`delivered`. This enforces one unresolved question independent of number of teacher tabs. Attempt lifecycle is interaction bookkeeping, not a new learner-progress field.

### 8.3 NEW private tables

Place these in a schema not exposed to anonymous Data API clients or realtime. Revoke direct browser grants. Do not rely on a hidden UI element to protect them.

**`private.assessment_drafts`**: stores every v3 tutor draft, including nonassessment/Guard drafts; item_id is nullable outside assessment. UUID id; room/student/checklist/item/focus-message IDs; raw private model output; current reviewed payload; revision integer; raw/final hashes; reviewed-by verified principal; review confirmation time; status draft/rejected/ignored/sent/superseded; created time. This is where raw answer keys and transfer rationales belong before delivery.

**`private.assessment_question_keys`**: question_id PK/FK; immutable correct_option_ids; immutable private payload/hash; source/transfer basis; teacher confirmation identity/time; draft_id/revision; source item `updated_at` snapshot; created_at. Enforce a unique `(draft_id, draft_revision)` delivery association in addition to the question PK. No direct mutation after delivery. A defective key invalidates the attempt instead of being silently overwritten.

**`private.learning_event_inbox`**: UUID event_id; stable `dedupe_key` unique; scope IDs; source message ID; event kind/payload; classified-by identity; raw detector reference; effective order assigned under learner-scoped serialization; processing state received/applied/no_change/deferred_guard/rejected/error; error code; linked update/evidence IDs; created/applied timestamps. Record same-pair/no-change classifications too, so retries and invalidation can be reconciled without a fresh model interpretation of old messages.

Use the inbox to capture an observation while Guard is active without mutating protected checklist progression. Its processing state is operational bookkeeping, not an alternative learning status.

### 8.4 Hashing and immutability

Canonicalize JSON using fixed object-key order, fixed A–D option order, normalized line endings, trimmed surrounding whitespace, and preserved meaningful content. Hash canonical UTF-8 bytes with SHA-256 on the trusted server. Private hash includes key and basis; public hash does not. A hash is an integrity comparison, not authorization.

Any teacher change to target, stem, options, selection type, or key increments draft revision, clears review confirmation, and requires revalidation/reconfirmation. The final public text must be generated from the exact confirmed structured payload. A free-text edit cannot retain an invisible stale key.

### 8.5 Scoped reads

NEW `getChecklistForStudent(roomId, studentId, policyVersion)` is required for v3. Keep `getChecklistByRoom` as an explicitly legacy wrapper; do not use its `.single()` lookup once there can be owner-scoped checklists in the same room.

Use the same owner scope for `useChecklist`, the panel, prompt regeneration/context construction, evidence history, and completion calculation. Deleted items do not count in the denominator. No items means 0%, not 100%. Completion is `100 * covered_active_items / all_active_items`, with the existing display-rounding convention preserved.

## 9. Server operations, transactions, and idempotency

### 9.1 API boundary

NEW backend handler: `tutor-system/supabase/functions/assessment-api/index.ts` (proposed implementation location, not an existing deployed function). Browser facade: NEW `src/services/transferAssessmentService.ts`. Keep pure parser/grader/reducer modules free of browser-only or credential-bearing dependencies so the trusted handler and tests can reuse them.

All requests include `request_id` for transport idempotency. Successful envelopes are `{ok:true,data:...}`; errors are `{ok:false,error:{code,message,retryable}}`. A failure never returns a synthetic pass or a partially fabricated next state.

| Operation | Required request content | Response / effect |
|---|---|---|
| `capabilities` | room ID | authenticated scope, policy availability, schema/contract compatibility; no keys |
| `post_message` | request ID, room ID, content, optional parent/question references | verified authored public message; retry-safe insertion and processing result/pending indicator |
| `prepare_turn` | room ID, focus student message ID, checklist ID | process outstanding learner evidence; return snapshot, draft ID/revision, private supervisor decision to an authorized tutor only |
| `review_draft` | draft ID, expected revision, final structured payload, final turn mode/instruction, content-confirmed flag | validate and persist new revision/hash; clear confirmation on changes |
| `send_reviewed` | draft ID, expected revision/hash, request ID | one transaction creates message/question/key/audit, sets ordinary room participation, marks draft sent |
| `process_message` | stored learner message ID | classify/grade once; response contains public-safe state/outcome, not key |
| `cancel_question` | question ID, controlled reason | close unresolved interaction; no automatic failure |
| `invalidate_question` | question ID, reason, expected state snapshot | preserve defective result, reconcile effects as §9.6; tutor-only |
| `confirm_external_transfer` | item ID, supporting stored source/transfer evidence, note, expected snapshot | tutor-confirmed evidence goes through the same transition authority, not an arbitrary status write |

Derive caller identity and access on the server. Reject body-supplied tutor/student identities that conflict with the verified principal and stored scope. Never use caller-supplied selections/key/result to skip reading the actual submitted message or frozen key.

### 9.2 Reviewed send transaction

Create NEW `send_reviewed_tutor_response_v3`; retain the old RPC for explicit legacy clients only. The v3 handler loads the raw draft and final reviewed version itself.

Within one short database transaction:
1. Verify request identity/permission, draft ownership, confirmation, revision/hash, and payload validity.
2. Lock room, checklist, and affected item in a consistent order. Require active transfer-enabled owner scope.
3. Reject stale target eligibility/snapshot, unresolved-question conflict, wrong focus learner, or unsupported Guard recovery shortcut.
4. Insert final public tutor message with `response_mode` equal to final turn mode.
5. For assessment, insert the public question and immutable private key; enforce unique unresolved constraint.
6. Insert raw/final decision audit without leaking private payloads to a publicly readable audit table.
7. Set room participation through §4.2, mark draft sent, and save the request result under its idempotency key.
8. Commit and return allowlisted DTOs. Do not return `to_jsonb` of private rows.

A drafting, formatting, timeout, FK, key-storage, or audit failure rolls back delivery. The learner cannot receive a question whose key/evidence was not committed. Replaying the identical send request returns the same message/question IDs. A sent draft revision cannot create another question even under a different transport request ID; return its existing delivery or a clear already-sent conflict. Reusing its ID with a different payload returns conflict.

### 9.3 Learner-message processing

For transfer-enabled sessions, preserve message authorship through an authenticated message write path. Never classify optimistic `temp-*` or fictional `prepop-*` IDs as learner evidence.

Processing order:
1. Load the persisted message, verified student/checklist association, and relevant question.
2. If it explicitly replies to a question, resolve that exact question first. A closed/stale question does not redirect the reply to another active question.
3. Otherwise, consider the sole outstanding question for this learner. Match only a recognized selection or route a clarification/help request; do not grade another student's question.
4. On a recognized selection, normalize and grade deterministically. Capture the immutable answer identity once.
5. Apply the grade/state/evidence transaction, or record a deferred effect when Guard locks progression.
6. Classify additional relevant evidence with the question target excluded for this message.
7. Persist all observation results and ready-item context. Record feedback-required state from the attempt record.

An application-level retry can invoke processing more than once, but unique dedupe keys and row locks allow one effective grade/state mutation. Do not hold a DB transaction open while making an LLM request. Read a snapshot, classify outside the transaction, then recheck the snapshot under lock. If stale, recompute context or mark the proposal superseded; never promote from a stale plan.

### 9.4 Atomic progress transaction

NEW `apply_learning_event_v1` (trusted-server-only callable operation):

```text
validate scope, policy, source evidence and event kind
find existing event by dedupe_key
if already applied/no_change: return recorded result
lock room -> checklist -> item -> question (when present)
if room is guard: record deferred_guard outside protected progress tables; stop
verify current item updated_at against classified snapshot
verify event-specific guards and immutable question/key
run transition table
if reject: record error; no learner state mutation
if no_change: record event; do not increment learning attempts
if apply:
    insert coverage evidence
    update status AND understanding_level
    update last_addressed
    insert history with actual old/new pairs and evidence link
    link question result/event where relevant
    refresh completion from active items
    record event as applied
commit
```

The SQL-side guard and pure reducer must agree on the same golden transition cases. No ordinary client `updateItemStatus` call may bypass it for transfer-enabled items. A `SECURITY DEFINER` helper is not inherently authorized: test that the old public RPC cannot mutate new-policy records indirectly.

Use separate locks/scopes for different students. Stable dedupe keys:
- observation: `policy + student + item + source_message + event_kind`;
- grading: `question_id + first_valid_answer_message_id`;
- delivery: `reviewed_draft_id + revision + request_id` plus the unique unresolved index.

Transport retry counts are not learning attempts. For new-policy items, increment `attempts_count` only for a valid scored assessment answer or a valid spontaneous-transfer verification event; do not increment it for regeneration, reminders, duplicate ingestion, or manual note edits.

### 9.5 Guard, concurrency, and feedback linkage

Store a valid answer observation even if Guard currently blocks progress, but defer its checklist effect. Recovery requires an authorized reviewed/manual room transition. After unlocking, replay deferred events in causal order and reject stale ones; do not require a correct answer as the condition for Guard recovery.

The first valid answer is fixed once captured. A second answer cannot race it into a better score. Concurrent sends for the same learner resolve through the unique outstanding-question constraint. A losing request surfaces `ASSESSMENT_ALREADY_OPEN`; it does not silently replace the first question.

When a reviewed follow-up is sent, link its message ID to the resolved attempt atomically. An unsent/ignored draft is not feedback delivery. If higher-priority protection temporarily displaces result feedback, leave the feedback obligation unresolved unless the sent response actually includes it.

### 9.6 Invalidation after a grade

Never edit a frozen key in place. Mark the question invalidated, retain its original selection/key/result privately, and append an invalidation record with the teacher's reason.

If its grade was the latest effective evidence for the item, restore the recorded pre-grade pair atomically and append a compensating history row. If later effective events exist, replay the preserved valid event sequence with the invalidated grade excluded; do not rerun an LLM on old messages. Later independent valid transfer may still support `covered/good`; later contradiction still requires review. If causal guards no longer hold, flag the affected event and leave the item in a documented review outcome rather than invent evidence. Test simple rollback and later-independent-verification cases separately.

### 9.7 Error taxonomy

| Code | HTTP/default behavior |
|---|---|
| `AUTHORIZATION_NOT_CONFIGURED` | 503; feature remains disabled, no secret returns |
| `UNAUTHORIZED` / `FORBIDDEN` | 401/403; no mutation |
| `LEGACY_CHECKLIST` / `UNSUPPORTED_ROOM_SCOPE` | 409; ordinary tutoring still available |
| `INVALID_STATE_PAIR` / `INVALID_TRANSITION` | 409; no partial progress update |
| `STALE_SNAPSHOT` / `DRAFT_REVISION_CONFLICT` | 409; refresh/reprepare, not blind retry with old payload |
| `ASSESSMENT_ALREADY_OPEN` | 409; show existing public question |
| `ASSESSMENT_NOT_OPEN` / `WRONG_LEARNER` | 409/403; do not grade against another attempt |
| `ANSWER_FORMAT_UNRESOLVED` | successful processing with clarification required, not a failing grade |
| `ITEM_VALIDATION_FAILED` | 422; show teacher the invalid draft; no delivery |
| `AI_PROVIDER_ERROR` / `AI_OUTPUT_INVALID` | 502; bounded retry then surface |
| `PROGRESSION_LOCKED` | defer effect in Guard; do not report success of a state write |
| `PERSISTENCE_FAILED` | 500; transactional rollback; safe retry with same request ID |

## 10. Answer-key confidentiality and authorization prerequisite

### 10.1 What is and is not established

At the inspected revision, local name/role selection and deterministic user IDs are not proof of the requester's identity. [R12] The current reviewed-send helper accepts tutor IDs and the old migrations contain permissive grants/policies. [R6,R7] This plan does not claim the existing application already provides a secure teacher-only key boundary.

Introduce a narrow backend interface:

```ts
interface VerifiedPrincipal {
  principal_id: string;       // established by a trusted verifier, not the request body
  application_user_id: string;
  allowed_room_ids: string[];
  can_review_assessment: boolean;
}
async function verifyAssessmentPrincipal(request: Request): Promise<VerifiedPrincipal>;
```

**Release rule:** the adapter must be backed by a real trusted session/capability and verified room authorization. LocalStorage, a display name, a supplied user UUID, a public room password, or `current_role: "tutor"` are not accepted substitutes. If such an adapter is not available, return `AUTHORIZATION_NOT_CONFIGURED`, implement/test the domain behind an injected test verifier, and keep live assessment disabled. Report this bounded deployment prerequisite; do not quietly add a new authentication product or mark protection complete.

Do not expose a service-role/provider secret in `REACT_APP_*`, generated client assets, browser logs, fixture exports, or a learner-visible request. Server credentials and the private tables are server-only.

### 10.2 Data access matrix

| Data/action | Learner | Authorized teacher | Trusted backend |
|---|---|---|---|
| Delivered public question/options | Own scoped question | Own room | Yes |
| Unresolved answer key / private transfer basis | No | Own reviewed draft/question | Yes |
| Private raw model response/rationale | No | Own room | Yes |
| Submit own selection | Yes | No impersonation | Validates/persists |
| Grade / assign verified state directly | No | Confirm external evidence only through guarded operation | Deterministic grade and transition |
| Mutate key after delivery | No | No; invalidate/reissue | No silent overwrite |
| Change room mode | No | Existing authorized authority | Enforces |

Learner DTOs are explicit allowlists. Do not fetch a full private row into a learner browser and then hide fields. Exclude private tables from realtime; audit `select('*')`, exports, caches, developer logs, and error envelopes. Plain answer-key hashes are not a substitute for protecting a tiny four-option key space.

Block direct writes to transfer-policy state/evidence from untrusted clients, including calls through legacy public `SECURITY DEFINER` RPCs. Restrict new operations to the trusted handler. Test authorization at the backend/database boundary, not only by rendering different buttons.

Message authorship and room access for transfer-enabled sessions must also be verified. Protecting the key alone is insufficient if anyone can forge the learner's message or a passing progress event. Keep the existing legacy app usable, but do not enable the new-policy route until these narrow boundaries hold.

## 11. Exact application integration points

### 11.1 Message write and real-time ingestion

Extend `RoomContext.sendMessage(content, options?)` with optional `replyToMessageId` and `assessmentId`. Preserve the one-argument call for legacy components.

For transfer-enabled sessions, call the NEW backend `post_message` operation with `request_id`, `room_id`, content, and optional reply/question references. The backend derives the author and role from the verified principal. Persist a unique message client-request token for retry-safe insertion; client-selected IDs never establish identity. Return the public message plus processing outcome, not a key.

Processing can fail after the message was safely stored. In that case return the stored message with `analysis_pending: true`, not an error that causes the UI to send a duplicate message. The same request ID returns the same stored message. Mandatory catch-up before `prepare_turn` processes any pending messages in server-established order. Do not assume a browser callback is a durable task queue.

The teacher's real-time message handler may invoke idempotent processing to refresh the progress panel. Student/observer realtime handlers only update public UI. On teacher join/reconnect, reconcile stored learner messages before generating suggestions. Processing a message never automatically sends a tutor response.

A manually authored teacher message uses the same authenticated `post_message` path but does not fabricate a raw AI decision. Allow optional teacher-only `target_item_id`, `instruction`, `repair_item_ids`, and `feedback_for_assessment_id` metadata, validated against the room/item/attempt. The teacher confirms those declared functions of the final text. Record the declarations and message together so manual repair or result feedback can satisfy the same causal requirements as reviewed AI text. Without such metadata, the next evidence classification may cite a clearly relevant delivered manual explanation as repair, but must not silently mark assessment feedback delivered. Ordinary manual messages inherit the binary room participation identity and cannot create an assessment without the reviewed structured-question path.

Deduplicate optimistic-message replacement and realtime delivery by the final database message ID. Do not process temporary client rows. Use stored parent/question IDs rather than identifying an assessment by text similarity.

### 11.2 Suggestion generation and regeneration

`generateAIResponse` must pass the selected stored student message ID, student ID, and checklist ID. Do not select the latest message across multiple learners by text alone. Preserve `focusStudentMessage` as display/context content, not the identity key.

For v3, the facade delegates private generation to `prepare_turn`. It receives the server's draft ID, revision, snapshot, parsed public suggestion, and authorized teacher review fields. Extend `currentSuggestionContext` to retain these structured fields. Do not reduce the result to only `suggested_response`.

`regenerateAIResponse` creates a superseding draft revision/variant and records the previous draft as ignored/superseded. It does not deliver another question, change understanding, or reset an already-delivered attempt. Once a question is sent, regeneration targets a later turn only after the current exchange resolves/cancels.

### 11.3 Teacher review and composer

Extend `AISuggestionBox` or add NEW `AssessmentDraftEditor.tsx` for the authorized teacher. Required fields: target label/ID, stem, selection type, four option texts, correct-choice controls, validation messages, and one content-confirmation checkbox.

Selecting a correct checkbox uses radio behavior for single and multi-checkbox behavior for multiple. Edits clear confirmation. “Send assessment” is disabled until structural validation and teacher content confirmation pass. The confirmation attests that the concept/key/medium-transfer scenario are appropriate; it is not a claim of perfect assessment validity.

Copying a draft into the composer retains its draft linkage. Editing the rendered assessment text outside the structured editor marks the draft dirty and blocks send as assessment until reconciled. A teacher can explicitly convert the draft into an ordinary tutoring response; that discards the assessment payload and creates no delivered attempt.

Changing final mode to assessment requires a valid assessment payload; changing it away requires clearing the payload. Do not produce mode/payload mismatches. Record final instruction as well as final mode, rather than retaining an AI instruction that no longer describes the teacher's message.

Keep the room's Guard toggle binary. The final-turn selector may include assessment; the room settings must not.

### 11.4 Learner display and reply linkage

`RoomPagePost` already uses the shared room context and `PostComment`. [R16] Render the stored public text with line breaks. Assessment uses the normal tutor identity, never the Guard identity. Screen readers must receive the selection instruction and labels in the same order as visible options.

Threaded reply controls pass the question message ID. For an unthreaded selection, the server may use the single outstanding own question. For a reply to an old/closed question, do not reinterpret the selection as a reply to a newer one. Display a neutral clarification.

Do not reveal the key, key-shaped rationale, or private draft in student downloads. Submitted selections and teacher feedback can be included in public chat exports once actually sent/recorded.

### 11.5 Learning Progress panel and manual updates

Show:
- pending: “Not yet demonstrated”;
- partially_covered: “Ready for transfer check”;
- needs_review: “Needs review”;
- covered: “Transfer verified”.

The panel may annotate an outstanding question by reading its interaction record. Do not add a fifth checklist status or a parallel transfer progress field for that display.

For legacy checklists, keep legacy labels and a visible legacy-policy label. Never call historical `good/excellent` transfer verified.

Replace the new-policy independent status dropdown with guarded actions. “Confirm transfer from external evidence” requires a teacher's observation of the learner applying the principle in a changed context, not just “mark complete.” Record an actual verbal/offline observation as tutor-attested evidence without inventing a learner message ID. Simple note/priority edits do not mutate progress. Resetting a checklist creates a new record and preserves the old one.

## 12. Migration plan and compatibility

Use three forward migration stages (choose unused numbers at implementation time):

**M1 — additive storage and compatibility.** Add policy/owner metadata with `legacy_v1` defaults, private draft/key/event tables, public question records, optional audit/history links, and the new turn enum. Add client-request identity metadata for new-policy message idempotency. Preserve all historical values. Create scoped indexes and FK consistency checks.

**M2 — mode split and v3 transactional operations.** Convert message/raw/final mode columns through explicit text casts into the new turn enum; leave `rooms.active_response_mode` on the existing two-value enum. Update dependent function signatures/casts and constraints deliberately. Do not widen the shared room enum. Add v3 send/apply operations. Keep old RPCs compatible with legacy scopes but prohibit them from mutating transfer-policy records.

**M3 — guarded enforcement.** Enforce valid state pairs on transfer-policy items, owner-scoped writes, private data permissions, and idempotency. Add the verified message ingress and progress-operation restrictions for new-policy scopes. Reject new v3 null instructions; keep legacy null reads valid. Do not rewrite migrations 015/023/024 in place.

DB invariants that must survive direct SQL tests:
1. assessment cannot be stored as a room mode.
2. transfer-policy covered always pairs with good; partially_covered/needs_review pair with basic; pending pairs with none.
3. a transfer-policy checklist has an explicit learner owner.
4. no more than one unresolved question per room/learner.
5. a frozen key cannot be modified after delivery.
6. a state-changing event has evidence and accurate history in the same transaction.
7. unauthorized calls, including the old RPC, cannot bypass the transfer-policy boundary.
8. legacy rows retain their original meaning and values.

A production schema snapshot may differ from checked-in migrations. The agent must reconcile actual constraints before applying ALTER statements. Never use a blanket drop of all RLS policies, all function overloads, or all constraints as a shortcut.

## 13. Defaults for remaining boundary cases

| Situation | Required handling |
|---|---|
| First positive signal itself contains genuine medium transfer | Verify directly using documented spontaneous-transfer evidence. |
| Learner only says “I understand” | Initial signal for the clear current target; not a pass. |
| Learner says “I understand” after a failed item but no repair was delivered | Remain needs_review; teach first. |
| Tutor explains correctly but learner has not responded | No readiness/level promotion. |
| Learner has already seen the key or received substantive coaching | Do not grade that attempt as independent verification; cancel as assisted and use a fresh context later. |
| Learner intentionally enters every label | Exact-set result; no special punishment or invented intent. |
| Correct selection plus optional flawed reasoning | Pass the selection; do not revoke from the same message. Feedback may address the reasoning. |
| Wrong selection plus a polished explanation | Fail the selection; do not replace it with an LLM's preferred interpretation. |
| Model picks assessment while protection is required | Record invalid behavioral output; bounded retry/surface, do not relabel it silently. |
| Teacher edits options after confirmation | Clear confirmation and revalidate; no stale-key grading. |
| Teacher wants to change a delivered question | Cancel/invalidate as appropriate, preserve original message, and issue a new reviewed version. |
| Acknowledgment targets several equally plausible concepts | Clarify; do not update all by assumption. |
| Rejected AI assessment proposal, same learner trigger | Suppress automatic re-proposal; explicit regenerate is allowed. |
| Student reconnects | Restore own checklist and unresolved question from DB; do not infer from local state. |
| Checklist is deactivated/reset while a draft exists | Reject stale draft delivery; cancel unresolved questions with superseded_checklist reason. |
| Item text is materially changed | Create a replacement objective/item or explicitly reset its evidence scope; never retain good under a changed concept. |
| No valid new-policy checklist / unknown real learner | Ordinary tutoring plus visible assessment-unavailable notice; no invented target/state. |
| Multiple learners in first-release room | Disable automatic assessment with explicit scope notice; do not share completion. |
| A generation or judge errors | Record error/missing coverage separately from learner failure or model behavior score. |

## 14. Deterministic test contract

Copy the companion golden JSON into a versioned test-fixture directory. Do not change expected outputs to match the implementation without identifying a specification change.

Required suites and proposed NEW locations:

| Suite | File under `src/services/__tests__/` | Assertions |
|---|---|---|
| State reducer | `learningProgressTransitions.test.ts` | All 28 event/state cells; pair validation; no repetition shortcut |
| Answer parser | `assessmentAnswerParser.test.ts` | Every fixture; no letter extraction from prose; uncertainty vs alternatives; unique-text mapping |
| Grader | `assessmentGrading.test.ts` | Every nonempty subset of A–D for key B,D; all single choices; permutation/duplicate invariance |
| Response contract | `tutorDecisionContract.transfer.test.ts` | Valid modes/payloads; reject null instructions and invalid IDs; require first serialized key reason |
| Rendering/length | `assessmentRendering.test.ts` | Same text stored/displayed/graded; labels and instructions counted; 80 passes, 81 fails; two-sentence stem boundary |
| Orchestrator | `transferAssessmentService.test.ts` | Suppression, feedback-first, no unsent grading, same-message result precedence |
| Persistence | `transferAssessmentPersistence.integration.test.ts` | Atomicity, actual before-state history, idempotency, race conflicts, Guard deferral |
| Privacy/auth | `assessmentAuthorization.integration.test.ts` | No learner key access; forged IDs denied; legacy-RPC bypass denied; missing verifier disables feature |

Fixture coverage beyond the pure tables:
- Pass: signal -> delivered question -> correct labels only -> good/covered -> tutoring feedback -> no retest.
- Fail/recover: signal -> question -> wrong -> needs_review -> repair delivered -> learner “okay” -> partial/basic -> new context -> pass.
- No repair: fail -> acknowledgment -> remain needs_review.
- Clarification: question -> “B or D?” -> unchanged -> neutral format help -> clear B,D -> pass.
- Assistance: question -> content help -> cancelled, no failure -> fresh signal -> different question.
- Correct-with-reason: correct labels + inaccurate optional explanation -> pass once, no same-message downgrade.
- Regression: covered -> a distinct later contradicting message -> needs_review.
- Spontaneous: changed-context application -> good/covered without a generated question.
- Multi-target: three initial signals -> all partial/basic -> one assessment; others remain eligible.
- Guard: valid answer recorded under Guard -> no protected state write -> reviewed recovery -> deferred event applied once when still valid.
- Races: two sends, two answers, timeout/retry, duplicate real-time insert, stale draft after manual update.
- Invalidation: defective item before answer; defective graded item as latest event; defective event followed by independent valid verification.
- Legacy: old excellent/covered unchanged and not displayed as transfer verified.

A pure unit test cannot prove RLS, SQL atomicity, real-time privacy, or deployment compatibility. Run those against an isolated database and label mock-only checks honestly.

## 15. Semantic evaluation contract

Revise the canonical evaluation plan and keep behavioral checks separate from formatting checks. Proposed stable metrics:

| Metric | Method | Property |
|---|---|---|
| `transfer_trigger_target` | reviewed expected decisions + LLM rubric for evidence-based target | Assessment is selected only when eligible, including broad acknowledgment triggers. |
| `medium_transfer_quality` | calibrated LLM/human rubric | Same concept in a meaningfully changed context, without unrelated prerequisite knowledge. |
| `assessment_item_validity` | semantic rubric plus structural checks | Accurate key, unambiguous stem/options, plausible distractors, no answer leakage. |
| `assessment_followup` | deterministic mode/state assertions + semantic feedback check | Grading is respected; no extra explanation requirement or immediate quiz chain. |
| `verification_evidence` | semantic rubric | Spontaneous transfer, repair and regression are grounded in actual learner evidence. |

Keep exact grading, allowed pairs, IDs, authorization, and transaction behavior as supporting deterministic/integration checks. Do not score a raw LLM key match as evidence that the item itself is valid.

Calibrate semantic judges against annotated positive, negative, boundary, and contradictory outputs before baseline. Test same-surface semantic pairs where the only difference is a relevant fact or a prior verified state. Keep score provenance, raw generations, and judge errors.

Historical correct-answer cases with “always move to a different target” conflict intentionally with this feature. Version their expectations with a documented policy change; preserve the old cases/runs rather than deleting failures. Unchanged safety, dignity, honesty, role, and participation assertions remain regression requirements.

The current model contract changes, so retain two baselines: (1) untouched production behavior/outputs as a historical reference and (2) a separately named contract-compatible baseline with declared mechanical schema adaptations only. Compare the transfer candidate with the latter on identical snapshots/settings/cases. Never fabricate missing fields in old responses to make them conform.

Use the repository's established gates, including 80% per applicable behavioral metric/required partition, no decline in unchanged regression slices, 100% for exact required transitions/validity/safety and required semantic pairs, complete manifest results, and zero unresolved execution/judge errors. [R17] Freeze gates before seeing results.

Independent holdouts must be authored without exposure to the candidate prompt/development cases. The examples in this package are development fixtures, not unseen holdouts. If independent generation or live evaluation cannot be performed, report that coverage as pending; do not claim release acceptance.

## 16. Browser acceptance scenarios

Run against an isolated migrated environment with verified teacher/student principals:
1. Teacher initializes a new learner-owned transfer-policy checklist; legacy data remains visible and unchanged.
2. Student gives a bare contextual acknowledgment; teacher sees one valid structured assessment draft.
3. Teacher reviews/edits/reconfirms and sends. Student sees stem, instructions, and four options; room remains tutoring.
4. Student sends only the correct labels. Progress becomes good/covered once, including after reload; teacher's next suggestion is tutoring feedback.
5. Wrong answer follows the needs_review -> repair -> new learner signal -> new context sequence.
6. Teacher changes Guard manually; no progression mutation slips through. Recovery works without requiring a correct answer.
7. Reject/regenerate/dirty draft cases never create phantom delivered questions or stale-key grading.
8. Inspect student network requests, realtime payloads, exports, browser storage, and errors: no unresolved private keys or rationales.
9. Attempt unauthorized direct requests, forged identity, cross-learner answers, stale question replies, and old-RPC writes. They must be rejected.
10. Simulate commit timeout then retry, reconnect, and two teacher tabs. No duplicate question, answer effect, or history row.

Save evidence of what actually ran. A passing prompt benchmark and a passing browser release check are separate verdicts.

## 17. Work packages with concrete file ownership

Use the path-shorthand rule at the start of this document. NEW means create; existing names refer to inspected code, not an assumption that an uninspected implementation already exists.

| Order | Files / symbols | Work and completion condition |
|---|---|---|
| W0 | `tutor-system/claude_docs/ai-behaviors/{tutor-behavior-specification,tutor-response-contract,tutor-behavior-evaluation-plan}.md`; BDD feature files; documentation update record | Persist U/D decisions, exact pairs, T09, T02/T08 exceptions, mode split and test applicability before prompt changes. |
| W1 | NEW `src/types/learningProgress.ts`, `src/types/assessment.ts`; existing `src/types/checklist.ts`, `src/types/index.ts` | Export narrowed new-policy and legacy types; separate room/turn consumers. No new mastery field. |
| W2 | NEW `src/services/learningProgressTransitions.ts`, `assessmentAnswerParser.ts`, `assessmentGrading.ts`, `assessmentRendering.ts` and tests | Pure functions pass the golden cases; no model/provider/database dependencies. |
| W3 | NEW forward SQL migrations under `tutor-system/supabase/migrations/`; existing generated `src/types/database.ts` | Storage, enum split, transaction operations, owner scope, private keys, compatibility, enforcement. Verify on isolated DB; regenerate types from actual migrated schema. |
| W4 | NEW `supabase/functions/assessment-api/index.ts` and trusted server helpers; NEW browser `src/services/transferAssessmentService.ts` | Authenticated operations, immutable draft/key handling, idempotent message processing; disabled when trusted auth unavailable. |
| W5 | Existing `src/services/coverageDetectionService.ts`, `checklistService.ts`, `roomFeaturesService.ts` | New-policy evidence events and guarded transitions; legacy explicit path. Replace separate writes/placeholder history for new-policy changes. |
| W6 | Existing `src/services/ecologicalTutorCall.ts`, `aiService.ts`, `tutorDecisionContract.ts`, `guardModeService.ts` | Shared IDs/state/attempt context; v3 parser/adapters; effective 1,200 token budget; new send RPC; no secret returns to learner. |
| W7 | Existing `src/contexts/RoomContext.tsx`, `src/pages/RoomPagePost.tsx`, `RoomPage.tsx`, room exports | Ingress/realtime catch-up, selected learner focus, structured draft lifecycle, correct message-parent IDs, binary room state, public/private exports. |
| W8 | Existing `src/components/AISuggestionBox.tsx`, NEW `AssessmentDraftEditor.tsx`; existing `ChecklistPanel.tsx`, `useChecklist.ts`, `PostComment.tsx` | Reviewed structured payload, owner-scoped progress display, ordinary assessment identity, dirty-edit blocking, no arbitrary pair edits. |
| W9 | Existing `src/services/prompts/activeTutorAgentPrompt.ts`, `checklistPromptGenerator.ts`, prompt builder; response-length checker | Replace old shortcuts/retesting/consolidation rules in new-policy prompts; explicit assessment length branch; preserve unrelated behavior. |
| W10 | `evals/promptfoo/` cases/rubrics/config/adapters; `scripts/check-promptfoo-quality-gate.js`; product fixtures/exporter; NEW transfer fixtures | Calibrate, freeze, baseline, compare, holdout validation, and report all partitions/errors without changing historical evidence. |
| W11 | Browser tests, deployment/config examples, docs | Run complete product checks, confirm release gates, document legacy behavior and rollback. |

Ownership boundaries: the reducer owns state transitions; the parser owns selection syntax; the grader owns set equality; the server owns auth/atomicity/key storage; the detector owns evidence classification; the tutor model owns semantic instructional choice and phrasing; the teacher owns final review. Do not create a second independent progression authority in React effects or a prompt.

## 18. Commands and verification order

Existing commands were read from `tutor-system/package.json`. [R18] The following are execution instructions for the coding agent, not commands run to prepare this plan.

```bash
# At repository root: establish starting state; don't overwrite unrelated work.
git rev-parse HEAD
git status --short

# After installing the existing lockfile's dependencies when necessary:
cd tutor-system
npm ci

# Pure/new unit tests (add files before invoking this exact path set).
CI=true npm test -- --watchAll=false --runInBand --runTestsByPath \
  src/services/__tests__/learningProgressTransitions.test.ts \
  src/services/__tests__/assessmentAnswerParser.test.ts \
  src/services/__tests__/assessmentGrading.test.ts \
  src/services/__tests__/tutorDecisionContract.transfer.test.ts \
  src/services/__tests__/assessmentRendering.test.ts

# Existing regression command and production build.
CI=true npm run test:regression -- --runInBand
npm run build
```

Add explicitly named isolated-database and authorization test commands as part of W3/W4; their implementation must provision a disposable database and never target production by default. Do not assume a mock Supabase client exercises SQL constraints.

Existing live evaluation/browser entry points are `npm run eval:prompts` and `npm run eval:behavior:web`. Inspect their current target settings and side effects first. Use new frozen manifests/output locations for this feature. Running live model calls, seeding demo rooms, deploying functions, applying hosted migrations, and creating browser test rooms require explicit execution authority and configured credentials; this request to expand a plan does not grant those actions.

Do not run `supabase db reset`, migration pushes, or seed commands against a linked hosted project as an incidental test step. Missing tools/credentials produce a named unrun stage, not an invented result.

## 19. Definition of done and final coding-agent report

Implementation is complete only when the canonical docs, parser/schema, state authority, actual message path, database constraints, rendering, grader, and tests agree on the same behavior.

The coding agent's final report must state:
- Starting/ending commit and changed files, with any unrelated changes preserved.
- Which U/D decisions were implemented; any deviation and why it was unavoidable.
- Migration identifiers and whether each was only authored, locally exercised, or actually deployed.
- Auth/key-protection status, including the exact verified-principal source or a release-blocking absence.
- Tests actually run, commands, exit statuses, expected/observed counts, failures and missing coverage.
- Whether live semantic evaluation and browser verification ran; links to immutable evidence when they did.
- Whether the feature flag is enabled, where, and how rollback works.

Do not write “fully implemented” for prompt-only changes, “secure” for UI-only hiding, “transfer verified” for migrated legacy good values, or “tests passed” for fixture parsing alone.

## 20. Activation, legacy handling, and rollback

Use a backend-controlled capability flag, disabled by default. A client flag may hide/show UI but cannot authorize the feature. Enable only when schema compatibility, trusted identity/author checks, key access controls, transaction tests, prompt evaluation, and browser evidence satisfy the release gates.

Creation of a new checklist explicitly writes `progress_policy_version='transfer_v1'` and its student owner. Existing rows retain `legacy_v1`; no date-based heuristic decides semantics. Default creation remains legacy until the backend capability is enabled. Do not infer verification from old good/excellent/covered or map excellent to good automatically.

When an existing learner moves to the new policy, create a new learner-owned checklist and preserve/deactivate the relevant old record only through an explicit teacher operation. Reuse objective text, not old verification claims. Do not globally deactivate every checklist in the room.

Roll out additive compatible DB/storage first, trusted operations second, backend capability/prompt/UI last. Check old client behavior against newly converted message/audit mode columns. During rollback, disable new assessment generation/delivery but continue safe resolution of already-delivered questions or explicitly cancel them without failing the learner. Do not drop new tables or erase evidence as rollback.

The release can be blocked on authentication/infrastructure while domain/UI implementation is complete. Report the distinction explicitly; a deployment prerequisite is not permission to fake the missing adapter.

## 21. Pinned source references

All repository references use the inspected commit `1eeedf8e157b8bcea69b914add0a284a1e603395`; future code may differ. Prior discussion and the supplied original plan provide user-decision context; code observations are grounded in these files.

- [R1 — Checklist types](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/src/types/checklist.ts)
- [R2 — Coverage detector](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/src/services/coverageDetectionService.ts)
- [R3 — Checklist service and update paths](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/src/services/checklistService.ts)
- [R4 — Room context, ordinary send, generation and realtime](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/src/contexts/RoomContext.tsx)
- [R5 — Shared application types](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/src/types/index.ts)
- [R6 — Reviewed send service](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/src/services/guardModeService.ts)
- [R7 — Guard and reviewed-send schema](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/supabase/migrations/023_guard_mode.sql), [raw instruction migration](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/supabase/migrations/024_raw_instruction.sql)
- [R8 — AI service; TutorSuggestionService request/token/repair logic](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/src/services/aiService.ts)
- [R9 — Active tutor prompt](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/src/services/prompts/activeTutorAgentPrompt.ts)
- [R10 — Canonical tutor specification](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/claude_docs/ai-behaviors/tutor-behavior-specification.md), [response contract](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/claude_docs/ai-behaviors/tutor-response-contract.md)
- [R11 — Checklist schema](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/supabase/migrations/015_checklist_system.sql)
- [R12 — Current name/role-based identity implementation](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/src/contexts/AuthContext.tsx)
- [R13 — AI suggestion component](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/src/components/AISuggestionBox.tsx)
- [R14 — Shared product/evaluation call packaging](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/src/services/ecologicalTutorCall.ts)
- [R15 — Existing word/sentence counting](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/scripts/response-length-rubric.js)
- [R16 — Main post-style room page](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/src/pages/RoomPagePost.tsx)
- [R17 — Evaluation contract and gates](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/.agents/skills/ai-behavior-design-eval/references/evaluation-contract.md), [behavior-design skill](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/.agents/skills/ai-behavior-design-eval/SKILL.md)
- [R18 — Existing package scripts/dependencies](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/package.json)
- [R19 — Original checklist BDD intent](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/features/checklist_management.feature), [AI checklist BDD](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/features/ai_checklist_integration.feature)
- [R20 — Existing constitution](https://github.com/linmou/PhishingTrainingProgram/blob/1eeedf8e157b8bcea69b914add0a284a1e603395/tutor-system/claude_docs/ai-behaviors/constitution.md)

---
**Handoff boundary:** This package defines the implementation and its acceptance evidence. It does not assert that proposed code, SQL, model behavior, or authorization has already been implemented or validated in the project.
