# Reconciliation: PRD and product constitution against the architecture spine

Intent: list what `architecture-tutor-platform.md` fails to carry from `prd-tutor-platform.md`, the product constitution (C1-C6, R1-R8), `reconcile-AB.md` and `reconcile-CD.md`. Items already tracked as addendum gaps (G-1..G-35) are skipped unless the spine contradicts or enshrines them. Date: 2026-10-22. Total: 20 gaps (9 contradictions, 7 missing decisions, 4 quiet requirements). Evidence for as-built facts comes from `code-sweep-1..3`.

## A. An AD contradicts a PRD requirement or constitution rule

**X-1. AD-2 keeps a browser-side judging path (C3, NFR-2, AD-1).**
AD-2 says the browser-side judging path "serves old rooms only". Sweep 2 shows the legacy path inserts into `messages` from the browser and runs browser-triggered progress analysis. C3 says the browser never decides progress, and NFR-2 says the browser never changes it directly. AD-1 says the client never updates progress tables. The spine cannot hold AD-1 and AD-2 together without a recorded exception. Only the owner can authorize an exception to C3. Decide: record a bounded exception for old rooms (naming the owner decision), or retire the path.

**X-2. AD-2's routing condition contradicts FR-18, FR-31 and R7/OQ-14.**
AD-2 keeps the condition "cyberbullying, or an assessment answer, or transfer learning enabled on `transfer_v1`". So a phishing room with in-room assessment off takes the legacy path. FR-18, FR-31 and R7 require learner-owned, server-judged targets whether in-room assessment is on or off. G-24 records the defect, but AD-2 turns it into a rule and forbids new code on the legacy path, which blocks the fix. Change the AD to the target state (route by practice type and room-owned targets, not by the assessment flag), or mark it as a known deviation.

**X-3. AD-9 says manual progress edits are phishing only; FR-44 and FR-53 say otherwise.**
FR-44: "Manual progress edits (FR-53) remain available" in cyberbullying rooms. FR-53 and C2 have no practice-type limit. FR-45's closed operation list omits manual edits. The code (sweep 1, M21:1533) refuses them. The PRD contradicts itself, and the spine silently picked the code side. Neither the addendum nor the open questions record this. Needs an owner decision, then one of FR-44/FR-45/FR-53 or AD-9 changes.

**X-4. AD-5 (guard-deferred answers are not graded) against FR-37, FR-38, FR-39 and reconcile R-1.**
AD-5: under Guard an answer is not graded, uses no attempt and gets no result message. FR-37 disables the learner's ordinary messaging while an assessment is open. FR-39 says every accepted attempt gets a result message. Result: a learner can answer, get no reply and be unable to write until Guard ends. Extract B C9.4 and reconcile R-1 claim the opposite behavior (graded, progress deferred). Sweep 1 confirms both exist: not graded when Guard is seen first, graded with `progress_deferred` when Guard flips in mid-call. The spine states one half as the rule. R-1 is still open. The architecture decision belongs here: grade-and-defer progress, or refuse the submission up front.

**X-5. AD-6 accepts a stalled or locked-out assessment (FR-37, FR-31, CD-08, R-10).**
AD-6 lets an open assessment stay answerable when the room toggle goes off, and stall when the operator flag goes off. It carries an assumption tag only for the room toggle. With the operator flag off, the open assessment cannot be answered or graded (sweep 1 (b)), and FR-37 keeps the learner's composer disabled. That is a lockout with no exit, which breaks NFR-7 and P5. CD-08 and R-10 raise it, but G-1..G-35 do not record it. The spine needs a rule: cancel with a closure message, or re-enable the composer.

**X-6. AD-7 overstates repeat-safety (NFR-5, FR-38).**
AD-7: "every mutating operation carries a request id; ... a retry creates no duplicate". Sweep 1 (e): the client creates a fresh request id per call, so a retry or second tab can create a second answer message for one open assessment (`post_assessment_message_v2` checks only lifecycle). Grading is deduplicated on the answer message id, so attempts are safe, but messages are not. NFR-5 says repeating any request produces no duplicate effect. AD-7 should name the real unit of dedupe and record the exception, or require a client-stable request id.

