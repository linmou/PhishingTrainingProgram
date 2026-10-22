---
title: Online Safety Tutor Platform
status: draft
created: 2026-10-22
updated: 2026-10-22
---

# PRD: Online Safety Tutor Platform
*Working title — confirm.*

## 0. Document Purpose

This PRD states what the deployed tutor platform is and must keep doing. It is a brownfield baseline: every requirement below describes behavior intended for the platform as deployed on 2026-10-22, so that new initiatives can be checked against it before they change shared behavior. It is written for the product owner, for whoever plans the next initiative, and for the BMAD skills that derive the architecture spine and the baseline epics from it.

Structure: a Glossary that every later section uses verbatim; Features with globally numbered FRs (FR-1…); cross-cutting NFRs; Non-Goals; Scope; Open Questions and Decisions; and an Assumptions Index. Where current behavior differs from a requirement, the difference is listed in `addendum.md` §C (Known gaps), not hidden in the requirement.

This PRD builds on, and does not restate, these companion documents:

- `tutor-system/docs/ai-behaviors/constitution.md` — the tutoring constitution (phishing only).
- `tutor-system/docs/ai-behaviors/tutor-behavior-specification.md` — tutor behavior requirements T01–T09.6 and G01–G03.
- `tutor-system/docs/ai-behaviors/tutor-response-contract.md` and `transfer-status-response-contract.md` — AI output and learning-event contracts.
- `tutor-system/docs/assessment-result-messages.md` — result-message publication.
- `tutor-system/docs/cyberbullying-practise.md` — cyberbullying scenarios, learning targets and characters.

Legacy requirement IDs (spec-101…104 FR-xxx, cyberbullying R1–R13, QA-TA cases, feature scenarios) are mapped to these FRs in `addendum.md` §A. Source extracts with code and test evidence sit beside this file (`extract-A…D`).

## 1. Vision

Schools use the platform to teach children to recognize and respond to online risks — phishing and scams, privacy exposure, and cyberbullying — by practicing on realistic social-media posts. A tutor runs each room with one learner. An AI assistant drafts what the tutor could say next, and the tutor decides what is actually sent.

The goal is the learner's own understanding and judgment, not compliance or volume of interaction. The AI assistant never speaks to learners on its own, and every decision it proposes can be inspected and overridden by the tutor. Learning progress is tracked per learner from what the learner actually says, and in phishing rooms a short transfer assessment confirms that the learner can apply an idea in a new context.

Two practice types share one platform. In phishing rooms the tutor guides the learner through a suspicious post with AI suggestions. In cyberbullying rooms the tutor supervises AI role-play characters reacting to the learner's messages. Both share rooms, identity, conversation, learning progress, Guard, ratings and exports, which is why changes to one practice type must be checked against the other.

The platform currently runs as a small-scale pilot: students use it under close adult supervision, and ease of use takes priority over authentication. Rooms are single-use and are kept afterwards as pilot data.

## 2. Target Users

### 2.1 Jobs To Be Done

- **Tutor** (school staff or trained facilitator): run a focused practice with one learner; get a good next reply quickly without giving up control; see what the learner has and has not understood; stop disruptive behavior safely; keep a record of the room.
- **Learner** (a student, roughly ages 7–12): practice spotting risks on realistic posts; get feedback in plain language; prove understanding without repetitive quizzing.
- **Observer** (another student, staff member or researcher): watch a room live without taking part; download its export.

### 2.2 Non-Users (current)

- Learners using the platform without a tutor present. No AI output reaches a learner without tutor review.
- Groups of learners sharing one room as active participants. A room has one learner; everyone else observes.

### 2.3 Key User Journeys

- **UJ-1. Ms. Rivera runs a phishing practice room.** Ms. Rivera joins as a tutor, creates a room from the "account alert" template, and keeps in-room assessment on. Jamie joins as the learner, rates each of her tutor replies, and writes about the post. For each of Jamie's messages Ms. Rivera asks for an AI suggestion, edits it, and sends it. The Learning Progress panel shows Jamie's five learning targets moving from Pending to Partial to Covered. When Jamie reaches Covered on a learning target after being Partial, a transfer assessment becomes due and her next request for an AI suggestion returns an assessment draft; she reviews it and sends it. Jamie answers wrong once, then right; a result message records each attempt. **Edge case:** Jamie writes "I'd just click it to check" — the AI suggestion leads with protective instruction before any question.
- **UJ-2. Mr. Okafor supervises a cyberbullying role-play.** He creates a cyberbullying room from one of the pinned scenarios and edits one line of its pre-populated dialogue. When Lina joins, her five shared learning targets are set up automatically. Lina writes a message; Mr. Okafor requests a character draft, switches the character from "bully" to "victim", shortens the text, and sends it. Lina sees the character reply under the character's persona name and rates it before writing again.
- **UJ-3. Dana observes and exports.** Dana joins as an observer, opens a running room read-only, and watches messages appear live. At the end she downloads the JSON export, which contains the conversation, ratings and result messages but no private assessment material.
- **UJ-4. A learner tests limits.** Sam repeatedly posts insults instead of answering. The AI suggestion recommends Guard; Ms. Rivera accepts it, and her tutor reply names the behavior and what needs to change without insulting Sam. Sam's learning progress does not advance while Guard is on. When Sam makes a real attempt, the next AI suggestion recommends turning Guard off and Ms. Rivera does so.

