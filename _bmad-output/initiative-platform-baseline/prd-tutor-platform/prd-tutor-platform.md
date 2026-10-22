---
title: Online Safety Tutor Platform
status: draft
created: 2026-10-22
updated: 2026-10-22
---

# PRD: Online Safety Tutor Platform
*Working title — confirm.*

## 0. Document Purpose

This PRD states what the deployed tutor platform is and must keep doing. It is a brownfield baseline: every requirement below describes behavior that exists in production on 2026-10-22, written as intent, so that new initiatives can be checked against it before they change shared behavior. It is written for the product owner, for whoever plans the next initiative, and for the BMAD skills that derive the architecture spine and the baseline epics from it.

Structure: a Glossary that every later section uses verbatim; Features with globally numbered FRs (FR-1…); cross-cutting NFRs; Non-Goals; Scope; Open Questions; and an Assumptions Index. Where the deployed code and older documents disagree, the FR follows the code and carries an `[ASSUMPTION]` tag. Behavior that cannot be intended (broken or unsafe) is not written as a requirement; it is listed in `addendum.md` §C (Known gaps) and, where a decision is needed, in §8.

This PRD builds on, and does not restate, these companion documents:

- `tutor-system/docs/ai-behaviors/constitution.md` — tutoring principles (P), hard constraints (H) and priority rules (R).
- `tutor-system/docs/ai-behaviors/tutor-behavior-specification.md` — observable tutor requirements T01–T09.6 and G01–G03.
- `tutor-system/docs/ai-behaviors/tutor-response-contract.md` and `transfer-status-response-contract.md` — AI output and learning-event contracts.
- `tutor-system/docs/assessment-result-messages.md` — result-message publication.
- `tutor-system/docs/cyberbullying-practise.md` — cyberbullying scenarios, targets and characters.

Legacy requirement IDs (spec-101…104 FR-xxx, cyberbullying R1–R13, QA-TA cases, feature scenarios) are mapped to these FRs in `addendum.md` §A. Source extracts with code and test evidence sit beside this file (`extract-A…D`).

## 1. Vision

Schools use the platform to teach young people to recognize and respond to online risks — phishing and scams, privacy exposure, and cyberbullying — through practice on realistic social-media posts. A human tutor runs each practice room with one learner. An AI assistant drafts what the tutor could say next, and the tutor decides what is actually sent.

The goal is the learner's own understanding and judgment, not compliance or volume of interaction. The AI is a supervised suggester: it never speaks to learners on its own, and every decision it proposes can be inspected and overridden by the tutor. Learning progress is tracked per learner from what the learner actually says, and in phishing rooms a short final check confirms that the learner can apply an idea in a new situation.

Two practice types share one platform: phishing practice, where the tutor guides the learner through a suspicious post with AI-drafted tutoring; and cyberbullying practice, where the tutor supervises AI role-play characters reacting to the learner's comments. Both share rooms, identity, conversation, learning progress, Guard, ratings and exports, which is why changes to one practice type must be checked against the other.

## 2. Target Users

### 2.1 Jobs To Be Done

- **Tutor** (school staff or trained facilitator): run a focused practice session with one learner; get a good next reply quickly without giving up control; see what the learner has and has not understood; stop disruptive behavior safely; keep a record of the session.
- **Learner** (a student, roughly ages 9–14 `[ASSUMPTION: age range taken from the cyberbullying character prompt; phishing materials say "teens"]`): practice spotting risks on realistic posts; get feedback in plain language; prove understanding without repetitive quizzing.
- **Observer** (another student, staff member or researcher): watch a session live without taking part; download the record.

### 2.2 Non-Users (current)

- Learners using the platform without a tutor present. No AI output reaches a learner without tutor review.
- Groups of learners sharing one room as active participants. A room has one learner seat; everyone else observes.

### 2.3 Key User Journeys

