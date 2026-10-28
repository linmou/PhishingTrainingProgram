# Inference test C

Files read: only prd-tutor-platform.md and constitution-product.md. No other file was opened.

## Q3. Can the room owner manually edit a learning target's progress state in a cyberbullying room?

(a) Yes. The room owner may change any learning target's progress state and add a note. The server refuses anyone else. The change is stored as evidence attributed to the room owner and shows in the panel for the owner and the learner.

(b) FR-44: "Manual progress edits (FR-53) remain available." FR-53: "The room owner can manually change a learning target's progress state and add a note." FR-52: "The server refuses tutor operations from anyone but the room owner." C2: "...or the room owner's recorded manual edit." FR-21 lists "a manual edit (FR-53)" as one of three allowed ways to move a state.

(c) DETERMINED. Minor gap: no rule says whether a manual edit is allowed while Guard is on, or which transitions a manual edit may make. FR-21's transition table does not obviously apply to manual edits.

## Q1. Tutor rejects an AI-prepared transfer assessment draft

(a) Nothing is delivered to the learner. The tutor is shown a message that names the learning target, says its recorded progress may be wrong, and asks the owner to check it and fix it by hand with FR-53 if needed. Whether the assessment stays due is not settled. My default is that it is dropped, because the warning text only makes sense if no assessment will follow.

(b) FR-35: "Rejecting an assessment draft delivers nothing to the learner." FR-35: "...the platform shows a message naming the learning target it was meant to check. The message says the target's recorded progress may be wrong, and asks the room owner to check it and correct it by hand if needed (FR-53)." Glossary, Due: "...until it is delivered, cancelled or completed." FR-33: "the room owner's next request for an AI suggestion returns one assessment draft" when due. FR-32 lists the cancellations (contradiction, wording change) and rejection is not one of them.

(c) Tutor message: DETERMINED. Fate of the assessment: UNDETERMINED. Read literally, rejection is not delivered, cancelled or completed, so the assessment stays due and is offered again at the next request. The warning message implies it is dropped. Missing: an explicit rule saying whether rejection cancels the due state, and whether the reply the tutor writes instead counts as tutor feedback (FR-41). Also missing: whether rejection of an assessment draft is recorded as a suggestion action. FR-51 covers only AI suggestions and character drafts.

## Q2. Open transfer assessment, then the owner switches in-room assessment off

(a) Proposed: the open assessment stays open and answerable to completion. Switching the setting off only stops new ones becoming due or being offered. This avoids a silent drop and a learner stuck with a disabled composer.

(b) FR-31: "In-room assessment controls only transfer assessments." FR-32: "A later contradiction cancels the due transfer assessment; changing the learning target's wording cancels an open one without using an attempt." FR-37: "While the transfer assessment is open, the learner's ordinary messaging is disabled... it reopens when the transfer assessment closes." P4 and NFR-6 cover consistent persisted state.

(c) UNDETERMINED. The cancellation list does not include the setting being turned off. It is not stated whether the learner can still answer, whether the composer reopens, or what happens to the attempts and the result message. The same gap applies when the operator turns assessments off everywhere. Missing: a rule for setting-off while open, either cancel without using an attempt or let it complete.

## Q5. Can a room owner change the profile role to student and become the learner in their own room, or answer an assessment they sent?

(a) The documents do not say. Nothing forbids it. Identity is not authenticated (NFR-4), and FR-12 lets "a student" take an empty seat. Proposed, as an inference only: the server should refuse the room owner taking the learner seat in their own room, to keep one accountable adult separate from the learner (P2).

(b) Glossary, Role: "A role belongs to the user, not to a room." FR-2: "A user can change their display name, role and avatar"; "The user identifier does not change when name or role changes." Glossary, Room owner: "The tutor who created a room." FR-12: "A student can become a room's learner if it has none." FR-37: "The learner can answer only their own open transfer assessment." FR-52: tutor controls belong to the room owner. P2: "One accountable adult, the room owner, oversees each practice." NFR-4: "anyone can act as any user."

(c) UNDETERMINED. Missing: whether the room owner stays owner after the owner's role changes (the glossary defines it as the tutor who created the room, not "a user with the tutor role"). Also missing: any rule that the owner and the learner must be different users, and the server check for it. R1 accepts impersonation risk, but this is self-assignment and not covered.