**X-7. AD-3's "due is derived from progress history" can make a manual edit trigger an assessment (FR-32, FR-53).**
FR-32: due only when the learner moves a target Partial to Covered by demonstrating understanding. AD-3 derives due from the item's progress history, and `edit_room_checklist_v1` writes to the same history and item row. The spine does not say that the derivation filters by event source. A manual Partial to Covered edit could make an assessment due (R-2(b) raised the same question for the PRD and it is still open). State in AD-3 that only learner-judged events count toward due.

**X-8. AD-12 says result and closure messages are inserted only by database functions; the policy posture says any client can insert.**
Sweep 3: `messages` has an `ALL ... USING true` policy for public. The only protection is a header-checking write gate and unique indexes. Any anon-key holder can insert a message styled as a result message. FR-39 ("cannot be edited by participants"), NFR-3 and C5 need the integrity claim to be true. NFR-4 accepts open writes, so the PRD itself has two statements that disagree. The AD should either add a guard (trigger rejecting result/closure message types from non-service roles) or state the accepted exposure as NFR-4 and drop the "only" claim.

**X-9. Deferred: "no request timeout on AI calls" against NFR-7 and FR-25.**
FR-25/FR-33 and NFR-7 require a clear error when AI output is missing. A call with no timeout can hang the owner's request with no error. Deferring it is a P6 call, but then NFR-7 needs a recorded exception. Also check the retry rule: the AD-7 text says the Edge Function retries "up to three times", which with no timeout multiplies the hang.

## B. PRD requirements or constraints needing an architectural decision that has none

**M-1. C4 / FR-9 / R2: room deletion has no AD.**
C4 and R2 allow deletion only by the owner's confirmed room delete, and no other action. FR-9 says deletion removes everything, including private assessment records. The spine has no rule for: the delete path (direct client delete, which AD-8 cannot gate, or an RPC), cascade into `private.*` (ER diagram shows no cascade), and removal of the remaining destructive path `clear_room_chat_history_v1` (sweep 1: it deletes assessments, attempts and messages; G-21 plans to remove it but the spine does not say so). C4 is bound by no AD. Add one: "one deletion path, owner-checked in SQL, cascading to private".

**M-2. C1 / NFR-1: no AD for how AI output reaches a learner.**
C1 is the first non-negotiable constraint. Only AD-8 lists it, and AD-8 is about ownership checks. The needed rule: Edge Functions return drafts to the caller and never write a tutor-role message; the only publication path is the owner's reviewed send (`send_reviewed_tutor_response_v4`, `send_reviewed_transfer_assessment_v1`). Sweep 3 lists a PUBLIC-callable legacy `send_reviewed_tutor_response` as well, which the spine does not mention, so the "only path" claim is currently untrue. NFR-1 appears in no AD.

**M-3. FR-52 / FR-24 / FR-30 / FR-28: AD-8 cannot reach the direct-write controls.**
AD-8 moves ownership checks into RPCs. Many owner-only controls are direct writes to open tables (the diagram shows direct writes to `rooms`, `messages`, `sessions`): Guard toggle, AI configuration, in-room assessment toggle, tutor reply insert, room delete. No SQL check can run on an `ALL/true` table. So FR-52's "server refuses" and FR-30's "Guard changes only by the owner" have no realizable mechanism. The spine needs to say which controls must move behind RPCs (target) and which stay open under NFR-4 (accepted), instead of listing "the remaining RPCs" as deferred. Sweep 3 also shows `assertTeacher` checks the role, not ownership, and `analyze_message` has no tutor check.