- **UJ-1. Ms. Rivera runs a phishing practice session.** Ms. Rivera joins as a tutor, creates a room from the "account alert" teaching template, and keeps in-room assessment on. Jamie joins as the learner, is asked to rate each of her replies, and comments on the post. For each comment Ms. Rivera asks for an AI suggestion, edits it, and sends it. The Learning Progress panel shows Jamie's five targets moving from Pending to Partial to Covered. When Jamie reaches Covered on a target after being Partial, the next AI request returns a transfer assessment draft instead of a suggestion; she reviews it and sends it. Jamie answers wrong once, then right; a result message records each answer. **Edge case:** Jamie writes "I'd just click it to check" — the suggestion she gets leads with protective instruction before any question.
- **UJ-2. Mr. Okafor supervises a cyberbullying role-play.** He creates a cyberbullying room from one of the pinned scenarios and edits one opening comment. When Lina joins, her five shared targets are set up automatically. Lina comments; Mr. Okafor requests a character reply, switches the character from "bully" to "victim", shortens the text, and sends it. Lina sees the reply under the character's name and rates it before replying again.
- **UJ-3. Dana observes and exports.** Dana joins as an observer, opens a running room read-only, and watches messages appear live. At the end she downloads the JSON export, which contains the public conversation, ratings and result messages but no private assessment material.
- **UJ-4. A learner tests limits.** Sam repeatedly posts insults instead of answering. The AI suggestion recommends Guard; Ms. Rivera accepts it, and her reply names the behavior and what needs to change without insulting Sam. Sam's learning progress does not advance while Guard is on. When Sam makes a real attempt, the next suggestion returns to tutoring and Ms. Rivera turns Guard off.

`[ASSUMPTION: journeys are reconstructed from feature files, specs and QA guides; no user research narratives exist in the repository.]`

## 3. Glossary

- **Tutor** — A user with the tutor role. Creates and runs rooms, reviews AI output, sends replies.
- **Student** — A user with the student role. Becomes the learner of a room by taking its learner seat.
- **Observer** — A participant who can view a room and download its record but cannot post: a user with the observer role, or a student who entered a room whose learner seat was taken.
- **Learner** — The one student who holds a room's learner seat. Learning progress, transfer assessments and the rating gate apply to the learner.
- **Learner seat** — The single active learner slot in a room.
- **Application identity** — The user record selected by entering a display name and a role. It identifies a user but does not authenticate them (see NFR-4).
- **Room** — A practice space built on one scenario, owned by one tutor, with one learner seat and any number of observers.
- **Practice type** — `phishing` or `cyberbullying`. Chosen when a room is created and never changed.
- **Scenario** — The post, image, author and opening comments a room is built on. Cyberbullying scenarios come from a pinned catalog; the UI calls them "situations".
- **Template** — A global, centrally managed preset that pre-fills room creation for one practice type.
- **Pre-populated dialogue** — Scripted opening comments stored with the room. They are context only: never rated, never analyzed as learner evidence, kept when chat history is cleared.
- **Message** — A saved entry in a room's conversation (the UI calls messages "comments").
- **Learning target** — One observable idea or behavior the learner should show (for example "check the sender's address"). Owned per learner.
- **Learning progress** — The per-learner set of learning targets and their progress states.
- **Progress state** — One of **Pending**, **Partial**, **Needs review**, **Covered**.
- **Learning event** — A judged change to one learning target caused by one learner message (for example `demonstrated_understanding`, `contradiction`). Defined in the transfer-status response contract.
- **AI suggestion** — A private draft reply for the tutor, produced by the AI assistant in a phishing room.
- **Character reply** — A private draft reply in a cyberbullying room, written in the voice of one of five characters.
- **Tutor review** — The tutor's handling of an AI suggestion or character reply: copy, edit, reject, regenerate, or send.
- **Suggestion action** — The recorded outcome of tutor review: `accepted`, `modified`, `rejected`, `ignored`.
- **AI role** — The voice of the phishing AI assistant: **Peer** (knowledgeable peer coach) or **Trusted adult**.
- **Character** — The voice of a character reply: `same_age_peer`, `older_peer`, `victim`, `bully`, `educator`, each with a fixed display persona.
- **Guard** — A room-level on/off state for managing deliberate disruption. While Guard is on, replies address the behavior and learning progress does not advance.
- **Transfer assessment** — A tutor-reviewed four-option question that checks whether the learner can apply a learning target in a new situation. Phishing only.
- **Attempt** — One valid answer to an open transfer assessment. At most two.
- **Result message** — The automatic, fixed-text message saved for every accepted attempt.
- **Rating** — A learner's helpful/unhelpful judgment plus 1–5 stars on a tutor reply.
- **Export** — A TXT or JSON download of a room's record.

## 4. Features

### 4.1 Identity and Roles

**Description:** Anyone can start by typing a display name and choosing a role; there is no account, email or password. The same name and role return the same user on any device. The identity is kept in the browser and restored on reload. Roles decide which dashboard and controls a user sees.