## 3. Glossary

**People and access**

- **Role** — Tutor, student or observer, chosen when joining. A role belongs to the user, not to a room.
- **Tutor** — A user with the tutor role.
- **Room owner** — The tutor who created a room. Only the room owner can use tutor controls in that room.
- **Student** — A user with the student role.
- **Learner** — The one student who holds a room's learner seat. A room has at most one learner, who keeps the seat for the room's whole life.
- **Observer** — A participant who can view a room and download its export but cannot post: a user with the observer role, or a student who entered a room that already has a learner.
- **Participant** — Anyone in a room: the room owner, the learner or an observer.
- **Application identity** — The user record selected by entering a display name and a role. It identifies a user but does not authenticate them (NFR-4).
- **Operator** — The person who manages the deployment and its settings.

**Rooms**

- **Room** — A single-use practice space with one practice type, one scenario, one room owner, at most one learner and any number of observers. Rooms are kept after use as pilot data.
- **Practice type** — `phishing` or `cyberbullying`. Chosen when a room is created and never changed.
- **Scenario** — What a room is built on: a post with its image, its original poster and its pre-populated dialogue. Cyberbullying scenarios come from a pinned catalog; the UI calls them "situations".
- **Original poster** — The name and avatar the scenario's post is shown under: the room owner's profile or a custom name.
- **Pre-populated dialogue** — Scripted comments stored with the scenario and shown under the post. They are context only: they are not messages, are never rated, and never count as learner evidence.
- **Template** — A global, centrally managed preset that pre-fills room creation for one practice type.
- **Test room** — A room created from the test-room area for behavior demos and testing. Test rooms are hidden from the room lists of tutors, students and observers.

**Conversation**

- **Message** — A saved entry in a room's conversation, written by the tutor, by the learner, or by the server (result messages). The UI calls messages "comments".
- **Tutor reply** — A message the room owner sends. In cyberbullying rooms every tutor reply is a character reply.
- **Rating** — The learner's judgment of a tutor reply: helpful or unhelpful, plus 1–5 stars.
- **Export** — A TXT or JSON download of a room's record.

**AI assistance**

- **AI assistant** — The room feature that produces AI drafts. The room owner turns it on or off.
- **AI draft** — Any private AI output waiting for tutor review: an AI suggestion, a character draft or an assessment draft. Learners never see AI drafts.
- **AI suggestion** — An AI draft of a tutor reply in a phishing room.
- **Character draft** — An AI draft of a tutor reply in a cyberbullying room, written in one character's voice.
- **Character reply** — A tutor reply in a cyberbullying room, sent from a reviewed character draft and shown under its character's persona name.
- **Character** — The voice of a character draft: `same_age_peer`, `older_peer`, `victim`, `bully` or `educator`, each shown under a fixed persona name (Jerry, Tom, Dylan, Sarah, Ms. Smith). Cyberbullying only.
- **AI role** — The voice of AI suggestions: **Peer** (knowledgeable peer coach) or **Trusted adult**, with adjustable style parameters (communication, cognitive and emotional settings). Phishing only.
- **Quick Adjust** — Regenerating an AI suggestion with changed style parameters.
- **Tutor review** — The room owner's handling of an AI draft: edit, reject, regenerate or send.
- **Suggestion action** — The recorded outcome of tutor review of an AI suggestion or character draft: `accepted`, `modified`, `rejected` or `ignored`.
- **Reason** — The tutor-facing explanation of an AI suggestion, based on what the learner said.
- **Instruction label** — The tutor-facing name of an AI suggestion's instructional move: protective instruction, correction, scaffolding, explanation or consolidation.
- **Guard** — A room-level on/off state for managing deliberate disruption. While Guard is on, tutor replies address the behavior and are shown as "Security Supervisor", and learning progress does not advance. While Guard is off, AI suggestions teach toward learning targets.
- **Tutoring constitution** — The principles (P), hard constraints (H) and priority rules (R) that govern AI suggestions. Phishing only.

