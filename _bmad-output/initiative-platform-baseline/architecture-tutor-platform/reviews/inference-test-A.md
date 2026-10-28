# Inference test A

Files read: only prd-tutor-platform.md and constitution-product.md (both in full). No other file was opened.

## Q1. Tutor rejects an assessment draft

(a) Nothing is delivered to the learner. The tutor is shown a message naming the target the assessment was meant to check. The message says the target's recorded progress may be wrong and asks the tutor to check it and correct it by hand if needed. Whether the assessment stays due, is re-offered at the next AI suggestion request, or is dropped is not stated.

(b)
- FR-35: "Rejecting an assessment draft delivers nothing to the learner." and "the platform shows a message naming the learning target ... says the target's recorded progress may be wrong, and asks the room owner to check it and correct it by hand if needed (FR-53)."
- Glossary "Due": due "until it is delivered, cancelled or completed". Rejection is not one of these.
- FR-32 lists the cancel triggers: a later contradiction, or a wording change to the learning target. Rejection is not listed.
- FR-33: "When a transfer assessment is due, the room owner's next request for an AI suggestion returns one assessment draft instead."
- Reading these literally, the assessment stays due and is re-offered. But the FR-35 message ("progress may be wrong") implies the target is being treated as if it was never validly Covered. That suggests rejection might be meant to drop the assessment.

(c) Message content: DETERMINED. Due-state after rejection: UNDETERMINED. Missing: a rule saying whether rejection keeps, cancels or defers the due state. FR-32 and the glossary do not list rejection, and FR-35 hints at the opposite. FR-41 (tutor feedback) is also silent on whether the tutor reply written instead of the draft counts as feedback.

## Q2. Open question, then the owner turns in-room assessment off

(a) The documents do not say. The open question is neither cancelled, nor kept answerable, nor hidden.

(b)
- FR-31: "In-room assessment controls only transfer assessments." It says what turning it off does to AI suggestions and Guard, not what it does to an open question.
- FR-32: only a contradiction or a wording change cancels an open or due assessment.
- FR-37: the learner's messaging is disabled "while the transfer assessment is open ... reopens when the transfer assessment closes."
- Left unresolved, the learner can be locked out of messaging with no defined way to close the assessment.

(c) UNDETERMINED. Missing:
- The effect of the setting change on an open assessment: cancel, let it finish, or refuse the change.
- Whether answers are still accepted.
- Whether a cancelled assessment uses an attempt (FR-32 says "without using an attempt" only for the wording-change case).
- Whether due assessments are dropped or merely paused.

## Q3. Cyberbullying room: owner manually edits a learning target's progress state

(a) Yes.

(b)
- FR-53: "The room owner can manually change a learning target's progress state and add a note."
- FR-44: "Learning targets cannot be edited, removed or varied by scenario. Manual progress edits (FR-53) remain available."
- FR-52 lists "manual learning progress edits" as a room owner control.
- C2: progress changes "only from the learner's own contributions or the room owner's recorded manual edit."
- Tension: FR-45 says a cyberbullying room supports "exactly" a list of operations that omits manual edits. FR-44 explicitly resolves this in favour of allowing them.