#### FR-1: Join with name and role
A visitor can enter a display name and choose tutor, student or observer to get an application identity.

**Consequences (testable):**
- An empty or whitespace-only name is refused with "Please enter your name" and nothing is created.
- The same normalized name (trimmed, lower-cased, spaces collapsed) with the same role always selects the same user.
- After joining, the user lands on their role's dashboard; reloading the page keeps them signed in.

#### FR-2: Manage own profile
A user can change their display name, role and avatar (from presets).

**Consequences (testable):**
- Changes are saved to the user record and to the browser identity.
- The user identifier does not change when name or role changes.

**Out of Scope:** custom avatar upload (see `addendum.md` §C, gap G-1).

#### FR-3: Leave
A user can leave, which removes the identity from this browser only.

**Consequences (testable):**
- Leaving deletes no user, room, message or progress data.

### 4.2 Rooms, Scenarios and Templates

**Description:** Tutors create rooms for one practice type, usually from a global template (phishing) or a pinned scenario (cyberbullying). Test and behavior-demo rooms are kept apart from teaching. Realizes UJ-1, UJ-2.

#### FR-4: Create a room
A tutor can create a room with a title, description, preset image, original-poster setting, optional password and pre-populated dialogue, and is taken into it.

**Consequences (testable):**
- An empty title is refused ("Room title is required").
- A custom original poster requires a name; password mode requires a password.
- With no image chosen, the default preset image is used.

#### FR-5: Fix the practice type at creation
A tutor chooses the practice type when creating a room; it can never change afterwards.

**Consequences (testable):**
- Any attempt to change a room's practice type is refused.
- Every behavior that differs by practice type (generation, analysis, sending, export, available operations) is chosen from the stored practice type, never from client-supplied labels.
- A cyberbullying room or template without a complete scenario is refused.

#### FR-6: Start from a global template
A tutor can pre-fill room creation from a global template of the selected practice type.

**Consequences (testable):**
- Only templates of the selected practice type are offered.
- Choosing a template sets scenario, image, original poster, password and dialogue, and clears stale values.
- Templates are read-only to tutors; there is no "save as template". `[ASSUMPTION: the disabled save-as-template control reflects intent; cyberbullying request R1 asked for template round trips.]`

#### FR-7: Create a cyberbullying room from a pinned scenario
A tutor can choose a cyberbullying scenario from the pinned catalog, edit its post and opening comments, and create a room. Realizes UJ-2.

**Consequences (testable):**
- Creation is refused until a scenario is chosen ("Choose a Cyberbullying situation.").
- Edited comments keep their original comment and persona identity.
- If the catalog cannot be loaded, creation stays blocked.
- The AI assistant is enabled for every cyberbullying room.

#### FR-8: Keep test rooms apart from teaching
A tutor can create behavior-demo and test rooms only from the test-room area.

**Consequences (testable):**
- Test and demo rooms do not appear on the tutor's main dashboard or in student discovery.
- Demo templates are not offered in the normal creation form.

#### FR-9: Manage own rooms
A tutor can see their own rooms across sessions and delete one after confirming.

#### FR-10: Password-gated entry
A tutor can set a room password; anyone except the room's owner must enter it before the room opens.

**Consequences (testable):**
- A wrong password shows "Incorrect password. Please try again." and keeps the prompt open; cancel returns home.
- The owner is never prompted.

**Notes:** the check currently runs in the browser against a readable password (gap G-3).

### 4.3 Room Access and Live Conversation

**Description:** Students find active rooms and take the single learner seat; everyone else watches read-only. Messages, ratings and typing appear live. Realizes UJ-1, UJ-3.

#### FR-11: Discover rooms (students)
A student can see active teaching rooms with title, tutor, description, image and status, search them, and see the list update live.

**Consequences (testable):**
- Status is Available, Observer Available (seat taken) or Your Session, with Join, Observe or Rejoin actions.
- With no visible rooms the student sees "No rooms available" and a waiting message.

#### FR-12: One learner seat per room
A student can take a room's learner seat if it is free; any later student enters read-only.

**Consequences (testable):**
- At most one learner per room at any time, enforced on the server.
- A student who finds the seat taken can still observe.

**Notes:** no action releases a seat today (gap G-4; OQ-4).

#### FR-13: Observe rooms
An observer can list active rooms and open any of them read-only. Realizes UJ-3.