**Learning**

- **Learning target** — One observable idea or behavior the learner should show (for example "check the sender's address"). Each learner has their own, whether the learning targets were generated or entered by hand.
- **Learning progress** — A learner's learning targets with their progress states and evidence, shown in the Learning Progress panel.
- **Progress state** — The state of one learning target: **Pending**, **Partial**, **Needs review** or **Covered**.
- **Learning event** — A judged change to one learning target caused by one learner message (for example `demonstrated_understanding`, `contradiction`), as defined in the transfer-status response contract.
- **Evidence** — The quoted part of a learner message that a learning event is based on, or a note recorded with a room owner's manual change.
- **Complete** — A learning target that is Covered with no transfer assessment due for it. Where transfer assessments are not available (cyberbullying rooms, and phishing rooms with in-room assessment off), Covered means complete. Not a separate progress state.

**Transfer assessment** (phishing only)

- **Transfer assessment** — A four-option question that checks whether the learner can apply a learning target in a new context: a concrete case meaningfully different from the scenario the learner discussed.
- **In-room assessment** — The per-room setting that allows transfer assessments.
- **Due** — A transfer assessment is due for a learning target after the learner moves it from Partial to Covered by demonstrating understanding, until it is delivered, cancelled or completed.
- **Assessment draft** — An AI draft of a transfer assessment.
- **Attempt** — One valid answer to an open transfer assessment. At most two.
- **Learner explanation** — The explanation of the correct answer that is published after a second wrong attempt.
- **Result message** — The automatic, fixed-text message the server saves for every accepted attempt.
- **Tutor feedback** — The room owner's own tutor reply to the learner's final attempt, required before that learner can get another transfer assessment.

## 4. Features

### 4.1 Identity and Roles

**Description:** Anyone can start by typing a display name and choosing a role; there is no account, email or password. The same name and role return the same user on any device. The application identity is kept in the browser and restored on reload. Roles decide which dashboard and controls a user sees.

#### FR-1: Join with name and role
A visitor can enter a display name and choose tutor, student or observer to get an application identity.

**Consequences (testable):**
- An empty or whitespace-only name is refused with "Please enter your name" and nothing is created.
- The same normalized name (trimmed, lower-cased, spaces collapsed) with the same role always selects the same user.
- After joining, the user lands on their role's dashboard; reloading the page keeps them signed in.

#### FR-2: Manage own profile
A user can change their display name, role and avatar (from presets).

**Consequences (testable):**
- Changes are saved to the user record and to the browser.
- The user identifier does not change when name or role changes.

**Out of Scope:** custom avatar upload (gap G-1).

#### FR-3: Leave
A user can leave, which removes the application identity from this browser only.

**Consequences (testable):**
- Leaving deletes no user, room, message or learning progress data.

### 4.2 Rooms, Scenarios and Templates

**Description:** Tutors create rooms for one practice type, usually from a template (phishing) or a pinned scenario (cyberbullying). Test rooms are kept apart from teaching. Realizes UJ-1, UJ-2.

#### FR-4: Create a room
A tutor can create a room with a title, description, preset image, original poster, optional password and pre-populated dialogue, and is taken into it as its room owner.

**Consequences (testable):**
- An empty title is refused ("Room title is required").
- A custom original poster requires a name; password mode requires a password.
- With no image chosen, the default preset image is used.

#### FR-5: Fix the practice type at creation
A tutor chooses the practice type when creating a room; it can never change afterwards.

**Consequences (testable):**
- Any attempt to change a room's practice type is refused.
- Every behavior that differs by practice type (AI drafts, learning-event judging, sending, export, available operations) is chosen from the stored practice type, never from client-supplied labels.
- A cyberbullying room or template without a complete scenario is refused.

#### FR-6: Start from a template
A tutor can pre-fill room creation from a template of the selected practice type.

**Consequences (testable):**
- Only templates of the selected practice type are offered.
- Choosing a template sets scenario, image, original poster, password and pre-populated dialogue, and clears stale values.
- Templates are read-only to tutors; there is no "save as template".

#### FR-7: Create a cyberbullying room from a pinned scenario
A tutor can choose a cyberbullying scenario from the pinned catalog, edit its post and pre-populated dialogue, and create a room. Realizes UJ-2.

**Consequences (testable):**
- Creation is refused until a scenario is chosen ("Choose a Cyberbullying situation.").
- Edited pre-populated dialogue keeps each comment's original author.
- If the catalog cannot be loaded, creation stays blocked.
- The AI assistant is on for every cyberbullying room.

