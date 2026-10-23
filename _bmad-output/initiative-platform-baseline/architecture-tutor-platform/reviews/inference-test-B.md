# Inference test B

Files read: only prd-tutor-platform.md and constitution-product.md. No other file was opened.

## Q7. Raw AI output in a table every participant's browser can read

(a) Not acceptable as written: raw AI output must never be visible to participants. But NFR-4 accepts that "room data is readable by any client", so it is unclear whether raw AI output counts as room data. I treat NFR-3's explicit rule as more specific, so the table must not be readable by participants.

(b) NFR-3: "The reasoning behind a transfer assessment and raw AI output are never visible to participants." Also C1 (no AI text reaches a learner unless the owner sends it), the glossary ("Learners never see AI drafts"), and C5 (private assessment material). NFR-4's accepted consequences list only impersonation and reading messages and passwords. NFR-4 also says "room data is readable and writable by any client of the app".

(c) INFERRED. "Visible" vs "readable by the browser" is not defined, and NFR-4 is broad. Missing: a statement of whether NFR-3 outranks NFR-4 for stored-but-unrendered data, or whether raw AI output is listed as an accepted limitation. The documents never state that raw AI output is excluded from the NFR-4 acceptance.

## Q6. Reply from a stale tab changes Guard as a side effect

(a) Not acceptable. Guard changes "only by the room owner's action" after confirmation. A reply sent from a stale tab carries an old Guard value the owner did not choose. The documents do not say how stale tab state is handled.

(b) FR-30: "Guard changes only by the room owner's action; an AI recommendation alone never changes it." FR-30 also says the owner turns Guard on or off "after confirming". Against that: FR-48 ("Sending saves the character reply, its suggestion action and the Guard state together") and FR-51 (records original and final Guard state) show that send carries a Guard value. NFR-5 says "Concurrent requests resolve to one outcome". P4 requires consistency for everyone.

(c) INFERRED. Missing: whether send is itself a legitimate Guard action (FR-48 lists "override Guard" as part of review), and any rule on stale-state conflicts. NFR-11 covers only outdated app versions, not stale tab state. A reasonable engineer could say a send is an owner action and the last write wins.

## Q5. Room owner changes profile role to student, then becomes learner or answers own assessment

(a) Nothing in the documents forbids it. The role is user-level and changeable, and a student takes the learner seat if it is free. Whether the person is still the room owner after the role change is undefined. It would undermine adult supervision, but no rule says so.

(b) FR-2: user can change "display name, role". Glossary: "A role belongs to the user, not to a room." "Room owner — The tutor who created a room." FR-12: "A student can become a room's learner if it has none." FR-37: the learner answers "their own open transfer assessment". FR-52: only the room owner uses tutor controls. P2: "One accountable adult, the room owner, oversees each practice". C1 is satisfied only formally, because the owner would send the text to themself.

(c) UNDETERMINED. Missing: whether room ownership persists after the owner stops being a tutor, whether the owner may take the learner seat in their own room, and whether the owner may answer an assessment they sent. FR-12 is silent on the owner, and the glossary ties ownership to being a "tutor".

## Q4. Guard turned on while a transfer assessment is open

(a) Grading and result message: probably yes, because no rule suspends grading under Guard. The composer stays disabled, because it reopens only "when the transfer assessment closes". The owner can only cancel the open assessment indirectly by changing the learning target's wording. Whether a pass or fail moves learning progress while Guard is on is contradictory.

(b)
- Grading and result message: FR-38 and FR-39 have no Guard exception. FR-36 and FR-32 only block delivery of a new assessment, or make a due one wait. FR-32 "While Guard is on, another transfer assessment is open, or tutor feedback is outstanding, the due transfer assessment waits" is about due assessments, not open ones.
- Progress under Guard: FR-22 says "While Guard is on, no learning progress advances", but FR-40 says a pass makes the target complete and a fail moves it to Needs review.
- Composer: FR-37 "While the transfer assessment is open, the learner's ordinary messaging is disabled with an explanation; it reopens when the transfer assessment closes."
- Owner action on the open assessment: FR-32 "changing the learning target's wording cancels an open one without using an attempt". Owner replies and Guard replies (FR-30) are allowed. FR-53 allows manual progress edits. No explicit "cancel assessment" control exists.

(c) Mixed.
- Grading and result message while Guard is on: INFERRED.
- Composer stays disabled: DETERMINED, by the FR-37 quote. Whether Guard changes this is not addressed.
- Progress effect of the result under Guard: UNDETERMINED (FR-22 vs FR-40).
- Owner options: INFERRED (wording-change cancel only, plus manual progress edit).

## Q3. Cyberbullying room: can the room owner manually edit a learning target's progress state?

(a) Yes.

(b) FR-44: "Learning targets cannot be edited, removed or varied by scenario. Manual progress edits (FR-53) remain available." FR-53: "The room owner can manually change a learning target's progress state and add a note." FR-21 lists the manual edit as a permitted transition path. C2: "the room owner's recorded manual edit".

(c) DETERMINED.

## Q2. Open assessment question, then the owner turns in-room assessment off

(a) The documents do not say. Nothing makes the open question close, and nothing stops the learner from answering it.

(b) FR-31: in-room assessment "controls only transfer assessments", and the owner "can turn it off for a room". FR-32 lists the cancel triggers: a later contradiction cancels the due assessment, and a wording change cancels an open one. Turning the setting off is not listed. FR-37 says messaging stays disabled until the assessment closes. The glossary says Covered means complete where assessments are unavailable, including "phishing rooms with in-room assessment off", but that does not say what happens to an assessment already open.

(c) UNDETERMINED. Missing: a rule for open and due assessments when the setting turns off (cancel, let it finish, or keep it open), and whether answers are still accepted. A reasonable engineer could pick either, and the learner's composer lock depends on the choice.

## Q1. Tutor rejects an AI-prepared assessment draft

(a) Nothing is delivered. The tutor is shown a message naming the learning target, saying its recorded progress may be wrong, and asking the tutor to check it and correct it by hand. Whether the assessment stays due and is offered again is contradictory.

(b)
- Message: FR-35 "Rejecting an assessment draft delivers nothing to the learner." and "the platform shows a message naming the learning target it was meant to check. The message says the target's recorded progress may be wrong, and asks the room owner to check it and correct it by hand (FR-53)."
- Still due or re-offered: glossary "Due ... until it is delivered, cancelled or completed". Rejection is not listed as a cancel trigger in FR-32. FR-33 says that when a transfer assessment is due, "the room owner's next request for an AI suggestion returns one assessment draft". Together these suggest it stays due and is re-offered.
- Dropped: the FR-35 message (progress "may be wrong", fix "by hand") implies the target is no longer going to be checked, so it implies the assessment is dropped. Otherwise a manual correction would have no purpose.
- FR-41 requires tutor feedback only after an assessment "ends"; whether a rejected draft ends it is not stated.

(c) The message is DETERMINED. The fate of the assessment is UNDETERMINED: FR-32 and the glossary imply it stays due and is re-offered, while FR-35 implies it is dropped. Missing: an explicit statement of whether rejection cancels the due assessment, and whether the tutor reply written "instead" counts as the tutor feedback of FR-41.