**M-4. FR-19 / FR-20 / FR-44 / FR-46: no AD for the judging pipeline.**
Requirements with no decision: judge in message order after all earlier learner messages; all-targets-or-nothing for one message (FR-20); evidence must quote the learner message and tutor/character/pre-populated text can never be evidence (C2); catch-up on join; target setup exactly once across tabs (FR-44). AD-1/AD-7 cover the event write and its dedupe key, not these. AD-4/AD-5 also leave a hole: the learner answer is saved in one transaction and graded later by "client catch-up on room load or the owner's review read". If neither occurs, the answer stays ungraded, and nothing in the spine says who must complete it. FR-42 (same state for everyone) depends on that.

**M-5. FR-12 / NFR-2: the learner-seat invariant has no AD.**
NFR-2 lists the learner seat as server-decided. The capability map assigns `join_room_v1` to AD-8 only, which concerns ownership. Nothing says "at most one learner per room is a database constraint". G-12 notes a direct session insert fallback when the trusted join fails, which would bypass the rule. State the invariant and say whether the fallback is allowed to survive.

**M-6. FR-26 / NFR-9 / NFR-10: the evaluation gate and change control are not in the Release convention.**
NFR-10: a model, shared prompt or judge change must be re-evaluated for every practice type that uses it; constitutions change only by human decision. The spine's Release row lists staging, migrations and merge order, with no evaluation step. AD-10 places model configuration in shared `src/` (good) but states no rule that changing it triggers `evals/` runs, and says nothing about the shared judge touching cyberbullying (R-7 asks whether the criterion is "run" or "pass").

**M-7. FR-41 / FR-32: the tutor-feedback gate and offer order have no AD.**
AD-3 lists the conditions that block re-offering (open assessment, terminal feedback pending, Guard) but does not say how "feedback pending" is derived: from what message, with what parent link (R-4), and how "one at a time, in what order" (R-5) is chosen. Sweep 1 shows these checks sit in `prepare_transfer_assessment_context_v1`. The spine should record that this is the single place, since the PRD behavior is otherwise unspecified (R-4, R-5).

## C. Quiet requirements the AD structure dropped

**Q-1. FR-45 closed operation set per practice type (P7).**
AD-9 says behavior branches on `practice_type` but gives no mechanism for refusing unsupported operations in cyberbullying rooms (assessments, Quick Adjust). No AD owns the allow-list, so "Predictable behavior" and the "closed set of supported operations" from P7 are carried by nobody.

**Q-2. P8 / FR-48 / FR-51: the research record has no owner.**
P8 grounds tutor-review records, ratings and exports. The spine has no decision on how the suggestion action, final text, Guard state and the sent message are written together (FR-48: "saves the character reply, its suggestion action and the Guard state together"). The phishing path writes `ai_suggestion_feedback` from the client separately (sweep 2), so atomicity and "every draft is recorded" (FR-51) are not guaranteed. Related: drafts are browser-only and lost on reload (R-17, CD-13). The spine should say whether the record is best-effort (accepted under P6) or server-owned.

**Q-3. FR-16 / R8: the rating gate has no enforcement point.**
The gate is a constitution rule (R8) and a PRD requirement for both practice types. It is a client check. Server enforcement is absent; messages are open. The spine does not say it is client-only by decision. With P6 that is acceptable, but it has to be recorded, because G-23 asks for a test and the AD "Ownership is checked in SQL" implies the opposite style.

**Q-4. NFR-3 visibility promises beyond the answer key.**
NFR-3 also promises: reasons and instruction labels visible to the room owner only, raw AI output never visible. AD-12 covers only the answer key and learner explanation. Reasons and labels are stored in or beside open tables (`ai_suggestion_feedback` is `ALL/true`, sweep 3), and the export gate uses the global role (G-32). The spine should list what is private by construction (`private.*`, raw provider payloads) and what NFR-4 accepts as exposed, so a new feature does not assume owner-only data is protected.

## Counts

| Class | Count |
| --- | --- |
| A. AD contradicts PRD or constitution | 9 |
| B. Requirement or constraint without a decision | 7 |
| C. Quiet requirement dropped | 4 |
| Total | 20 |