**Consequences (testable):**
- Observers have no message composer and see a read-only notice.
- Observers cannot post, answer assessments or rate. `[ASSUMPTION]`

#### FR-14: Live messaging
The tutor and the learner can exchange messages, and every participant sees new messages without refreshing.

**Consequences (testable):**
- A sent message appears for every participant within about 2 seconds.
- Leaving and re-entering shows the full history in order.
- Messages sent while a participant was offline appear when they reconnect.

#### FR-15: Typing indicator
The tutor and the learner can see when the other is typing; the indicator clears when typing stops or after 3 seconds without input.

#### FR-16: Required rating of tutor replies
The learner must rate the most recent tutor reply (helpful or unhelpful, 1–5 stars) before sending their next message. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- The gate applies to the learner only; tutors and observers are never gated.
- Pre-populated dialogue and result messages are never rating targets.
- The gate covers every tutor reply, including AI-assisted replies and character replies. `[ASSUMPTION: current behavior; OQ-9.]`
- A learner has one rating per message; changing it replaces it. The tutor and observers see rating counts update live.
- If saving the rating fails, the learner is told and their draft reply is kept.

#### FR-17: Clear chat history (phishing)
The owning tutor of a phishing room can clear its messages after an automatic backup download.

**Consequences (testable):**
- Pre-populated dialogue is kept.
- Assessment records are removed together with the messages, in one step.
- Not available in cyberbullying rooms (FR-45).

### 4.4 Learning Targets and Progress

**Description:** Each learner has their own learning targets. Every learner message is judged against each target from the learner's own words, and progress moves through four states. Guard pauses progress. Realizes UJ-1, UJ-2, UJ-4.

#### FR-18: Set up phishing learning targets
A tutor can set up a phishing room's learning targets by generating them from the room's scenario or entering them by hand, and approve them before they are saved.

**Consequences (testable):**
- Each maintained teaching template supplies exactly five learning targets. `[ASSUMPTION: the two older catalog entries with 11 and 18 items are not maintained teaching templates; OQ-13.]`
- Custom targets are saved as written, without truncation.
- Generation that fails or returns nothing invents no targets and says targets are unavailable.
- Until targets exist, the tutor sees a setup reminder and the learner sees "Waiting for the tutor to set up learning targets."

#### FR-19: Learner-owned targets and catch-up
Learning targets belong to one learner. Targets saved before the learner joins apply when they join, and that learner's earlier messages are analyzed oldest first before progress is shown.

**Consequences (testable):**
- A learner never receives another learner's progress.
- If catch-up fails, the saved targets are kept and the tutor can retry; retrying never double-counts.

#### FR-20: Judge each learner message against each target
The system judges every learner message against each learning target separately, in message order, using the conversation up to that message.

**Consequences (testable):**
- Only the learner's own message can earn evidence; tutor, character and pre-populated text are context only.
- An event must quote the learner message it is based on; an event without a valid quote is discarded.
- A message is judged only after all of that learner's earlier messages.
- If judging fails for any target, no progress is applied for that message and it stays retryable.

#### FR-21: Progress states and transitions
Learning targets move between progress states only through the learning events defined in the transfer-status response contract.

**Consequences (testable):**
- Pending → Partial on an initial signal; Pending or Partial → Covered on demonstrated understanding; Needs review → Partial on a post-repair signal; any state except Covered → Covered on spontaneous transfer; Partial or Covered → Needs review on contradiction.
- An event not allowed from the current state is recorded as rejected and changes nothing.

#### FR-22: Guard pauses progress
While Guard is on, no learner progress advances; evidence gathered meanwhile is applied when Guard ends, if it is still valid.

#### FR-23: Learning Progress panel
The tutor and the learner can open a Learning Progress panel showing each learning target's state and evidence for that learner.

**Consequences (testable):**
- The panel never covers the tutor's AI and send controls on desktop.
- On narrow screens the panel uses the full width.

### 4.5 Supervised AI Tutoring (phishing)

**Description:** In a phishing room the tutor can ask the AI assistant for a suggestion about a learner message. The suggestion follows the tutoring constitution and behavior specification, carries a reason for the tutor, and is never sent without the tutor. Realizes UJ-1, UJ-4.

#### FR-24: Configure the AI assistant
A tutor can turn the AI assistant on or off for a room and set its AI role and style parameters; settings persist.