#### FR-8: Keep test rooms apart from teaching
A tutor can create test rooms only from the test-room area.

**Consequences (testable):**
- Test rooms do not appear on the tutor's main dashboard, in student room lists or in observer room lists.
- Test-only templates are not offered in the normal creation form.

#### FR-9: Manage own rooms
A tutor can see the rooms they own whenever they return, and delete one after confirming.

#### FR-10: Password-gated entry
A room owner can set a room password; anyone except the room owner must enter it before the room opens.

**Consequences (testable):**
- A wrong password shows "Incorrect password. Please try again." and keeps the prompt open; cancel returns home.
- The room owner is never prompted.

**Notes:** the password is a convenience gate, not a security control (NFR-4).

### 4.3 Room Access and Live Conversation

**Description:** Students find rooms and the first becomes the learner; everyone else watches read-only. Messages, ratings and typing appear live. Realizes UJ-1, UJ-3.

#### FR-11: Find rooms (students)
A student can see active rooms other than test rooms, with title, tutor, description, image and status, search them, and see the list update live.

**Consequences (testable):**
- Status is Available, Observer Available (the room has a learner) or Your Session, with Join, Observe or Rejoin actions.
- With no visible rooms the student sees "No rooms available" and a waiting message.

#### FR-12: One learner per room
A student can become a room's learner if it has none; any later student enters as an observer.

**Consequences (testable):**
- At most one learner per room at any time, enforced on the server.
- The learner keeps the seat for the room's whole life; rooms are not reused for another learner.

#### FR-13: Observe rooms
An observer can list active rooms other than test rooms and open any of them read-only. Realizes UJ-3.

**Consequences (testable):**
- Observers have no message composer and see a read-only notice.
- Observers cannot post, answer transfer assessments or rate.
- Test rooms are not listed (FR-8).

#### FR-14: Live messaging
The room owner and the learner can exchange messages, and every participant sees new messages without refreshing.

**Consequences (testable):**
- A sent message appears for every participant within about 2 seconds.
- Leaving and re-entering shows the full history in order.
- Messages sent while a participant was offline appear when they reconnect.

#### FR-15: Typing indicator
The room owner and the learner can see when the other is typing; the indicator clears when typing stops or after 3 seconds without input.

#### FR-16: Required rating of tutor replies
The learner must rate the most recent tutor reply before sending their next message. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- The gate applies to the learner only; tutors and observers are never gated.
- The gate covers every tutor reply in both practice types, including character replies and replies written without the AI assistant.
- Pre-populated dialogue and result messages are never rated.
- A learner has one rating per message; changing it replaces it. The room owner and observers see rating counts update live.
- If saving the rating fails, the learner is told and their unsent message is kept.

#### FR-17: (withdrawn 2026-10-22)
Clearing chat history is not a supported feature (gap G-21).

### 4.4 Learning Targets and Progress

**Description:** Each learner has their own learning targets. Every learner message is judged against each learning target from the learner's own words, and learning progress moves through four progress states. Guard pauses learning progress. Realizes UJ-1, UJ-2, UJ-4.

#### FR-18: Set up phishing learning targets
The room owner can set up a phishing room's learning targets by generating them from the room's scenario or entering them by hand, and approve them before they are saved.

**Consequences (testable):**
- Generated and hand-entered learning targets are both learner-owned and judged on the server (FR-19, FR-20), whether in-room assessment is on or off.
- Every phishing template supplies exactly five learning targets.
- Custom learning targets are saved as written, without truncation.
- Generation that fails or returns nothing invents no learning targets and says they are unavailable.
- Until learning targets exist, the room owner sees a setup reminder and the learner sees "Waiting for the tutor to set up learning targets."

#### FR-19: Learner-owned learning targets and catch-up
Learning targets belong to one learner. Learning targets saved before the learner joins apply when they join, and that learner's earlier messages are judged oldest first before learning progress is shown.

**Consequences (testable):**
- A learner never receives another learner's learning progress.
- If catch-up fails, the saved learning targets are kept and the room owner can retry; retrying never double-counts.

#### FR-20: Judge each learner message against each learning target
The system judges every learner message against each learning target separately, in message order, using the conversation up to that message.

**Consequences (testable):**
- Only the learner's own message can provide evidence; tutor replies, character replies and pre-populated dialogue are context only.
- A learning event must quote the learner message it is based on; a learning event without valid evidence is discarded.
- A message is judged only after all of that learner's earlier messages.
- If judging fails for any learning target, no learning progress is applied for that message and it stays retryable.

#### FR-21: Progress states and transitions
Learning targets move between progress states only through the learning events defined in the transfer-status response contract.

