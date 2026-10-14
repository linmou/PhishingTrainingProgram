## Intent
Provide a human-readable QA guide for the transfer-assessment room workflow, including setup, tutor review, learner answers, progress changes, privacy, and recovery behavior.

## Metadata
- Updated: 2026-10-14
- Release baseline commit: `83690fe`; queued-assessment verification added during hosted release.
- Source of truth: `features/transfer_assessment.feature` and the [Partial-only final assessment contract](ai-behaviors/transfer-status-response-contract.md#assessment-after-full-understanding).
- Policy provenance: [T09.1](ai-behaviors/tutor-behavior-specification.md#t09-transfer-assessment-and-verification-lifecycle) connects P2 adaptive learning and P3 constructive engagement to the user's decision: verify understanding developed through tutoring, while avoiding a redundant quiz for knowledge shown directly from Pending.

# Transfer Assessment Room QA Guide

## What This Feature Does

Transfer assessment checks whether a learner can apply a phishing-safety concept in a new situation. The room uses the learner's recorded evidence and approved learning targets to decide when a check is eligible.

Partial understanding continues tutoring. When later learner evidence moves a target from Partial to Covered through `demonstrated_understanding`, a final assessment becomes due. The target remains active until that assessment passes. Direct Pending → Covered understanding and spontaneous transfer complete the target without a quiz. Covered therefore describes understanding; accepted evidence and assessment lifecycle determine completion.

The tutor receives a private draft, reviews it, and explicitly sends it. The learner receives a public question with four choices. The answer key, transfer basis, and model rationale stay private to the tutor and server.

An assessment is a tutor turn inside the room. It does not switch the room into Guard mode or change the room's normal `tutoring` participation mode.

## What Is A Transfer Learning Enabled Room

A transfer learning enabled room is an ordinary tutoring room whose **Enable In-Room Assessment** setting has been saved on. The room keeps the same tutor, learner, chat, AI, and Guard controls, but it also supports learner-owned learning targets, evidence-based transfer checks, tutor-reviewed assessment drafts, and persisted answer attempts.

An ordinary room does not run this transfer-assessment lifecycle. Its checklist remains room-shared and its messages use the normal tutoring or Guard paths. It does not prepare a private transfer draft or grade assessment answers.

### How To Create One

1. Sign in as a tutor and open **Create New Room** from the tutor view.
2. Enter the room title and description, choose an image if needed, and select **Create Room**.
3. Open the new room and open the AI settings panel.
4. Turn on **Enable AI Assistant**.
5. Turn on **Enable In-Room Assessment**.
6. Save the settings and reopen the room if needed to confirm the setting persisted.
7. Open **Learning Progress** and create targets with **Generate Learning Targets** or **Enter Manually**.
8. Have the learner join. The targets then become the learner-owned checklist used by the assessment workflow.

The room is ready for transfer-assessment QA only after the setting is saved, the learner has joined, and at least one target is available. Turning the setting on without targets produces a setup state, not an assessment-ready room.

## Roles And Visibility

| Role | Can do | Must not see |
| --- | --- | --- |
| Tutor | Set up targets, inspect progress, request an AI turn, edit and send a draft, and review the answer lifecycle | Nothing from the tutor review surface is hidden from the tutor |
| Learner | Read a delivered question, select answers, submit, and review their own answer history | Correct answer, transfer basis, model rationale, private payloads, and another learner's lifecycle |
| Observer | Read the room according to normal observer permissions | Answer controls and learner-only assessment lifecycle |

## Test Setup

Use a room with:

1. A transfer learning enabled room: create a room, save **Enable In-Room Assessment** in AI settings, and create or load at least one learning target.
2. A tutor account and a separate learner account.
3. An approved learner-owned checklist with at least one target, such as “Verify payment requests through a trusted channel.”
4. An initial learner message establishing partial understanding, followed by tutoring and a later message demonstrating full understanding of that same target.
5. AI enabled for the tutor.

For deterministic manual checks, use a target with an obvious changed situation and keep a second browser session open as the learner. Record the room ID, tutor ID, learner ID, checklist item ID, and message IDs in the test evidence.

## Core Workflow

### QA-TA-01: Set Up Learning Targets

1. Open a transfer-enabled room as the tutor.
2. Open **Learning Progress**.
3. With no active transfer checklist, select **Generate Learning Targets** or **Enter Manually**.
4. Save at least one detection area or verification step.
5. Confirm the target appears in the progress panel.

Expected result:

- The tutor can create or edit targets.
- A learner who joins before setup sees **Waiting for the tutor to set up learning targets.**
- The learner has no target-generation or manual-entry controls.
- Targets created before the learner joins remain visible and sync when the learner joins.

### QA-TA-02: Prepare A Draft

1. Send learner evidence that establishes partial understanding of an approved target.
2. Request an AI response and confirm tutoring continues while the target is `partially_covered / basic`.
3. After tutoring, send a later learner message demonstrating full understanding. Confirm the accepted event is `demonstrated_understanding` from Partial to Covered.
4. As the tutor, request the next AI response and wait for preparation.

Expected result:

- The tutor sees **Review transfer assessment** with the target label.
- The draft contains a question, answer type, four choices labelled A-D, a correct answer selection, and a learner-safe explanation.
- The room remains usable while the draft is being prepared.
- Guard, another open assessment, or required feedback defers a new assessment. Repair evidence continues tutoring until a later full-understanding transition makes assessment due.
- The target is `covered / good` but remains active while its final assessment is due or open.
- A blocker delays the outstanding assessment; a later eligible request can prepare it without another understanding transition.

### QA-TA-03: Review, Edit, And Send

1. Change the question or option text.
2. Change **Answer type** between **Choose one** and **Select all that apply**.
3. Select the correct answer or answers.
4. Edit **Explanation after a second incorrect answer**.
5. Select **Send assessment**.

Expected result:

- The editor reports unsaved edits and validates the candidate before sending.
- A single-answer draft allows one correct option; a multiple-answer draft allows more than one.
- Invalid or incomplete drafts remain in review and are not delivered.
- **Discard candidate** removes the local draft without creating a gradable assessment.
- After a successful send, the tutor sees the assessment message in the room.

### QA-TA-04: Verify Public Delivery And Privacy

1. View the delivered assessment as the learner.
2. Inspect the message and its expanded/collapsed state.
3. Inspect the same message as the tutor.

Expected result:

- The learner sees only the stem, instruction, and four options.
- A single-answer question uses radio controls and says **Choose one.**
- A multiple-answer question uses checkbox controls and says **Select all that apply.**
- The learner does not see `correct_option_ids`, the transfer basis, model rationale, raw provider output, or private payload fields in the rendered message.
- The tutor can see the review context and answer key.
- The room participation mode remains **tutoring**; the message itself is marked as an assessment turn.
- While the learner's assessment is open, the comment composer and generic Reply actions are disabled. The learner must use the displayed answer controls; another learner's question does not lock their chat.

### QA-TA-05: Correct First Answer

1. As the learner, select the correct option.
2. Submit the answer once.

Expected result:

- The answer is accepted through the displayed option control and **Submit answer**, with both the assessment ID and question-message parent recorded.
- The learner sees **Correct.**
- The assessment resolves once and controls become unavailable.
- The target remains `covered / good`; passing resolves its outstanding assessment requirement and completes the item.
- Replaying the same answer does not create another grade or attempt.
- Ordinary chat and Reply become available again, including after reload.

### QA-TA-06: Incorrect First Answer And Retry

1. Start a new delivered single-answer assessment with two attempts available.
2. Submit an incorrect option first.

Expected result:

- The learner sees **Incorrect. 1 attempt remaining.**
- The assessment remains open for one more valid selection.
- Progress remains `covered / good`; the item remains active while the assessment is open.
- The answer key and terminal explanation are not disclosed.
- Ordinary chat and Reply remain disabled during the retry; option controls remain available for the remaining attempt.

### QA-TA-07: Correct Second Answer

1. Submit the correct option as the second valid selection.

Expected result:

- The learner sees **Correct.**
- The assessment becomes terminal with no attempts remaining.
- Progress remains `covered / good`, and the item completes.
- The pass transition is applied once, even if the request is replayed.

### QA-TA-08: Two Incorrect Answers

1. Start a new delivered single-answer assessment with two attempts available.
2. Submit two different incorrect options.

Expected result:

- The assessment becomes terminal with no attempts remaining.
- Progress becomes `needs_review / basic`.
- The learner receives the correct option and the learner-safe explanation.
- A third answer cannot be submitted or graded.
- The failure transition is applied once.
- Resume tutoring. Corrected evidence moves Review to Partial; only later full understanding moves Partial to Covered and makes a new assessment in a different context due.

### QA-TA-09: Option Gate And Multiple Answers

1. Deliver a multiple-answer assessment with two correct options.
2. Verify ordinary chat and generic Reply are disabled before selecting anything.
3. Select the required displayed options and submit once.
4. Verify the stored answer has the question's parent ID, its separate assessment ID, and the selected option IDs.

Expected result:

- An empty selection cannot be submitted. Text-only, foreign, stale, duplicate or unknown-option submissions are rejected by the shared send path before a message is saved.
- Multiple selections are accepted only for a multiple-answer question; selected options are graded by the trusted backend.
- First incorrect feedback keeps the gate active; a terminal result restores ordinary tutoring input.

### QA-TA-09A: Tutoring Across Two Knowledge Points

1. Tutor the URL-domain target while it is Partial, provide full understanding, and complete its final assessment through option controls.
2. Send tutor feedback replying to that assessment's terminal answer, then tutor Official Support while it is Partial, provide full understanding, and complete its assessment and feedback.
3. Reload between cycles and after the second answer.

When a learner message makes other targets ready too, follow the server's priority order and complete those queued assessments and their terminal feedback before moving to the next topic. Retain the full target inventory; the number of questions can exceed two.

Expected result:

- Each assessment references its own target and has distinct question-message and assessment IDs.
- Normal tutoring resumes between assessments; each new open assessment restores the option gate.
- Each answer records an authoritative attempt, each completed assessment closes, and neither cycle leaves an open assessment blocking the next target.
- Tutor feedback references the terminal answer and is stored after the assessment closes; a reply to the next topic does not satisfy that feedback requirement.
- Persisted progress is checked per target. The full live journey requires the hosted final-assessment policy matching this guide.
- Both URL Domain Check and Official Support complete; all additional delivered questions also have distinct identities, authoritative attempts, terminal feedback and closed lifecycles.

### QA-TA-10: Reload And Duplicate Tabs

1. Deliver an assessment and submit one incorrect answer.
2. Reload the room and open the same room in a second tab.
3. Replay the first answer from one or both tabs.

Expected result:

- Both views show the same persisted attempt count and lifecycle.
- The accepted attempt count stays at one.
- The replay is treated as a duplicate and does not consume another attempt or create another grade.

### QA-TA-11: Feedback Before Another Assessment

1. Resolve an assessment by passing or failing it.
2. Ask the tutor AI for the next response.

Expected result:

- The next response is tutoring feedback or an independently required Guard response.
- It contains no new assessment payload.
- A new assessment is not eligible until the feedback turn is delivered.

### QA-TA-12: Guard And Correction Precedence

1. Put the learner in an imminent unsafe action, such as opening a suspicious link.
2. Ask the tutor AI for the next response.

Expected result:

- The tutor protects or corrects the learner first.
- The first response is not a transfer assessment.
- Learning progression is locked while Guard mode is active, but corrective messages remain available.
- A later assessment can be considered only after the Guard or repair requirement is cleared.
- If an assessment was already due before a temporary blocker, it remains due on a later eligible request. A later contradiction instead invalidates readiness and resumes tutoring.

### QA-TA-13: Progress Reopen And Manual Tutor Edits

1. Confirm a target is `covered / good` through evidence or a passed assessment.
2. Send later learner evidence that genuinely contradicts the target.
3. Review the **Learning Progress** panel as the tutor.

Expected result:

- Contradictory evidence reopens the target as `needs_review / basic`.
- The tutor can edit status, understanding level, priority, target text, and notes through the checklist panel.
- A covered target is not routinely reassessed without new contradictory evidence.

### QA-TA-14: Direct Understanding And Spontaneous Transfer

1. Use a fresh target at `pending / none` and send learner evidence demonstrating full understanding immediately.
2. Request the next AI response.
3. Separately use a target with valid independent application in a materially different situation.

Expected result:

- Direct Pending → Covered `demonstrated_understanding` completes the target without a generated assessment.
- Accepted `spontaneous_transfer` also completes the target without an assessment.
- A covered pair alone does not create an outstanding assessment requirement.

### QA-TA-15: Deferred And Invalidated Assessment Readiness

1. Establish Partial → Covered `demonstrated_understanding` while an assessment blocker applies.
2. Clear the blocker and request a later AI response without repeating the understanding evidence.
3. In a separate run, introduce a later contradiction before sending the draft.

Expected result:

- The later eligible request prepares the outstanding final assessment.
- Replaying a preparation or a passed cycle does not produce a second assessment for that cycle.
- Contradiction moves the target to Review and invalidates the old readiness; a stale draft cannot be delivered.
- Repair to Partial continues tutoring. Later full understanding is required to establish a new assessment cycle.

### QA-TA-16: Tutor Edits During Final Assessment

1. Establish a due assessment, then edit only tutor notes or priority.
2. Deliver the assessment, repeat those metadata edits, and submit a correct answer.
3. In separate runs, change the target wording or learning state while its question is open.

Expected result:

- Notes and priority preserve readiness and allow the delivered question to be graded.
- Actual target or state changes cancel the obsolete question without awarding progress or consuming an additional attempt.
- A later valid repair/development cycle can produce a fresh assessment; the cancelled question does not block it.
- Guard-deferred evidence or results cannot apply to a changed target when tutoring resumes.

## Failure And Recovery Checks

| Condition | Expected behavior |
| --- | --- |
| No approved learning targets | Tutor sees setup controls; learner waits; no assessment is prepared. |
| Assessment preparation is unavailable | Tutor sees an unavailable or retryable status; no partial assessment is delivered. |
| Candidate is stale after room state changes | Send is rejected as no longer current; the tutor must refresh or generate a new candidate. |
| Candidate fails validation | The review editor shows a validation error and keeps the draft unsent. |
| Assessment API request is retryable | The UI reports that the request can be retried without creating a duplicate delivery. |
| Learner answer is still processing | Controls remain disabled and the learner sees a processing status. |
| Learner answer is rejected | The learner sees a rejection message and can retry when the format is corrected. |
| Network or realtime reconnect | Reloading the room restores persisted questions, answer history, attempt count, and lifecycle. |

## QA Invariants

- Only the target learner can answer a delivered assessment.
- Tutors can send ordinary messages in a transfer-enabled room; tutor messages do not call the learner assessment-post operation.
- Assessment delivery never exposes the answer key or model-only fields to the learner.
- Every accepted answer has at most one attempt number and is idempotent on replay.
- An unsent or discarded draft is not visible to the learner and cannot be graded.
- Assessment turns do not silently change the room's Guard/tutoring participation mode.
- Progress changes are tied to the persisted learner evidence or trusted assessment result, not to text matching in the browser.
- A terminal pass is recorded exactly once even though `covered / good` stays unchanged; terminal failure moves covered progress to review.
- Assessment pass/fail requires a valid lifecycle on a covered target; Partial, Pending, and Review do not accept terminal assessment outcomes.

## Evidence To Capture

For each manual run, keep:

- Environment and project (local, staging, or production).
- Room ID, tutor ID, learner ID, checklist ID, and target item ID.
- Before/after screenshots for setup, draft review, delivery, learner answer, and progress.
- Message IDs for the assessment and each answer.
- Attempt number, outcome, attempts remaining, and progress pair after each submission.
- Qualifying understanding event and prior state, whether assessment is due/open/completed, and evidence that delayed preparation survives blockers while contradiction invalidates it.
- Network or console evidence for privacy failures, duplicate processing, or incorrect transitions.

## Automated Coverage

- [Transfer assessment feature scenarios](../features/transfer_assessment.feature)
- [Executable BDD coverage](../src/__tests__/transfer_assessment.bdd.test.tsx)
- [Room transfer lifecycle tests](../src/pages/__tests__/RoomPagePost.transferLifecycle.test.tsx)
- [Assessment question rendering tests](../src/components/__tests__/PublicAssessmentQuestion.test.tsx)
- [Checklist and target setup tests](../src/components/__tests__/ChecklistPanel.transfer.test.tsx)
- [Assessment draft editor tests](../src/components/__tests__/AssessmentDraftEditor.test.tsx)

The feature file includes one explicitly tagged `@non_feasible` selection scenario that is not currently executable in the BDD suite; treat it as a specification item requiring separate review rather than as passing automated coverage.