**Consequences (testable):**
- Only tutors see AI controls.
- With the assistant off, no suggestion can be requested.
- Reopening settings shows the saved values.

#### FR-25: Request an AI suggestion
A tutor can request an AI suggestion for a chosen learner message, or the latest one. Realizes UJ-1.

**Consequences (testable):**
- The suggestion is visible only to the tutor and is never posted automatically.
- The AI receives the scenario, the pre-populated dialogue, the complete saved conversation and the learner's learning progress.
- If any part of the conversation cannot be loaded, no suggestion is generated and the tutor sees an error; the tutor can still type a reply.
- With no learner message, no suggestion is generated.

#### FR-26: Teaching quality of suggestions
Every AI suggestion meets tutor behavior requirements T01–T08 and the constitution's hard constraints H1–H4.

**Consequences (testable):**
- A stated or hypothetical intention to click a suspicious link gets protective instruction before any question (T01).
- Correct partial knowledge is never called wrong; a suggestion addresses at most one unmet learning target (T01, T02).
- No praise-only replies, no invented facts, no fabricated personal experience (T03, T04, T06).
- Plain words and short sentences; length bounded. `[ASSUMPTION: limit of 2 sentences / 35 words from the active prompt; spec T08 says 3 / 50 — OQ-5.]`

#### FR-27: Reason and instruction for the tutor
Every AI suggestion carries a reason based on what the learner said and a label for its instructional move (protective instruction, correction, scaffolding, explanation, consolidation), for the tutor only.

**Consequences (testable):**
- Reason and label are never shown to learners.
- Reason and label are kept in the tutor's export.
- A suggestion whose reason, label and text disagree is not produced; after one repair attempt the tutor gets an error instead.

#### FR-28: Review and send
A tutor can copy, edit, reject or regenerate an AI suggestion, and only the tutor's explicit send publishes a reply.

**Consequences (testable):**
- Sent unchanged records `accepted`; sent after edits records `modified`; rejected records `rejected`; replaced by a new request records `ignored`.
- An empty reply cannot be sent.
- If sending fails, the edited draft is kept.

#### FR-29: AI role, and learner's choice of AI role
A tutor can choose Peer or Trusted adult and adjust style parameters, including through Quick Adjust on a suggestion. In a room with one student and the AI on, the learner can choose the AI role instead, which then locks it.

**Consequences (testable):**
- The learner's choice is offered only when the AI is on and the room has exactly one student; never to observers.
- Once the learner chooses, the tutor sees the role as locked and regeneration uses it.

#### FR-30: Guard
The AI may recommend Guard for clear deliberate disruption; the tutor decides, and the tutor can turn Guard on or off for the room at any time after confirming. Realizes UJ-4.

**Consequences (testable):**
- Mistakes, confusion, frustration and personal questions do not trigger Guard (G01).
- A Guard reply names the behavior, its effect and the needed change, without insults, threats or apology demands (G02, G03).
- A real attempt by the learner, even a wrong one, leads back to tutoring (G01).
- While Guard is on, the tutor's replies appear as "Security Supervisor".

### 4.6 Transfer Assessment (phishing)

**Description:** When a learner has moved from partial to full understanding of a learning target, the next AI request prepares a short four-option question that applies the idea to a new situation. The tutor reviews and sends it; the learner answers with option controls; the server grades it with two attempts and records a result message. Behavior requirements T09.1–T09.6 and `assessment-result-messages.md` are the detailed sources. Realizes UJ-1.

#### FR-31: Assessment availability
In-room assessment is on by default for every phishing room; a tutor can turn it off for a room, and an operator can turn it off everywhere.

**Consequences (testable):**
- With assessment off, rooms keep working for tutoring and Guard.

#### FR-32: When an assessment becomes due
A transfer assessment becomes due for a learning target only when the learner moves it from Partial to Covered by demonstrating understanding.

**Consequences (testable):**
- Reaching Covered directly from Pending, or by spontaneous transfer, completes the target without a question.
- While Guard is on, another assessment is open, or required tutor feedback is outstanding, the due assessment waits without being lost.
- A later contradiction cancels the due assessment; changing the target's wording cancels an open question without using an attempt.
- The same cycle never produces two assessments.

#### FR-33: Prepare an assessment instead of a suggestion
When an assessment is due, the tutor's next AI request returns one assessment draft instead of an AI suggestion.