**Consequences (testable):**
- Pending → Partial on an initial signal; Pending or Partial → Covered on demonstrated understanding; Needs review → Partial on a post-repair signal; any state except Covered → Covered on spontaneous transfer; Partial or Covered → Needs review on contradiction.
- A learning event not allowed from the current progress state is recorded as rejected and changes nothing.

#### FR-22: Guard pauses learning progress
While Guard is on, no learning progress advances; learning events gathered meanwhile are applied when Guard ends, if they are still valid.

#### FR-23: Learning Progress panel
The room owner and the learner can open the Learning Progress panel showing each learning target's progress state and evidence for that learner.

**Consequences (testable):**
- The panel never covers the room owner's AI and send controls on desktop.
- On narrow screens the panel uses the full width.

#### FR-53: Manual learning progress edits
The room owner can manually change a learning target's progress state and add a note.

**Consequences (testable):**
- The change appears in the Learning Progress panel for the room owner and the learner.
- The change is recorded as evidence attributed to the room owner.

### 4.5 Supervised AI Tutoring (phishing)

**Description:** In a phishing room the room owner can ask the AI assistant for an AI suggestion about a learner message. AI suggestions follow the tutoring constitution and the tutor behavior specification, carry a reason and instruction label for the room owner, and are never sent without tutor review. Realizes UJ-1, UJ-4.

#### FR-24: Configure the AI assistant
The room owner can turn the AI assistant on or off for a room and set its AI role and style parameters; settings persist.

**Consequences (testable):**
- With the AI assistant off, no AI draft can be requested.
- Reopening settings shows the saved values.

#### FR-25: Request an AI suggestion
The room owner can request an AI suggestion for a chosen learner message, or the latest one. Realizes UJ-1.

**Consequences (testable):**
- The AI suggestion is visible only to the room owner and is never sent automatically.
- The AI assistant receives the scenario, the complete saved conversation and the learner's learning progress.
- If any part of the conversation cannot be loaded, no AI suggestion is generated and the room owner sees an error; they can still type a tutor reply.
- With no learner message, no AI suggestion is generated.

#### FR-26: Teaching quality of AI suggestions
Every AI suggestion meets tutor behavior requirements T01–T08 and the tutoring constitution's hard constraints H1–H4.

**Consequences (testable):**
- A stated or hypothetical intention to click a suspicious link gets protective instruction before any question (T01).
- Correct partial knowledge is never called wrong; an AI suggestion addresses at most one unmet learning target (T01, T02).
- No praise-only replies, no invented facts, no fabricated personal experience (T03, T04, T06).
- Plain words and short sentences, within the phishing length limit of T08. Length limits are set per practice type (cyberbullying: FR-47).

#### FR-27: Reason and instruction label
Every AI suggestion carries a reason and an instruction label, for the room owner only.

**Consequences (testable):**
- Reasons and instruction labels are never shown to learners.
- Reasons and instruction labels are kept in the room owner's export.
- An AI suggestion whose reason, instruction label and text disagree is not shown; after one repair attempt the room owner gets an error instead.

#### FR-28: Tutor review and send
The room owner can copy, edit, reject or regenerate an AI suggestion, and only the room owner's explicit send publishes a tutor reply.

**Consequences (testable):**
- Sent unchanged records `accepted`; sent after edits records `modified`; rejected records `rejected`; replaced by a new request records `ignored`.
- An empty tutor reply cannot be sent.
- If sending fails, the edited text is kept.

#### FR-29: AI role, and the learner's choice of AI role
The room owner can choose the AI role and its style parameters, including through Quick Adjust. In a room with one student and the AI assistant on, the learner can choose the AI role instead, which then locks it.

**Consequences (testable):**
- The learner's choice is offered only when the AI assistant is on and the room has exactly one student; never to observers.
- Once the learner chooses, the room owner sees the AI role as locked, and regeneration uses it.

#### FR-30: Guard
The AI assistant may recommend Guard for clear deliberate disruption; the room owner decides, and can turn Guard on or off at any time after confirming. Realizes UJ-4.

**Consequences (testable):**
- Mistakes, confusion, frustration and personal questions do not lead to Guard (G01).
- A Guard tutor reply names the behavior, its effect and the needed change, without insults, threats or apology demands (G02, G03).
- A real attempt by the learner, even a wrong one, leads the AI assistant to recommend turning Guard off (G01).

### 4.6 Transfer Assessment (phishing)