(c) DETERMINED (with a note that FR-45's "exactly" list should include manual edits).

## Q4. Guard turned on while a transfer assessment is open

(a)
- Grading, result message and Guard: not stated.
- Composer: it should stay disabled, because the open assessment is what disables it, not Guard.
- Owner action on the open assessment: no stated way to cancel or close it. Wording-change cancellation (FR-32) and manual progress edits (FR-53) are the only indirect levers.

(b)
- FR-32: "While Guard is on, another transfer assessment is open, or tutor feedback is outstanding, the due transfer assessment waits." This covers due assessments only.
- FR-36: delivery is refused if Guard is on. This covers delivery only, not an already-open assessment.
- FR-22: "While Guard is on ... no learning progress advances."
- FR-40: pass makes the target complete and fail moves it to Needs review. These are progress changes, so FR-22 and FR-40 conflict if grading continues under Guard.
- FR-38 and FR-39: grading and "Every accepted attempt creates exactly one result message." Neither mentions Guard.
- FR-37: "While the transfer assessment is open, the learner's ordinary messaging is disabled ... it reopens when the transfer assessment closes."
- FR-30 gives the owner Guard control "at any time".
- FR-30 says "While Guard is on, the room owner's tutor replies are shown as 'Security Supervisor'".

(c)
- Composer stays disabled: INFERRED.
- Grading and result message under Guard: UNDETERMINED. Missing: whether an answer given under Guard is accepted, rejected or held, and whether the FR-40 progress effect is deferred like other events in FR-22.
- Owner can act on the open assessment: UNDETERMINED. Missing: any owner cancel or withdraw operation, and the Guard-on versus open-assessment interaction.

## Q5. Room owner changes profile role to student and becomes the learner, or answers their own assessment

(a) Nothing forbids it, so it is unclear. FR-2 allows the role change. The room owner is defined as the tutor who created the room, but ownership is not stated to be lost or kept on a role change. FR-12 lets any student take an empty learner seat.

(b)
- FR-2: "A user can change their display name, role and avatar."
- Glossary "Role": "A role belongs to the user, not to a room."
- Glossary "Room owner": "The tutor who created a room."
- FR-12: "A student can become a room's learner if it has none."
- FR-37: "The learner can answer only their own open transfer assessment."
- FR-52: only the room owner uses tutor controls.
- P2: "One accountable adult ... decides what reaches the learner."
- NFR-4 accepts that anyone can act as any user.
- No FR forbids the owner from being the learner, or says what happens to ownership on a role change. The intent of P2 (a supervisor distinct from the learner) suggests no, but no rule says so.

(c) UNDETERMINED. Missing:
- Whether room ownership survives a role change.
- A rule that the room owner cannot also be the learner.
- A rule for a role change while owning rooms.

## Q6. A reply from a stale tab changes Guard as a side effect

(a) Not acceptable. Guard must change only by the owner's deliberate, confirmed action.

(b)
- FR-30: "Guard changes only by the room owner's action", and the owner can turn it on or off "after confirming".
- FR-48 and FR-51: a send saves the reply "and the Guard state together" and records original and final Guard states. This is the plausible mechanism for the side effect.
- NFR-11: an outdated browser "is told to reload, rather than writing data under old rules."
- P4 and NFR-5: concurrent requests resolve to one consistent outcome.
- A stale tab that silently reverts or sets Guard is not a confirmed owner action. "An AI recommendation alone never changes it" rules out one side effect path but does not directly name this one.

(c) INFERRED. A reasonable engineer could argue the stale tab is still the owner's own action. Missing: an explicit rule that a send must not write Guard unless the owner changed it in that send (the cyberbullying "override Guard" in FR-48 is the one stated exception).

## Q7. Raw AI output stored in a table every participant's browser can read

(a) Not acceptable under NFR-3, though NFR-4's accepted-risk language creates some ambiguity.

(b)
- NFR-3: "The reasoning behind a transfer assessment and raw AI output are never visible to participants."
- C5: private assessment material reaches participants only at its publication point.
- NFR-2: private transfer-assessment data is decided on the server.
- NFR-4: "room data is readable and writable by any client of the app", and the accepted consequences list only identity impersonation and reading "any room's messages and password".
- Raw AI output is not named among NFR-4's accepted consequences, and NFR-3 names it as never visible. The specific rule wins. NFR-3's "never visible" is written as a guarantee, and NFR-4 is the carve-out an engineer might try to invoke.

(c) INFERRED, leaning DETERMINED. Missing: an explicit statement in NFR-4 on whether the accepted-risk "room data" includes raw AI output and assessment draft tables, or an explicit exception to NFR-3.
