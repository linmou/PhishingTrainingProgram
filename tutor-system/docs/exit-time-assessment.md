# Exit-time transfer assessment (temporary)

<!-- Intent: define the temporary exit-assessment replacement and how it integrates with the existing transfer-assessment system. Updated: 2026-10-30. Baseline commit: ebc03d1. -->

Status: approved by the owner on 2026-10-29/30; not implemented (PRD gap G-78). Requirements: PRD FR-54 and the "While exit assessment is in force" consequences of FR-16 and FR-31–FR-41. Decisions and their sources: PRD addendum §G (EA-1 to EA-21).

## Purpose

In-dialogue timing of transfer assessments was not accurate enough. The room owner still reviews and sends transfer assessments during the conversation, but the learner answers all of them in a pop-up when leaving the room. The mode is temporary and built with minimum changes.

There is no runtime switch. Exit assessment replaces in-dialogue answering in place on `no_sign_up`. The in-dialogue implementation is archived unchanged on branch `assess-in-dialogue` (commit `ebc03d1`); restoring it means redeploying that branch's frontend and Edge function and re-applying its SQL definitions as a new migration.

## What changes and what does not

Unchanged: assessment generation and validation (T09.2), tutor review and send (T09.3), answer parsing and exact-set grading, two attempts, result messages and disclosure ([assessment result messages](assessment-result-messages.md)), progress outcomes of pass and fail, Guard holding of answers, cancellation on contradiction or target change, exports, and the room owner's and observers' views.

| Area | In-dialogue rule (archived) | Exit-assessment rule |
| --- | --- | --- |
| Due | Partial → Covered by `demonstrated_understanding` only (T09.1) | Any learner-owned learning event that made the target Covered; a pass makes it due again at the learner's next visit |
| Blockers | Guard, any open assessment, or outstanding tutor feedback | Guard only; a target with an open assessment, or one already sent in the current visit, is skipped |
| Open per learner | One | One per learning target |
| Learner chat | Question shown; composer locked until it closes | Questions, answers and results hidden from the learner; composer stays enabled |
| Rating gate | Tutor messages without an assessment event | Also excludes hidden questions |
| Answering | In the conversation | Exit pop-up, one question at a time |
| Tutor feedback before the next assessment | Required (T09.6) | Not required |
| AI suggestion history and rules | Every question, answer and result; invite a selection for each open question | Open questions, their answers and non-final results left out; never mention open questions |

## Integration design

The existing functions are changed in place, so each entity keeps one writer (architecture AD-1): assessments are still created only by `send_reviewed_tutor_response_v4`, graded only by `process_assessment_message_v2`, and cancelled only by the existing cancellation paths. One migration:

- **`private.transfer_assessment_due_event(item_id)`** returns the learning event of the target's latest status or understanding change when that change made it `covered/good` through an applied, learner-owned event. Assessment rows no longer count as the latest change, so a pass leaves the target due. The function does not read visits: its value feeds `private.transfer_item_hash`, and an open question must keep the same hash across visits so it can still be graded at a later exit.
- **Visits.** A new private table records `(room_id, student_id, visit_key, started_at)`, unique on `(room_id, student_id, visit_key)`. A new function `start_learner_visit_v1`, service role only, inserts one row and does nothing for a key it has already recorded (AD-7). The room page creates one `visit_key` per page load (kept in a ref, so React remounts and join retries reuse it) and passes it to the Edge `join_room` operation, which records the visit after `join_room_v1` only when the caller is the room's learner. The dashboard's pre-navigation `join_room` call sends no key and records nothing. `join_room_v1` itself is unchanged, because posting and answering also call it. A reload, or a second tab, is a new page load and therefore a new visit. The table holds visits, never due state (AD-3).
- **`prepare_transfer_assessment_context_v1`** keeps its signature and return shape. Guard is the only blocker. A target is eligible when it is due, has no open assessment, and has no assessment that was either sent (and not cancelled) or resolved as passed or failed since the learner's latest visit start. Keying on resolution as well as sending covers a question sent in one visit and answered at a later visit's exit: its target is due again only from the visit after that. A question cancelled in the current visit does not block a new one, because the learner never answered it. If the learner has no recorded visit yet (for example a page opened before the release), every earlier sent or ended assessment counts as in the current visit, so nothing is re-offered until a visit is recorded.
- **`send_reviewed_tutor_response_v4`** refuses `ASSESSMENT_ALREADY_OPEN` only when the same learning target has an open assessment. `send_reviewed_transfer_assessment_v1` is unchanged; it rechecks eligibility through the prepare function.
- **Edge function `assessment-api`.** Only `join_room` changes: it accepts an optional `visit_key` and records the visit as above. `prepare_turn`, `send_reviewed` and `process_message` call the same functions as before.
- **AI context** (EA-20, EA-21). The tutor's AI request is built in the browser by `simplifiedAIContext.ts` and `ecologicalTutorCall.ts`. The history leaves out the learner's open transfer assessments, the answers to them and non-final results; ended ones from earlier exits stay. `ASSESSMENT_DIALOGUE_POLICY` says the learner answers only at exit and must not be asked about open transfer assessments, drops the invite-a-selection and tutor-feedback rules, and keeps the never-reveal-or-hint rule. The history readiness check still waits for pending results before generating.
- **Browser.** For the learner, the conversation view filters out their transfer assessments, answers and results; the composer lock and rating gate ignore them; the room page shows the exit pop-up on in-app leave; and a `beforeunload` handler triggers the browser's own leave prompt while the learner has open questions. The tutor and observer views are not changed.