**Description:** When a learner moves a learning target from Partial to Covered, a transfer assessment becomes due: a short four-option question that applies the idea in a new context. The room owner reviews and sends it, or rejects it; the learner answers with option controls; the server grades it with two attempts and saves a result message. Tutor behavior requirements T09.1–T09.6 and `assessment-result-messages.md` are the detailed sources. Realizes UJ-1.

#### FR-31: In-room assessment setting
In-room assessment is on by default for every phishing room. The room owner can turn it off for a room, and the operator can turn transfer assessments off everywhere.

**Consequences (testable):**
- In-room assessment controls only transfer assessments. Learning targets, judging and learning progress work the same with it on or off.
- With in-room assessment off, AI suggestions and Guard keep working.

#### FR-32: When a transfer assessment becomes due
A transfer assessment becomes due for a learning target only when the learner moves it from Partial to Covered by demonstrating understanding.

**Consequences (testable):**
- Reaching Covered directly from Pending, or by spontaneous transfer, makes the learning target complete without a transfer assessment.
- While Guard is on, another transfer assessment is open, or tutor feedback is outstanding, the due transfer assessment waits without being lost.
- A later contradiction cancels the due transfer assessment; changing the learning target's wording cancels an open one without using an attempt.
- One Partial → Covered change never produces two transfer assessments.

#### FR-33: Assessment draft instead of an AI suggestion
When a transfer assessment is due, the room owner's next request for an AI suggestion returns one assessment draft instead.

**Consequences (testable):**
- No AI suggestion is generated by that request.
- Generation problems are shown as errors; no placeholder question and no fallback AI suggestion are produced.

#### FR-34: Valid transfer assessments
Every assessment draft — generated or edited — must be a valid transfer assessment before it can be sent.

**Consequences (testable):**
- Exactly four distinct options A–D; one correct option for single-answer, two or three for multiple-answer.
- A question of at most two sentences and 80 words.
- A non-empty learner explanation is required.
- The new context differs meaningfully from the scenario the learner discussed, not just by a name or brand.

#### FR-35: Tutor review of an assessment draft
The room owner can see the learning target, the new context, the question, the options, the correct answer and the learner explanation; edit any of them; and send the assessment draft, or reject it and write their own tutor reply instead.

**Consequences (testable):**
- An edited assessment draft is checked again before sending; an invalid one cannot be sent.
- Learners never see an assessment draft.
- Rejecting an assessment draft delivers nothing; the transfer assessment stays due and is offered again at the room owner's next request for an AI suggestion. `[ASSUMPTION: "wrong timing" means later, not never.]`

#### FR-36: Deliver to the learner
The room owner can send a reviewed assessment draft to the learner; the server rechecks it before saving.

**Consequences (testable):**
- If the transfer assessment is no longer due or Guard is on, delivery is refused.
- Retrying a delivery never creates a second question.
- Delivering a transfer assessment does not change Guard; there is no assessment mode.

#### FR-37: Answer with option controls
The learner can answer only their own open transfer assessment, by selecting options and submitting.

**Consequences (testable):**
- Single-answer questions use one-choice controls; multiple-answer questions use select-all controls; submitting needs a selection.
- Any answer that is not an option selection is refused; there is no typed-answer, clarification or help-request path.
- While the transfer assessment is open, the learner's ordinary messaging is disabled with an explanation; it reopens when the transfer assessment closes.
- Observers and other students cannot answer.
- Each transfer assessment shows the learner's saved attempts.

#### FR-38: Grading and two attempts
The server grades each attempt by exact match with the correct options and allows at most two attempts.

**Consequences (testable):**
- First wrong attempt: one attempt left, learning progress unchanged.
- Right attempt on either try: passed, once.
- Second wrong attempt: failed, once.
- Repeated, concurrent, late or out-of-scope submissions never create extra attempts or change learning progress.

#### FR-39: Result messages
Every accepted attempt creates exactly one result message: "Correct.", "Incorrect. One attempt remaining." or, after the second wrong attempt, "Incorrect. No attempts remaining. Correct option(s): …" followed by the learner explanation.

**Consequences (testable):**
- The correct answer and learner explanation are published only in the second-wrong-attempt result message.
- Result messages are visible to every room participant and included in exports.
- Result messages are written by the server, cannot be edited by participants, and survive reload.

#### FR-40: Effect on learning progress
A passed transfer assessment makes the learning target complete; a failed one moves it to Needs review, and AI suggestions teach toward it again.

**Consequences (testable):**
- After failure the learner can recover through Partial and Covered again, which makes a new transfer assessment in another new context due.
- A complete learning target is not assessed again unless a later contradiction reopens it.
- Failure alone never turns on Guard.

#### FR-41: Tutor feedback before the next transfer assessment
After a transfer assessment ends, the room owner must send tutor feedback before that learner can get another transfer assessment.