**Consequences (testable):**
- No AI suggestion is generated in that request.
- Generation problems are shown as errors; no placeholder question and no fallback suggestion are produced.

#### FR-34: Valid assessment items
Every assessment draft — generated or edited — must be a valid item before it can be sent.

**Consequences (testable):**
- Exactly four distinct options A–D; one correct option for single-answer, two or three for multiple-answer.
- Question of at most two sentences and 80 words.
- A non-empty explanation for the learner is required.
- The situation differs meaningfully from the one the learner discussed (not just a name or brand swap). `[ASSUMPTION: enforced by the generation prompt and evaluation, not by a code check.]`

#### FR-35: Tutor review of an assessment
A tutor can see the target, the new situation, the question, the options, the correct answer and the explanation; edit any of them; and send or discard the draft.

**Consequences (testable):**
- An edited draft is checked again before sending; an invalid draft cannot be sent.
- Learners never see a draft.
- A discarded draft does not count as delivered, so the next AI request prepares one again. `[ASSUMPTION: current behavior; behavior spec T09.3 allows reject/regenerate — OQ-7.]`

#### FR-36: Deliver to one learner
A tutor can send a reviewed assessment to the room's learner; the server rechecks it before saving.

**Consequences (testable):**
- If the target is no longer due or Guard is on, delivery is refused.
- Retrying a delivery never creates a second question.
- The room stays in tutoring or Guard; there is no assessment mode.

#### FR-37: Answer with option controls
The learner can answer only their own open question, by selecting options and submitting.

**Consequences (testable):**
- Single-answer questions use one-choice controls; multiple-answer questions use select-all controls; submit needs a selection.
- While the question is open, the learner's ordinary chat is disabled with an explanation; it reopens when the question closes.
- Observers and other students cannot answer.
- Each question shows the learner's saved answers.

#### FR-38: Grading and two attempts
The server grades each answer by exact match with the correct options and allows at most two attempts.

**Consequences (testable):**
- First wrong answer: one attempt left, progress unchanged.
- Right answer on either attempt: passed, once.
- Second wrong answer: failed, once.
- Repeated, concurrent, late or out-of-scope submissions never create extra attempts or change progress.

#### FR-39: Result messages
Every accepted attempt creates exactly one result message in the room: "Correct.", "Incorrect. One attempt remaining." or, after the second wrong answer, "Incorrect. No attempts remaining. Correct option(s): …" followed by the explanation.

**Consequences (testable):**
- The correct answer and explanation are published only in the second-wrong-answer result message.
- Result messages are visible to every room participant and included in exports. `[ASSUMPTION: governing doc assessment-result-messages.md; older specs limited this to the learner — OQ-2.]`
- Result messages are written by the server, cannot be edited by participants, and survive reload.

#### FR-40: Effect on learning progress
A passed assessment completes the target; a failed assessment moves it to Needs review and tutoring resumes.

**Consequences (testable):**
- After failure the learner can recover through Partial and Covered again, which makes a new assessment in a different situation due.
- A completed target is not re-assessed unless a later contradiction reopens it.
- Failure alone never turns on Guard.

#### FR-41: Tutor feedback before the next assessment
After an assessment ends, the tutor must send their own reply to the learner's final answer before that learner can get another assessment.

**Consequences (testable):**
- Result messages, accepted AI suggestions and ratings do not count as that reply.
- When several targets are due, they are offered one at a time.

#### FR-42: Same state for everyone, after any reload
Every participant sees the same question, answers, attempts left and outcome after joining, reloading, reconnecting or using several tabs.

**Consequences (testable):**
- A late or duplicate update cannot reopen a finished question.

#### FR-43: AI tutoring after assessments
The AI assistant learns assessment outcomes only from the saved conversation, and does not generate a suggestion while the focused learner's results are still being recorded.

### 4.7 Cyberbullying Practice

**Description:** In a cyberbullying room the learner comments on a pinned scenario, and the tutor replies through AI-drafted character replies. All rooms share five learning targets. Realizes UJ-2.

#### FR-44: Five shared learning targets
Every cyberbullying learner gets the same five learning targets when they join: recognize cyberbullying and its impact; show empathy and support; stand up constructively; avoid reinforcing bullying; choose a safe next step.

**Consequences (testable):**
- Targets are set up once per learner and room, even if the learner joins from several tabs.
- Targets cannot be edited, removed or varied by scenario.
- Only the learner's own comments earn evidence.