## Grading consistency check

Questions are graded only when their stored snapshot hash equals the current `private.transfer_item_hash`, which includes the due event. Two cases must be confirmed by SQL tests:

- An exit question for a target reached from Pending, from Partial or by spontaneous transfer keeps a matching hash from delivery to grading, including across a new visit.
- Questions already open under the in-dialogue rule when the migration is applied keep a matching hash: for them the old and new due rules return the same event, because no assessment row has been written for them yet.

## Verification required

Follow the [Supabase release workflow](supabase-release-workflow.md) and EA-19:

- **SQL**, Red/Green against a restored baseline: due for every learner-owned route to Covered; not due for Partial, Needs review or a manual edit; one open question per target; no feedback gate; Guard blocks preparation and holds answers without using an attempt; a passed target is not due again in the same visit and is due at the next; a question sent in visit A and passed at visit B's exit makes its target due only from visit C; a question cancelled in the current visit does not block a new one; `start_learner_visit_v1` is idempotent per key; with no recorded visit, a previously passed target is not due; a failed target is not due; the visit function's role permissions; hash consistency as above.
- **Edge**: `join_room` with a `visit_key` records one visit for the learner, none for an observer and none without a key; repeating the call with the same key records nothing new.
- **AI context**: a lifecycle test in which the tutor sends a question, the learner sends an ordinary message, and the next AI request has no open question in its history and no invite-a-selection rule; ended results from an earlier exit remain. Rerun the existing assessment-dialogue evaluation cases and `npm run test:contract:tutor-behavior`, since the rule text changes.
- **React**: hiding, composer and rating gates; the pop-up flow, retry, Next and Leave; Guard waiting text; `beforeunload`; unchanged tutor and observer views.
- **Staging browser journeys** with controlled provider responses, and one manual real-model journey. No new semantic evaluation cases.

## Release plan

Exit assessment changes deployed server behavior, so it follows [Mandatory Server Delivery](../../AGENTS.md#mandatory-server-delivery) and the [Supabase release workflow](supabase-release-workflow.md) through production. Staging verification is an intermediate state; G-78 closes only after production verification.

- **Release owner:** the agent implementing issue #46 (Claude), as for earlier batches. It holds the staging [project lease](agent-coordination.md) from deployment through staging acceptance, and owns repair through the [failure repair loop](supabase-release-workflow.md#failure-repair-loop).
- **Batch record:** `doc_update_record/documentation_update_record_v<date>_exit_time_assessment.md`, created with the implementation PR. It records member commits, merge status, exact SQL, Edge and frontend artifact hashes, staging evidence, outstanding production checks and the release trigger.
- **Changed contracts:** the eligibility functions and visit table (SQL); `join_room` with `visit_key` (Edge); the learner room view, exit pop-up and AI request context (frontend).
- **Inherited dependencies, same owner:** `assessment-api` imports `src/services/ecologicalTutorCall.ts`, which also holds `ASSESSMENT_DIALOGUE_POLICY`. Changing the policy therefore changes the Edge bundle's inputs, and the Edge function is redeployed and hashed with this batch even where its own code is unchanged. Other imported shared modules (`transferAssessmentOrchestrator.ts`, `assessmentValidation.ts`, `assessmentAnswerParser.ts`, `assessmentRendering.ts`, `learningProgressTransitions.ts`, `aiModels.ts`) are not changed; their hashes are recorded to confirm it.
- **Order:** SQL migration, then `assessment-api`, then the frontend, in both environments. The old frontend keeps working against the new SQL and Edge function: `visit_key` is optional, and without a recorded visit nothing is re-offered (see eligibility above).
- **Staging acceptance:** the restored-baseline migration checks above, then live journeys on staging with persisted-row assertions and cleanup:
  - tutor sends questions for two targets, one reached from Pending and one from Partial; the learner chats with no question visible and an unlocked composer;
  - the learner leaves through the room navigation, answers one question correctly and one incorrectly twice, and sees the result texts;
  - Guard on at exit holds the answer with the waiting text, and Guard off grades it;
  - a reload starts a new visit and a passed target is offered again; within the same visit it is not;
  - tab close shows the browser prompt;
  - an observer's and the tutor's views are unchanged;
  - an AI suggestion after an unseen question does not mention it.
- **Production acceptance:** after the merge-before-production gate, apply the exact SQL and deploy the exact Edge and frontend artifacts. Verify the function definitions, the visit table and its permissions. Run one live learner journey: questions are hidden, answered in the exit pop-up, graded, the result messages are persisted, and the tutor's view is unchanged. Clean up fixtures and record both environments' versions and evidence in the batch record.
- **Rollback:** redeploy `assess-in-dialogue`'s frontend and Edge function, and apply a migration that restores its function definitions. The visit table can stay; nothing reads it then. Under the restored due rule, open exit questions for targets reached from Pending or by spontaneous transfer no longer match their snapshot hash and could never be graded, so the restoring migration cancels every open question whose hash no longer matches, with one closure message each, as `20261014000000_final_assessment_after_understanding.sql` did. Questions whose hash still matches become in-dialogue questions again.