**Consequences (testable):**
- Result messages, accepted AI suggestions and ratings are not tutor feedback.
- When several transfer assessments are due, they are offered one at a time.

#### FR-42: Same state for everyone, after any reload
Every participant sees the same transfer assessment, attempts, attempts left and outcome after joining, reloading, reconnecting or using several tabs.

**Consequences (testable):**
- A late or duplicate update cannot reopen a finished transfer assessment.

#### FR-43: AI suggestions after transfer assessments
The AI assistant learns transfer-assessment outcomes only from the saved conversation, and generates no AI suggestion while the learner's result messages are still being saved.

### 4.7 Cyberbullying Practice

**Description:** In a cyberbullying room the learner writes about a pinned scenario, and the room owner replies through character replies. All cyberbullying rooms share five learning targets. Realizes UJ-2.

#### FR-44: Five shared learning targets
Every cyberbullying learner gets the same five learning targets when they join: recognize cyberbullying and its impact; show empathy and support; stand up constructively; avoid reinforcing bullying; choose a safe next step.

**Consequences (testable):**
- Learning targets are set up once per learner and room, even if the learner joins from several tabs.
- Learning targets cannot be edited, removed or varied by scenario. Manual progress edits (FR-53) remain available.
- Only the learner's own messages provide evidence.

#### FR-45: Supported operations
A cyberbullying room supports exactly: save a learner message, judge it against the learning targets, request a character draft, tutor review, regenerate, reject, send, rate, continue, and override Guard.

**Consequences (testable):**
- Transfer assessments and Quick Adjust are refused.
- A learning target is complete when it is Covered.

#### FR-46: Learner messages are saved before they are judged
A learner's message is saved first, then judged against the five learning targets.

**Consequences (testable):**
- If judging fails, the message stays saved.

#### FR-47: Request a character draft
The room owner can request one character draft for the learner's latest message, choosing the character or letting the AI assistant choose.

**Consequences (testable):**
- If the room owner chose a character, the character draft uses it.
- Character drafts are at most three sentences in simple language.
- A request is refused when the AI assistant is off or there is no learner message.

#### FR-48: Review and send a character reply
The room owner can change a character draft's character and text, regenerate it, reject it, override Guard, and send it as a character reply.

**Consequences (testable):**
- The room owner cannot send a tutor reply without first requesting and reviewing a character draft.
- Sending saves the character reply, its suggestion action and the Guard state together.
- Suggestion actions follow FR-28; changing only the character records `modified`.
- The chosen character applies to that character draft only.

#### FR-49: Consistent character identity
Every participant sees a character reply under the same character and persona name, live and after reload; the AI assistant and exports carry the same character.

**Consequences (testable):**
- Sent character replies cannot be edited.

### 4.8 Exports and Interaction Records

**Description:** Every participant can download the room's export; its content depends on role. Tutor review of AI drafts is recorded for later analysis. Realizes UJ-3.

#### FR-50: Download the export
Any participant can download the room's export as TXT or JSON.

**Consequences (testable):**
- The room owner's export additionally includes the tutor-review records of FR-51 and a summary of suggestion actions.
- The learner's export includes their own transfer-assessment attempts.
- Cyberbullying exports include the learner's learning progress for every participant, observers included.
- No export contains private transfer-assessment material beyond what result messages publish.

#### FR-51: Record tutor review of AI drafts
The system records, for every AI suggestion and character draft, the suggestion action, the original and final text, the response time, the context messages, the original and final Guard state, and the instruction label or character.

**Consequences (testable):**
- No IP address or browser information is recorded.
- The records are kept with the room after use.

### 4.9 Room Ownership

#### FR-52: Tutor controls belong to the room owner
Only the room owner can use tutor controls in a room: the AI assistant, tutor review, Guard, learning-target setup, manual learning progress edits, in-room assessment and tutor replies.

**Consequences (testable):**
- Another tutor who opens the room has none of these controls. `[ASSUMPTION: they take part as an observer.]`
- The server refuses tutor operations from anyone but the room owner.

## 5. Cross-Cutting NFRs