#### FR-45: Supported operations
A cyberbullying room supports exactly: save a learner comment, update learning progress, request a character reply, review it, regenerate, reject, send, rate, continue, and override Guard.

**Consequences (testable):**
- Transfer assessments, clearing chat history and Quick Adjust are refused.
- A cyberbullying learning target reached Covered from Partial is treated as complete. `[ASSUMPTION: assessments are not offered in cyberbullying rooms, so the "assessment due" phase never resolves today — OQ-3.]`

#### FR-46: Learner comments are saved before they are judged
A learner's comment is saved first, then judged against the five learning targets.

**Consequences (testable):**
- If judging fails, the comment stays saved.

#### FR-47: Request a character reply
The room's owning tutor can request one character reply to the learner's latest comment, choosing the character or letting the AI choose.

**Consequences (testable):**
- If the tutor chose a character, the reply uses that character.
- Replies are at most three sentences in simple language. `[ASSUMPTION: taken from the role-play prompt.]`
- A tutor who does not own the room cannot request a character reply.
- A request is refused when the AI is off or there is no learner comment.

#### FR-48: Review and send a character reply
The tutor can change the character and text, regenerate, reject, override Guard, and send; every tutor reply in a cyberbullying room is a reviewed character reply.

**Consequences (testable):**
- The tutor cannot send a reply without first generating and reviewing one.
- Sending saves the reply, its review record and the Guard state together.
- Suggestion actions follow FR-28; changing only the character counts as `modified`.
- The tutor's character choice applies to that reply only.

#### FR-49: Consistent character identity
Every viewer sees a sent character reply under the same character and persona name (Jerry, Tom, Dylan, Sarah, Ms. Smith), live, after reload, in AI context and in exports.

**Consequences (testable):**
- Sent replies cannot be edited.

### 4.8 Exports and Interaction Records

**Description:** Every participant can download the room record; content depends on role. Tutor review of AI output is recorded for later analysis. Realizes UJ-3.

#### FR-50: Download the room record
Any participant can download the room as TXT or JSON.

**Consequences (testable):**
- Tutors additionally get AI interaction records and an AI summary.
- A learner's export includes their own assessment answers; cyberbullying exports include learning progress.
- No export contains private assessment material beyond what result messages publish.

#### FR-51: Record tutor review of AI output
The system records, for every AI suggestion and character reply, the suggestion action, the original and final text, the response time, the context messages, the original and final Guard state, and the instruction label or character.

**Consequences (testable):**
- No IP address or browser information is recorded.
- The records persist after the session ends.

## 5. Cross-Cutting NFRs

- **NFR-1 Human supervision.** No AI-generated text reaches a learner without the tutor's explicit send. The AI never changes room state on its own (constitution P4; tutor-response-contract).
- **NFR-2 Server authority.** Grading, attempt counting, assessment eligibility, learning progress changes, the learner seat and private assessment data are decided on the server. The browser never grades or changes progress directly.
- **NFR-3 Privacy of private material.** Correct answers and explanations stay private until a second wrong answer (FR-39). The reasoning behind an assessment, raw AI output and AI provider credentials are never visible to participants or present in the browser. Reasons and instruction labels are visible to tutors only.
- **NFR-4 Identity model and accepted risk.** The application identity identifies users but does not authenticate them, and room data is readable and writable by any client of the app. Consequences accepted for now: anyone can act as any user by typing the same name and role; any participant can read any room's messages and passwords. `[ASSUMPTION: accepted for school deployment — OQ-1.]`
- **NFR-5 Reliable repetition.** Repeating any request (send, answer, delivery, analysis) produces no duplicate effect. Concurrent requests resolve to one outcome.
- **NFR-6 Persistence.** Identity, conversation, learning progress and assessment state survive reloads, reconnects and multiple tabs.
- **NFR-7 Fail visibly.** When something needed is missing or fails (conversation history, targets, AI output, configuration), the user gets a clear error. No placeholder content and no hidden fallback. Known exceptions are listed as gaps in `addendum.md` §C.
- **NFR-8 Live updates.** Messages appear for all participants within about 2 seconds; room lists and ratings update without refresh.
- **NFR-9 Safe and honest AI content.** All AI output follows the constitution's hard constraints: truthful content, no humiliation, honest self-representation, explainable decisions (H1–H4). This applies to character replies too, where the role requires it. `[ASSUMPTION — OQ-11.]`
- **NFR-10 Behavior change control.** Changing an AI model, a shared prompt or the analyzer changes behavior for every practice type that uses it, and must be re-evaluated for each. The constitution changes only through an explicit human decision; passing evaluations cannot authorize a change.
- **NFR-11 Client compatibility.** A client that is out of date with the server is told to reload, rather than writing data under old rules.
- **NFR-12 Platform.** Responsive web app for desktop, tablet and phone, in current mainstream browsers.