## Q4. Guard turned on while a transfer assessment is open

(a) Grading is not blocked by anything stated for Guard, so I propose: the attempt is graded and its result message saved (FR-38 and FR-39 are unconditional), but the progress effect of FR-40 is held until Guard ends (FR-22). The learner's composer stays disabled until the assessment closes. The room owner can turn Guard off, edit the learning target's wording to cancel the open assessment without using an attempt, or manually edit progress. There is no direct "cancel assessment" action.

(b) FR-36: "If the transfer assessment is no longer due or Guard is on, delivery is refused." FR-32: while Guard is on the due assessment "waits without being lost." FR-22: "While Guard is on, no learning progress advances." FR-38: "Repeated, concurrent, late or out-of-scope submissions never create extra attempts." FR-39: "Every accepted attempt creates exactly one result message." FR-37: messaging "reopens when the transfer assessment closes." FR-30: the room owner turns Guard on or off at any time. FR-53: manual edits. FR-32 wording-change cancellation.

(c) Grading and result message while Guard is on: UNDETERMINED (gate is stated only for delivery and due state, not grading). Composer stays disabled: DETERMINED (reopens only when the assessment closes; Guard is not a close event). Owner options: INFERRED from FR-30, FR-32 and FR-53. Missing: whether FR-22 pauses the progress effect of a passed or failed assessment, and an explicit owner action to withdraw an open assessment.

## Q7. Raw AI output stored in a table every participant's browser can read

(a) Not acceptable. Raw AI output must not be readable by participants. Store it where only the server and the room owner path can read it.

(b) NFR-3: "The reasoning behind a transfer assessment and raw AI output are never visible to participants." C5: "Private assessment material reaches participants only at its publication point." C1: "No AI-generated text reaches a learner unless the room owner sends it." Glossary, AI draft: "Learners never see AI drafts." FR-35: "Learners never see an assessment draft." P6: a shortcut is not taken when failure causes immediate, uncontrolled harm (the stated example is credentials, so assessment correctness is a softer case).

(c) DETERMINED for assessment-draft raw output (C5 and NFR-3 are explicit). INFERRED for suggestion and character-draft raw output, because NFR-4 accepts that "room data is readable and writable by any client of the app" and does not say whether raw AI output counts as room data. NFR-4 lists only messages and passwords as accepted exposures.

## Q6. A reply sent from a stale browser tab changes the room's Guard state as a side effect

(a) Not acceptable. A send must not change Guard unless the owner's current, explicit Guard action is part of it. A stale tab carrying an old Guard value should be refused or reconciled, not applied.

(b) FR-30: "Guard changes only by the room owner's action; an AI recommendation alone never changes it." NFR-1: "The AI assistant never changes room state on its own." FR-48: "Sending saves the character reply, its suggestion action and the Guard state together." FR-51: records original and final Guard state. P4: record "consistent for everyone". NFR-5: "Concurrent requests resolve to one outcome." NFR-11: outdated app versions are told to reload. FR-42: same state for everyone across tabs.

(c) INFERRED. No requirement covers concurrent tabs changing Guard. FR-48 makes Guard part of the send payload, which is exactly what makes the stale case possible. NFR-11 covers outdated app versions, not stale room state. Missing: a statement that a send either carries an intentional Guard change or leaves Guard untouched, and how a stale Guard value is detected.

## Contradictions and ambiguities between or within the documents

1. Due lifecycle: the glossary says due ends on delivered, cancelled or completed, but FR-35 rejection (with its "progress may be wrong" message) implies a drop that is not listed.
2. NFR-3 (raw AI output never visible) versus NFR-4 (room data readable by any client): scope of "room data" is unclear.
3. Room owner is defined as the tutor who created the room, but roles are user-level and editable (FR-2).
4. FR-22 (no progress advances under Guard) versus FR-38 to FR-40 (grading and outcomes) with no Guard rule for an open assessment.
5. FR-30 (Guard changes only by explicit owner action) versus FR-48 (Guard saved with each send).
6. FR-51 records review only for suggestions and character drafts, not assessment drafts, while FR-35 defines rejection of an assessment draft.
7. The constitution is status draft, while the PRD is final and cites it as root.