- **NFR-1 Human supervision.** No AI-generated text reaches a learner without the room owner's explicit send. The AI assistant never changes room state on its own.
- **NFR-2 Server authority.** Grading, attempt counting, whether a transfer assessment is due, learning progress changes, the learner seat and private transfer-assessment data are decided on the server. The browser never grades or changes learning progress directly.
- **NFR-3 Privacy of private material.** Correct answers and learner explanations stay private until a second wrong attempt (FR-39). The reasoning behind a transfer assessment, raw AI output and AI provider credentials are never visible to participants or present in the browser. Reasons and instruction labels are visible to the room owner only.
- **NFR-4 Identity model and accepted risk.** The application identity identifies users but does not authenticate them, and room data is readable and writable by any client of the app. This is accepted for the current small-scale pilot, in which students use the platform under close adult supervision and ease of use takes priority over authentication. Accepted consequences: anyone can act as any user by typing the same name and role, and any participant can read any room's messages and password.
- **NFR-5 Reliable repetition.** Repeating any request (send, attempt, delivery, judging) produces no duplicate effect. Concurrent requests resolve to one outcome.
- **NFR-6 Persistence.** The application identity, conversation, learning progress and transfer-assessment state survive reloads, reconnects and multiple tabs. Rooms are kept after use.
- **NFR-7 Fail visibly.** When something needed is missing or fails (conversation history, learning targets, AI output, configuration), the user gets a clear error. No placeholder content and no hidden fallback. Known exceptions are listed as gaps in `addendum.md` §C.
- **NFR-8 Live updates.** Messages appear for all participants within about 2 seconds; room lists and ratings update without refresh.
- **NFR-9 Safe and honest AI content.** AI suggestions follow the tutoring constitution's hard constraints: truthful content, no humiliation, honest self-representation and explainable decisions (H1–H4). The tutoring constitution does not govern cyberbullying; character drafts follow the character strategy in `cyberbullying-practise.md`, and NFR-1 applies to them.
- **NFR-10 Behavior change control.** Changing an AI model, a shared prompt or the learning-event judge changes behavior for every practice type that uses it, and must be re-evaluated for each. The tutoring constitution changes only through an explicit human decision; passing evaluations cannot authorize a change.
- **NFR-11 Client compatibility.** A browser running an outdated version of the app is told to reload, rather than writing data under old rules.
- **NFR-12 Platform.** Responsive web app for desktop, tablet and phone, in current mainstream browsers.

## 6. Non-Goals (Explicit)

- No accounts, passwords or email sign-in. No authentication product.
- No AI that speaks to learners directly or enforces anything automatically.
- No room-level "assessment mode", no separate quiz application, and no transfer assessments in cyberbullying rooms.
- No permanent mastery claim; the platform does not measure long-term retention or real-world behavior.
- No multi-agent or simulated peer characters in phishing rooms (the retired "Riley").
- No scenario-specific cyberbullying learning targets.
- No tutor-made templates.
- No clearing of chat history; rooms are kept as pilot data.
- No new room-wide learning targets. Old rooms that already have them are left as they are and are not revisited.
- No reuse of rooms and no release of the learner seat.
- No violation counting for Guard and no question quota for AI suggestions.

## 7. Scope

### 7.1 In Scope
- Everything in §4 for the current small-scale pilot.

### 7.2 Out of Scope
- **Success metrics and goals.** Deliberately left out of this baseline (decision of 2026-10-22). Add them when the next initiative sets targets.
- **Custom image upload** for avatars and rooms. It cannot work under the current identity model (gap G-1).
- **More than one learner per room.**
- **Learning-outcome measurement** (pre/post testing, retention).
- **Consent and data-retention processes.** Not needed for the current pilot.
- **A formal accessibility conformance target** (for example a WCAG level).

## 8. Open Questions and Decisions

Open: none.

Resolved on 2026-10-22: OQ-1 (identity accepted for the pilot, NFR-4); OQ-2 (whole room sees the second-wrong-attempt result, FR-39); OQ-4 (no learner-seat release, FR-12); OQ-5 (length per practice type, FR-26, FR-47); OQ-6 (option selections only, FR-37); OQ-7 (reject an assessment draft and write one's own tutor reply, FR-35); OQ-8 (tutor controls for the room owner only, FR-52); OQ-9 (rating gate covers all tutor replies, FR-16); OQ-10 (observers get cyberbullying learning progress, not test rooms, FR-13, FR-50); OQ-11 (tutoring constitution is phishing only, NFR-9); OQ-12 (no consent process for the pilot, §7.2); OQ-13 (catalog cleaned in commit `c13af72`, FR-18); OQ-15 (no accessibility target, §7.2); OQ-3 (Covered means complete where transfer assessments are not available, glossary "Complete", FR-45); OQ-14 (all new learning targets are learner-owned and judged on the server; no new room-wide learning targets; old rooms left as they are; manual edits stay, FR-18, FR-31, FR-53, §6).

## 9. Assumptions Index

- FR-35 — A rejected assessment draft is offered again at the room owner's next request for an AI suggestion.
- FR-52 — A tutor who is not the room owner takes part as an observer.