## 6. Non-Goals (Explicit)

- No accounts, passwords or email sign-in. No authentication product.
- No AI that speaks to learners directly or enforces anything automatically.
- No room-level "assessment mode", no separate quiz application, and no assessments in cyberbullying rooms.
- No permanent mastery claim; the platform does not measure long-term retention or real-world behavior.
- No multi-agent or simulated peer characters in phishing rooms (the retired "Riley").
- No scenario-specific cyberbullying learning targets.
- No tutor-made templates.
- No violation counting for Guard and no question quota for the AI.

## 7. Scope

### 7.1 In Scope
- Everything in §4 as currently deployed in production and staging.

### 7.2 Out of Scope
- **Success metrics and goals.** Deliberately left out of this baseline by decision of 2026-10-22. Add them when the next initiative sets targets.
- **Custom image upload** (avatars and room images). It cannot work under the current identity model (gap G-1).
- **More than one active learner per room.**
- **Learning-outcome measurement** (pre/post testing, retention).

## 8. Open Questions

1. **OQ-1 Identity for schools.** Is "identifies but does not authenticate" acceptable for school use, including impersonation by name and readable room passwords? Or is stronger identity the next initiative?
2. **OQ-2 Who sees the answer after a second wrong answer.** Should the correct answer and explanation go to the whole room (current) or only to the learner (older specs)?
3. **OQ-3 Cyberbullying completion.** Is a cyberbullying target complete when it reaches Covered from Partial, or does it need its own application check?
4. **OQ-4 Learner seat release.** When should the seat free up: leaving, signing out, a timeout, or a tutor action?
5. **OQ-5 Reply length.** 2 sentences / 35 words or 3 sentences / 50 words?
6. **OQ-6 Free-text answers.** Learners can only answer assessments with option controls, so the clarification ("B or D") and help-request paths cannot be reached. Remove them, or bring back typed answers?
7. **OQ-7 Discarded assessments.** Should a discarded draft be proposed again on the next request (current), or should the tutor be able to reject or regenerate it?
8. **OQ-8 Tutor controls in rooms they do not own.** Any tutor can currently use AI, Guard and progress controls in any room. Restrict them to the owner?
9. **OQ-9 Rating gate scope.** Should every tutor reply require a rating, including character replies and replies written without AI?
10. **OQ-10 Observer data.** Should observers receive cyberbullying learning progress in their export, and see test rooms in their room list?
11. **OQ-11 Constitution scope.** Does the tutoring constitution govern cyberbullying characters, including the "bully" character, or do they need their own principles?
12. **OQ-12 Data handling for schools.** Exports contain full conversations and AI interaction records. Are consent, retention or anonymized exports required?
13. **OQ-13 Older target lists.** Keep or retire the two catalog scenarios that do not follow the five-target rule?
14. **OQ-14 Legacy progress path.** Rooms without learner-owned targets still use an older browser-side progress path with manual tutor edits. Is it still in scope?
15. **OQ-15 Accessibility target.** Should a WCAG level be set for school use?

## 9. Assumptions Index

- §2.1 — Learner age range 9–14.
- §2.3 — Journeys reconstructed from repository sources, not user research.
- FR-6 — No save-as-template is intended.
- FR-13 — Observers cannot rate.
- FR-16 — Rating gate covers all tutor replies (OQ-9).
- FR-18 — Five-target rule applies to maintained teaching templates only (OQ-13).
- FR-26 — Reply length 2 sentences / 35 words (OQ-5).
- FR-34 — "Meaningfully different situation" enforced by prompt and evaluation, not code.
- FR-35 — Discarded drafts are re-proposed (OQ-7).
- FR-39 — Result messages visible to the whole room (OQ-2).
- FR-45 — Cyberbullying Covered-from-Partial counts as complete (OQ-3).
- FR-47 — Character replies at most three sentences in simple language.
- NFR-4 — Identity risk accepted for school use (OQ-1).
- NFR-9 — Constitution applies to character replies (OQ-11).
