---
title: Online Safety Tutor Platform
status: final
created: 2026-10-22
updated: 2026-10-30
---

# PRD: Online Safety Tutor Platform
*Working title — confirm.*

## 0. Document Purpose

This PRD states the system contracts of the deployed tutor platform: what the system guarantees, verified by code tests. It is a brownfield baseline — every requirement describes behavior intended for the platform as deployed on 2026-10-22 — so that new initiatives can be checked against it before they change shared behavior. It is written for the product owner, for whoever plans the next initiative, and for the skills that derive the architecture spine and the baseline epics from it.

**Layering.** The root is the product constitution (`../constitution-product/constitution-product.md`): principles P1–P8, constraints C1–C6 and priority rules R1–R8. Every FR and NFR below carries a **Grounding** line citing them. AI behavior — how good an AI job's output is — is not specified here: it belongs to AI behavior constitutions and specifications, verified by evaluations. This PRD states only each AI job's boundary (inputs, output shape, audience, gates, failure handling) and points to its specification (§7).

**Structure.** Glossary; Part A, the shared platform (§4); Part B, phishing practice (§5); Part C, cyberbullying practice (§6); AI behavior boundaries (§7); cross-cutting NFRs (§8); Non-Goals (§9); Scope (§10); Open Questions and Decisions (§11); Assumptions Index (§12). FRs are numbered globally and keep their numbers when moved between parts. Terms are defined in §3.

Companion documents cited, not restated:

- `tutor-system/docs/ai-behaviors/constitution.md` — the tutoring constitution (phishing only).
- `tutor-system/docs/ai-behaviors/tutor-behavior-specification.md` — tutor behavior requirements T01–T09.6 and G01–G03.
- `tutor-system/docs/ai-behaviors/tutor-response-contract.md` and `transfer-status-response-contract.md` — AI output and learning-event contracts.
- `tutor-system/docs/assessment-result-messages.md` — result-message publication.
- `tutor-system/docs/exit-time-assessment.md` — temporary exit assessment (FR-54).
- `tutor-system/docs/cyberbullying-practise.md` — cyberbullying scenarios, learning targets and characters.

Legacy requirement IDs are mapped to these FRs in `addendum.md` §A. Source extracts with code and test evidence sit beside this file (`extract-A…D`).

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

- **UJ-1. Ms. Rivera runs a phishing practice room.** Ms. Rivera joins as a tutor, creates a room from the "account alert" template, and keeps in-room assessment on. Jamie joins as the learner, rates each of Ms. Rivera's replies, and writes about the post. For each of Jamie's messages Ms. Rivera asks for an AI suggestion, edits it, and sends it. The Learning Progress panel shows Jamie's five learning targets moving from Pending to Partial to Covered. When Jamie reaches Covered on a learning target after being Partial, a transfer assessment becomes due and Ms. Rivera's next request for an AI suggestion returns an assessment draft; Ms. Rivera reviews it and sends it. Jamie answers wrong once, then right; a result message records each attempt. **Edge case:** Jamie writes "I'd just click it to check" — the AI suggestion leads with protective instruction before any question. **While exit assessment is in force (temporary):** Ms. Rivera reviews and sends a transfer assessment for each learning target Jamie reaches Covered, clicking again for her normal AI suggestion; Jamie keeps chatting and does not see them. When Jamie clicks back to the dashboard, a pop-up asks each question in turn, and Jamie leaves after the last one.
- **UJ-2. Mr. Okafor supervises a cyberbullying role-play.** He creates a cyberbullying room from one of the cyberbullying templates and edits one line of its pre-populated dialogue. When Lina joins, her five shared learning targets are set up automatically. Lina writes a message; Mr. Okafor requests a character draft, switches the character from "bully" to "victim", shortens the text, and sends it. Lina sees the character reply under the character's persona name and rates it before writing again.
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
- **Scenario** — What a room is built on: a post with its image, its original poster and its pre-populated dialogue. Cyberbullying scenarios are shared room templates of the cyberbullying practice type.
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
- **AI job** — One kind of AI output the platform produces: AI suggestions, character drafts, assessment drafts, learning-event judging or learning-target generation (§7).
- **AI behavior specification** — The document that defines the quality of one AI job's output and the evaluation that verifies it. Governed by an AI behavior constitution.
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
- **Tutoring constitution** — The AI behavior constitution that governs AI suggestions and assessment drafts. Phishing only.

**Learning**

- **Learning target** — One observable idea or behavior the learner should show (for example "check the sender's address"). Each learner has their own, whether the learning targets were generated or entered by hand.
- **Learning progress** — A learner's learning targets with their progress states and evidence, shown in the Learning Progress panel.
- **Progress state** — The state of one learning target: **Pending**, **Partial**, **Needs review** or **Covered**.
- **Learning event** — A judged change to one learning target caused by one learner message (for example `demonstrated_understanding`, `contradiction`), as defined in the transfer-status response contract.
- **Evidence** — The quoted part of a learner message that a learning event is based on, or a note recorded with a room owner's manual change.
- **Complete** — A learning target that is Covered with no transfer assessment due for it. Where transfer assessments are not available (cyberbullying rooms, and phishing rooms with in-room assessment off), Covered means complete. While exit assessment is in force, a learning target is never complete: every Covered learning target is checked again on each visit (FR-40). Not a separate progress state.

**Transfer assessment** (phishing only)

- **Transfer assessment** — A four-option question that checks whether the learner can apply a learning target in a new context: a concrete case meaningfully different from the scenario the learner discussed.
- **In-room assessment** — The per-room setting that allows transfer assessments.
- **Due** — A transfer assessment is due for a learning target after the learner moves it from Partial to Covered by demonstrating understanding, until it is delivered, cancelled or completed. Rejecting an assessment draft does not change this. While exit assessment is in force, the rule in FR-32 applies instead.
- **Assessment draft** — An AI draft of a transfer assessment.
- **Attempt** — One valid answer to an open transfer assessment. A learner gets at most two.
- **Learner explanation** — The explanation of the correct answer that is published after a second wrong attempt.
- **Result message** — The automatic, fixed-text message the server saves for every accepted attempt.
- **Tutor feedback** — The room owner's own tutor reply to the learner's final attempt, required before that learner can get another transfer assessment (not required while exit assessment is in force, FR-41).
- **Exit assessment** — A temporary replacement for in-dialogue answering (FR-54). While it is in force, the learner answers their open transfer assessments in a pop-up when leaving the room, instead of in the conversation. There is no runtime switch: the in-dialogue implementation is archived unchanged on branch `assess-in-dialogue`, and restoring it means redeploying that branch.
- **Visit** — One stay of the learner in a room, from entering it to leaving it. The server records the start of each visit, once per opening of the room page.

# Part A — Shared Platform

## 4. Shared Platform Features

### 4.1 Identity and Roles

**Description:** Anyone can start by typing a display name and choosing a role; there is no account, email or password. The same name and role return the same user on any device. The application identity is kept in the browser and restored on reload. Roles decide which dashboard and controls a user sees.

#### FR-1: Join with name and role
A visitor can enter a display name and choose tutor, student or observer to get an application identity.
**Grounding:** P5, P6, R1.

**Consequences (testable):**
- An empty or whitespace-only name is refused with "Please enter your name" and nothing is created.
- The same normalized name (trimmed, lower-cased, spaces collapsed) with the same role always selects the same user.
- After joining, the user lands on their role's dashboard; reloading the page keeps them signed in.

#### FR-2: Manage own profile
A user can change their display name, role and avatar (from presets).
**Grounding:** P5.

**Consequences (testable):**
- Changes are saved to the user record and to the browser.
- The user identifier does not change when name or role changes.

**Out of Scope:** custom avatar upload.

#### FR-3: Leave
A user can leave, which removes the application identity from this browser only.
**Grounding:** P4, C4.

**Consequences (testable):**
- Leaving deletes no user, room, message or learning progress data.

### 4.2 Rooms, Scenarios and Templates

**Description:** Tutors create rooms for one practice type, usually from a template. Test rooms are kept apart from teaching. Cyberbullying room creation is in §6. Realizes UJ-1, UJ-2.

#### FR-4: Create a room
A tutor can create a room with a title, description, preset image, original poster, optional password and pre-populated dialogue, and is taken into it as its room owner.
**Grounding:** P1, P5.

**Consequences (testable):**
- An empty title is refused ("Room title is required").
- A custom original poster requires a name; password mode requires a password.
- With no image chosen, the default preset image is used.

#### FR-5: Fix the practice type at creation
A tutor chooses the practice type when creating a room; it can never change afterwards.
**Grounding:** P7, P4.

**Consequences (testable):**
- Any attempt to change a room's practice type is refused.
- Every behavior that differs by practice type (AI jobs, sending, export, available operations) is chosen from the stored practice type, never from client-supplied labels.
- A cyberbullying room or template without a complete scenario is refused.

#### FR-6: Start from a template
A tutor can pre-fill room creation from a template of the selected practice type.
**Grounding:** P5, P6.

**Consequences (testable):**
- Only templates of the selected practice type are offered.
- Choosing a template sets scenario, image, original poster, password and pre-populated dialogue, and clears stale values.
- Templates are read-only to tutors; there is no "save as template".

#### FR-8: Keep test rooms apart from teaching
A tutor can create test rooms only from the test-room area.
**Grounding:** P5.

**Consequences (testable):**
- Test rooms do not appear on the tutor's main dashboard, in student room lists or in observer room lists.
- Test-only templates are not offered in the normal creation form.

#### FR-9: Manage own rooms
A tutor can see the rooms they own whenever they return, and delete one after confirming.
**Grounding:** P5, C4.

**Consequences (testable):**
- Deleting a room removes the room and everything it holds, including its students' messages, learning progress and private assessment records.
- Only the room owner can delete a room; the server refuses anyone else.
- Deletion needs an explicit confirmation and cannot be undone.

#### FR-10: Password-gated entry
A room owner can set a room password; anyone except the room owner must enter it before the room opens.
**Grounding:** P2, P5.

**Consequences (testable):**
- A wrong password shows "Incorrect password. Please try again." and keeps the prompt open; cancel returns home.
- The room owner is never prompted.

**Notes:** the password is a convenience gate, not a security control (NFR-4).

### 4.3 Room Access and Live Conversation

**Description:** Students find rooms and the first becomes the learner; everyone else watches read-only. Messages, ratings and typing appear live. Realizes UJ-1, UJ-3.

#### FR-11: Find rooms (students)
A student can see active rooms other than test rooms, with title, tutor, description, image and status, search them, and see the list update live.
**Grounding:** P5.

**Consequences (testable):**
- Status is Available, Observer Available (the room has a learner) or Your Session, with Join, Observe or Rejoin actions.
- With no visible rooms the student sees "No rooms available" and a waiting message.

#### FR-12: One learner per room
A student can become a room's learner if it has none; any later student enters as an observer.
**Grounding:** P1, P4, R2.

**Consequences (testable):**
- At most one learner per room at any time, enforced on the server.
- The room owner is never the learner of their own room, and never answers an assessment, whatever role their profile shows.
- The learner keeps the seat for the room's whole life; rooms are not reused for another learner.

#### FR-13: Observe rooms
An observer can list active rooms other than test rooms and open any of them read-only. Realizes UJ-3.
**Grounding:** P2.

**Consequences (testable):**
- Observers have no message composer and see a read-only notice.
- Observers cannot post, answer transfer assessments or rate.
- Test rooms are not listed (FR-8).

#### FR-14: Live messaging
The room owner and the learner can exchange messages, and every participant sees new messages without refreshing.
**Grounding:** P1, P5.

**Consequences (testable):**
- A sent message appears for every participant within about 2 seconds.
- Leaving and re-entering shows the full history in order.
- Messages sent while a participant was offline appear when they reconnect.

#### FR-15: Typing indicator
The room owner and the learner can see when the other is typing; the indicator clears when typing stops or after 3 seconds without input.
**Grounding:** P5.

#### FR-16: Required rating of tutor replies
The learner must rate the most recent tutor reply before sending their next message. Realizes UJ-1, UJ-2.
**Grounding:** P8, R8.

**Consequences (testable):**
- The gate applies to the learner only; tutors and observers are never gated.
- The gate covers every tutor reply in both practice types, including character replies and replies written without the AI assistant.
- Pre-populated dialogue and result messages are never rated. While exit assessment is in force, transfer assessments hidden from the learner (FR-37) are never rated either.
- A learner has one rating per message; changing it replaces it. The room owner and observers see rating counts update live.
- If saving the rating fails, the learner is told and their unsent message is kept.

#### FR-17: (withdrawn 2026-10-22)
Clearing chat history is not a supported feature.

### 4.4 Learning Progress

**Description:** Each learner has their own learning targets. Every learner message is judged against each learning target, and learning progress moves through four progress states. Guard pauses learning progress. How learning targets are set up differs by practice type (FR-18 phishing, FR-44 cyberbullying). Realizes UJ-1, UJ-2, UJ-4.

#### FR-19: Learner-owned learning targets and catch-up
Learning targets belong to one learner. Learning targets saved before the learner joins apply when they join, and that learner's earlier messages are judged oldest first before learning progress is shown.
**Grounding:** P1, P4.

**Consequences (testable):**
- A learner never receives another learner's learning progress.
- If catch-up fails, the saved learning targets are kept and the room owner can retry; retrying never double-counts.

#### FR-20: Judge each learner message against each learning target (boundary)
The system has every learner message judged against each learning target separately, in message order, using the conversation up to that message, and applies only learning events that pass the contract.
**Grounding:** P1, P4, C2.

**Consequences (testable):**
- A learning event is applied only if it quotes the learner message it is about; tutor replies, character replies and pre-populated dialogue can never supply evidence.
- A message is judged only after all of that learner's earlier messages.
- If judging fails for any learning target, no learning progress is applied for that message and it stays retryable.
- Whether a judgment is correct is governed by the learning-event judging specification (§7), not by this FR.

#### FR-21: Progress states and transitions
Learning targets move between progress states only in three ways: learning events as defined in the transfer-status response contract, a transfer assessment result (FR-40), and a manual edit (FR-53).
**Grounding:** P4, P7, C3.

**Consequences (testable):**
- Pending → Partial on an initial signal; Pending or Partial → Covered on demonstrated understanding; Needs review → Partial on a post-repair signal; any state except Covered → Covered on spontaneous transfer; Partial or Covered → Needs review on contradiction.
- A learning event not allowed from the current progress state is recorded as rejected and changes nothing.

#### FR-22: Guard pauses learning progress
While Guard is on, no learning progress advances; learning events gathered meanwhile are applied when Guard ends, unless the learning target's progress state no longer allows them (FR-21).
**Grounding:** P3, P4.

#### FR-23: Learning Progress panel
The room owner and the learner can open the Learning Progress panel showing each learning target's progress state and evidence for that learner.
**Grounding:** P2, P1.

**Consequences (testable):**
- The panel never covers the room owner's AI and send controls on desktop.
- On narrow screens the panel uses the full width.

#### FR-53: Manual learning progress edits
The room owner can manually change a learning target's progress state and add a note.
**Grounding:** P2, C2.

**Consequences (testable):**
- The change appears in the Learning Progress panel for the room owner and the learner.
- The change is recorded as evidence attributed to the room owner.

### 4.5 Supervision and Guard

#### FR-52: Tutor controls belong to the room owner
Only the room owner can use tutor controls in a room: the AI assistant, tutor review, Guard, learning-target setup, manual learning progress edits, in-room assessment and tutor replies.
**Grounding:** P2, R5, R9.

**Consequences (testable):**
- Another tutor who opens the room has none of these controls. They take part as an observer.
- The screen shows tutor controls only to the room owner.
- The server refuses these operations from anyone but the room owner: publishing a tutor reply or reviewed AI text, editing learning progress, and delivering or grading an assessment.

#### FR-30: Guard
The room owner can turn Guard on or off for the room at any time after confirming; in phishing rooms an AI suggestion may recommend it, and the room owner decides. Realizes UJ-4.
**Grounding:** P3, P2, R9.

**Consequences (testable):**
- Guard changes only by the room owner's action; an AI recommendation alone never changes it.
- Sending a reply records the Guard state. It may also apply the Guard state the room owner chose in the composer.
- While Guard is on, the room owner's tutor replies are shown as "Security Supervisor" and learning progress pauses (FR-22).
- When the AI recommends Guard, and how a Guard tutor reply is worded, is governed by G01–G03 (§7).

### 4.6 Exports and Interaction Records

**Description:** Every participant can download the room's export; its content depends on role. Tutor review of AI drafts is recorded for later analysis. Realizes UJ-3.

#### FR-50: Download the export
Any participant can download the room's export as TXT or JSON.
**Grounding:** P8.

**Consequences (testable):**
- The room owner's export additionally includes the tutor-review records of FR-51 and a summary of suggestion actions.
- The learner's export includes their own transfer-assessment attempts.
- Cyberbullying exports include the learner's learning progress for every participant, observers included.
- No export contains private transfer-assessment material beyond what result messages publish.

#### FR-51: Record tutor review of AI drafts
The system records, for every AI suggestion, assessment draft and character draft, the suggestion action, the original and final text, the response time, the context messages, the original and final Guard state, and the instruction label or character.
**Grounding:** P8.

**Consequences (testable):**
- No IP address or browser information is recorded.
- The records are kept with the room after use.

# Part B — Phishing Practice

## 5. Phishing Practice Features

### 5.1 Learning Target Setup

#### FR-18: Set up phishing learning targets (boundary for learning-target generation)
The room owner can set up a phishing room's learning targets by generating them from the room's scenario or entering them by hand, and approve them before they are saved.
**Grounding:** P1, P7, R7.

**Consequences (testable):**
- Generated and hand-entered learning targets are both learner-owned and judged on the server (FR-19, FR-20), whether in-room assessment is on or off.
- Every phishing template supplies exactly five learning targets.
- Custom learning targets are saved as written, without truncation.
- Generation that fails or returns nothing invents no learning targets and says they are unavailable.
- Until learning targets exist, the room owner sees a setup reminder and the learner sees "Waiting for the tutor to set up learning targets."
- The quality of generated learning targets has no AI behavior specification yet (§7).

### 5.2 AI Suggestions

**Description:** The room owner can ask the AI assistant for an AI suggestion about a learner message and must review it before anything is sent. Realizes UJ-1, UJ-4.

#### FR-24: Configure the AI assistant
The room owner can turn the AI assistant on or off for a room and set its AI role and style parameters; settings persist.
**Grounding:** P2.

**Consequences (testable):**
- With the AI assistant off, no AI draft can be requested.
- Reopening settings shows the saved values.

#### FR-25: Request an AI suggestion (boundary)
The room owner can request an AI suggestion for a chosen learner message, or the latest one. Realizes UJ-1.
**Grounding:** P2, C1.

**Consequences (testable):**
- Inputs: the scenario, the complete saved conversation, the learner's learning progress and the current Guard state.
- Output: suggested text, a reason, an instruction label and a Guard recommendation.
- Audience: the room owner only; the AI suggestion is never sent automatically.
- If any part of the conversation cannot be loaded, no AI suggestion is generated and the room owner sees an error; they can still type a tutor reply.
- With no learner message, no AI suggestion is generated.

#### FR-26: Quality of AI suggestions (boundary)
The content of AI suggestions is governed by the tutor behavior specification (T01–T08, G01–G03) under the tutoring constitution and verified by its evaluation suite, not by this PRD (§7).
**Grounding:** P1, P3, R6 (through the tutoring constitution).

**Consequences (testable):**
- A change to the prompt or model behind AI suggestions is released only after its evaluation suite has been run (NFR-10).

#### FR-27: Reason and instruction label
Every AI suggestion carries a reason and an instruction label, for the room owner only.
**Grounding:** P2.

**Consequences (testable):**
- Reasons and instruction labels are never shown to learners.
- Reasons and instruction labels are kept in the room owner's export.
- AI output that does not fit the output contract is not shown; after one repair attempt the room owner gets an error instead.

#### FR-28: Tutor review and send
The room owner can copy, edit, reject or regenerate an AI suggestion, and only the room owner's explicit send publishes a tutor reply.
**Grounding:** P2, C1, R4.

**Consequences (testable):**
- Sent unchanged records `accepted`; sent after edits records `modified`; rejected records `rejected`; replaced by a new request records `ignored`.
- An empty tutor reply cannot be sent.
- If sending fails, the edited text is kept.

#### FR-29: AI role, and the learner's choice of AI role
The room owner can choose the AI role and its style parameters, including through Quick Adjust. In a room with one student and the AI assistant on, the learner can choose the AI role instead, which then locks it.
**Grounding:** P1, P2.

**Consequences (testable):**
- The learner's choice is offered only when the AI assistant is on and the room has exactly one student; never to observers.
- Once the learner chooses, the room owner sees the AI role as locked, and regeneration uses it.

### 5.3 Transfer Assessment

**Description:** When a learner moves a learning target from Partial to Covered, a transfer assessment becomes due: a short four-option question in a new context. The room owner reviews and sends it, or rejects it; the learner answers with option controls; the server grades it with two attempts and saves a result message. `assessment-result-messages.md` is the detailed source for result publication. Realizes UJ-1.

**Exit assessment (temporary, approved 2026-10-29).** In-dialogue timing of transfer assessments was not accurate enough, so the owner approved a temporary replacement. While exit assessment is in force, every Covered learning target gets a transfer assessment, the room owner still reviews and sends each one during the conversation, and the learner answers all of them in a pop-up when leaving the room (FR-54). Each affected FR states its change in a consequence starting "While exit assessment is in force"; that consequence replaces the conflicting rule of the same FR. Grading, attempts, result messages, private material and Guard holding are unchanged. The in-dialogue rules stay written here because they describe the implementation archived on branch `assess-in-dialogue` (commit `ebc03d1`), which restores them if redeployed. `tutor-system/docs/exit-time-assessment.md` is the detailed source.

#### FR-31: In-room assessment setting
In-room assessment is on by default for every phishing room. The room owner can turn it off for a room, and the operator can turn transfer assessments off everywhere.
**Grounding:** P2, P6.

**Consequences (testable):**
- In-room assessment controls only transfer assessments. Learning targets, judging and learning progress work the same with it on or off.
- With in-room assessment off, AI suggestions and Guard keep working.
- Turning in-room assessment off does not close a transfer assessment that is already open: the learner can still answer it and it is graded. 
- Exit assessment (FR-54) has effect only where transfer assessments are on.

#### FR-32: When a transfer assessment becomes due
A transfer assessment becomes due for a learning target only when the learner moves it from Partial to Covered by demonstrating understanding.
**Grounding:** P1.

**Consequences (testable):**
- Reaching Covered directly from Pending, or by spontaneous transfer, makes the learning target complete without a transfer assessment.
- While Guard is on, another transfer assessment is open, or tutor feedback is outstanding, the due transfer assessment waits without being lost.
- A later contradiction cancels the due transfer assessment; changing the learning target's wording cancels an open one without using an attempt.
- One Partial → Covered change never produces two transfer assessments.
- While exit assessment is in force: a transfer assessment is due for every learning target the learner's own learning event made Covered — from Pending, from Partial or by spontaneous transfer — that has no open transfer assessment, and for which no transfer assessment was delivered (and not cancelled) or ended as passed or failed during the learner's current visit. A learning target set to Covered only by a manual edit (FR-53) is not due, because there is no learner evidence to build the question from.
- While exit assessment is in force: only Guard makes a due transfer assessment wait. Another open transfer assessment and outstanding tutor feedback do not, so several can be due and open at once, at most one open per learning target.

#### FR-33: Assessment draft instead of an AI suggestion (boundary)
When a transfer assessment is due, the room owner's next request for an AI suggestion returns one assessment draft instead.
**Grounding:** P2, C1, P7.

**Consequences (testable):**
- Inputs: the due learning target, its evidence and the conversation.
- Output: a question, four options, the correct option or options, a learner explanation and the new context.
- Audience: the room owner only; no AI suggestion is generated by that request.
- Generation problems are shown as errors; no placeholder question and no fallback AI suggestion are produced.
- The quality of assessment drafts is governed by T09.1–T09.6 (§7).
- While exit assessment is in force: when several are due, each request returns one assessment draft. The room owner requests again for the next draft, and gets an AI suggestion once none is due.

#### FR-34: Valid transfer assessments
Every assessment draft — generated or edited — must pass the structural checks before it can be sent.
**Grounding:** P1, P7.

**Consequences (testable):**
- Exactly four distinct options A–D; one correct option for single-answer, two or three for multiple-answer.
- A question of at most two sentences and 80 words.
- A non-empty learner explanation is required.
- Whether the new context differs meaningfully from the scenario is governed by T09.2 (§7).

#### FR-35: Tutor review of an assessment draft
The room owner can see the learning target, the new context, the question, the options, the correct answer and the learner explanation; edit any of them; and send the assessment draft, or reject it and write their own tutor reply instead.
**Grounding:** P2, R4.

**Consequences (testable):**
- An edited assessment draft is checked again before sending; an invalid one cannot be sent.
- Learners never see an assessment draft.
- Rejecting an assessment draft delivers nothing to the learner. The transfer assessment stays due and is offered again at the room owner's next request for an AI suggestion.
- When the room owner rejects an assessment draft, the platform shows a message naming the learning target it was meant to check. The message says the target's recorded progress may be wrong, and asks the room owner to check it and correct it by hand if needed (FR-53).

#### FR-36: Deliver to the learner
The room owner can send a reviewed assessment draft to the learner; the server rechecks it before saving.
**Grounding:** P2, C3.

**Consequences (testable):**
- If the transfer assessment is no longer due or Guard is on, delivery is refused.
- Retrying a delivery never creates a second question.
- Delivering a transfer assessment does not change Guard; there is no assessment mode.
- While exit assessment is in force: delivery is refused if the learning target already has an open transfer assessment. Open transfer assessments for other learning targets do not block it.

#### FR-37: Answer with option controls
The learner can answer only their own open transfer assessment, by selecting options and submitting.
**Grounding:** P1, P7, R7.

**Consequences (testable):**
- Single-answer questions use one-choice controls; multiple-answer questions use select-all controls; submitting needs a selection.
- Any answer that is not an option selection is refused; there is no typed-answer, clarification or help-request path.
- While the transfer assessment is open, the learner's ordinary messaging is disabled with an explanation; it reopens when the transfer assessment closes.
- Observers and other students cannot answer.
- Each transfer assessment shows the learner's saved attempts.
- While exit assessment is in force: the learner does not see transfer assessments, their answers or their result messages in the conversation, and the learner's ordinary messaging stays enabled while transfer assessments are open. The learner answers them only in the exit pop-up (FR-54). The room owner and observers see them in the conversation as before.

#### FR-38: Grading and two attempts
The server grades each attempt by exact match with the correct options and allows at most two attempts.
**Grounding:** P4, C3.

**Consequences (testable):**
- While Guard is on, a learner's answer to an open transfer assessment is held: it is not graded and uses no attempt. It is graded after Guard ends. While exit assessment is in force, this applies to answers given in the exit pop-up too (FR-54).
- First wrong attempt: one attempt left, learning progress unchanged.
- Right attempt on either try: passed, once.
- Second wrong attempt: failed, once.
- Repeated, concurrent, late or out-of-scope submissions never create extra attempts or change learning progress.

#### FR-39: Result messages
Every accepted attempt creates exactly one result message: "Correct.", "Incorrect. One attempt remaining." or, after the second wrong attempt, "Incorrect. No attempts remaining. Correct option(s): …" followed by the learner explanation.
**Grounding:** P1, R3, C5.

**Consequences (testable):**
- The correct answer and learner explanation are published only in the second-wrong-attempt result message.
- Result messages are visible to every room participant and included in exports. While exit assessment is in force, the learner sees them in the exit pop-up instead of the conversation (FR-37, FR-54).
- Result messages are written by the server, cannot be edited by participants, and survive reload.

#### FR-40: Effect on learning progress
A passed transfer assessment makes the learning target complete; a failed one moves it to Needs review, and AI suggestions teach toward it again.
**Grounding:** P1, P4.

**Consequences (testable):**
- After failure the learner can recover through Partial and Covered again, which makes a new transfer assessment in another new context due.
- A complete learning target is not assessed again unless a later contradiction reopens it.
- While exit assessment is in force: a passed learning target stays Covered and becomes due again at the learner's next visit, so the room owner can send a new transfer assessment for it then, which the learner answers at that visit's exit. Every Covered learning target is therefore checked once per visit. A failed one moves to Needs review as before and is due again only after the learner reaches Covered again.
- Failure alone never turns on Guard.

#### FR-41: Tutor feedback before the next transfer assessment
After a transfer assessment ends, the room owner must send tutor feedback before that learner can get another transfer assessment.
**Grounding:** P2.

**Consequences (testable):**
- Result messages, accepted AI suggestions and ratings are not tutor feedback.
- When several transfer assessments are due, they are offered one at a time.
- While exit assessment is in force: tutor feedback is not required before another transfer assessment, because the learner answers at exit. Several are still offered one assessment draft per request (FR-33).

#### FR-42: Same state for everyone, after any reload
Every participant sees the same transfer assessment, attempts, attempts left and outcome after joining, reloading, reconnecting or using several tabs.
**Grounding:** P4.

**Consequences (testable):**
- A late or duplicate update cannot reopen a finished transfer assessment.

#### FR-43: AI suggestions after transfer assessments
The AI assistant gets transfer-assessment outcomes only from the saved conversation, and generates no AI suggestion while the learner's result messages are still being saved.
**Grounding:** P4, P1.

**Consequences (testable):**
- While exit assessment is in force: the AI assistant's conversation history leaves out the learner's open transfer assessments, the answers to them and any results not yet final, because the learner cannot see them until exit. Ended transfer assessments from earlier exits, with their result messages, stay in the history as learning evidence.
- While exit assessment is in force: the AI assistant's assessment rules tell it that the learner answers transfer assessments only at exit, so a suggestion never refers to an open one or invites the learner to answer it, and never reveals or hints at its answer. The rule requiring tutor feedback before another transfer assessment is removed (FR-41).

#### FR-54: Exit assessment (temporary)
While exit assessment is in force, a learner who leaves a room while any of their transfer assessments is open must first answer them in a pop-up, one at a time. Realizes UJ-1.
**Grounding:** P1, P6, P4, C3, C5.

**Consequences (testable):**
- There is no runtime switch. Exit assessment replaces in-dialogue answering in place. The in-dialogue implementation of FR-32–FR-43 is archived unchanged on branch `assess-in-dialogue` (commit `ebc03d1`); restoring it is a redeploy of that branch. Deploying either version never closes, regrades or deletes a transfer assessment.
- Leaving includes the room's back and leave navigation, closing or reloading the tab, and navigating the browser away.
- When the learner leaves through the room's own navigation, the pop-up lists their open transfer assessments in delivery order. Each uses the option controls of FR-37. After every attempt it shows the result message text: after a first wrong attempt the same question is answered again, and after a pass or a failure the learner moves to the next question. The learner leaves after the last one ends. A "Stay in room" control closes the pop-up and keeps the learner in the room.
- When the learner closes the tab or the browser navigates away, the browser shows its own leave confirmation. If the learner stays, the pop-up opens. If the learner confirms leaving, they leave without answering, and their open transfer assessments stay open for their next exit.
- While Guard is on, answers in the pop-up are held (FR-38) and the pop-up says "Waiting for your tutor to turn Guard off." The learner cannot leave through the room's navigation until grading resumes and the remaining transfer assessments end.
- A transfer assessment cancelled while the pop-up is open leaves it. One delivered while the pop-up is open joins it.
- A learner with no open transfer assessment leaves without a pop-up. A transfer assessment that is due but not yet delivered never holds the learner.
- Only the learner sees the pop-up. The room owner and observers leave freely.
- Each time the learner opens the room page, the server records the start of one new visit; repeated or retried entry requests from the same page load record no extra visit. A reload or a second tab starts a new visit. Which transfer assessments are due depends on the latest visit (FR-32, FR-40); due itself is still derived, never stored (AD-3).
- The pop-up is part of the room, not a separate quiz application or assessment mode (§9). It grades nothing in the browser; every grade, attempt and result comes from the server.

# Part C — Cyberbullying Practice

## 6. Cyberbullying Practice Features

**Description:** In a cyberbullying room the learner writes about a scenario from a cyberbullying template, and the room owner replies through character replies. All cyberbullying rooms share five learning targets. Realizes UJ-2.

#### FR-7: Create a cyberbullying room from a cyberbullying template
A tutor can choose a cyberbullying template, edit its post and pre-populated dialogue, and create a room.
**Grounding:** P1, P5.

**Consequences (testable):**
- For a cyberbullying room, only cyberbullying templates are offered.
- Creation is refused until a template is chosen ("Choose a Cyberbullying template.").
- Edited pre-populated dialogue keeps each comment's original author.
- The AI assistant is on for every cyberbullying room.

#### FR-44: Five shared learning targets
Every cyberbullying learner gets the same five learning targets when they join: recognize cyberbullying and its impact; show empathy and support; stand up constructively; avoid reinforcing bullying; choose a safe next step.
**Grounding:** P1, P7.

**Consequences (testable):**
- Learning targets are set up once per learner and room, even if the learner joins from several tabs.
- Learning targets cannot be edited, removed or varied by scenario. Manual progress edits (FR-53) remain available.
- Only the learner's own messages provide evidence.

#### FR-45: Supported operations
A cyberbullying room supports exactly: save a learner message, judge it against the learning targets, request a character draft, tutor review, regenerate, reject, send, rate, continue, and override Guard.
**Grounding:** P7, P6.

**Consequences (testable):**
- Transfer assessments and Quick Adjust are refused.
- A learning target is complete when it is Covered.

#### FR-46: Learner messages are saved before they are judged
A learner's message is saved first, then judged against the five learning targets.
**Grounding:** P4.

**Consequences (testable):**
- If judging fails, the message stays saved.

#### FR-47: Request a character draft (boundary)
The room owner can request one character draft for the learner's latest message, choosing the character or letting the AI assistant choose.
**Grounding:** P2, C1.

**Consequences (testable):**
- Inputs: the stored scenario, the complete conversation with each speaker's character attribution, the chosen character if any, and the Guard state.
- Output: one character and its text.
- Audience: the room owner only.
- If the room owner chose a character, the character draft uses it.
- A request is refused when the AI assistant is off or there is no learner message.
- The quality of character drafts has no AI behavior specification yet (§7).

#### FR-48: Review and send a character reply
The room owner can change a character draft's character and text, regenerate it, reject it, override Guard, and send it as a character reply.
**Grounding:** P2, C1, R4.

**Consequences (testable):**
- The room owner cannot send a tutor reply without first requesting and reviewing a character draft.
- Sending saves the character reply, its suggestion action and the Guard state together.
- Suggestion actions follow FR-28; changing only the character records `modified`.
- The chosen character applies to that character draft only.

#### FR-49: Consistent character identity
Every participant sees a character reply under the same character and persona name, live and after reload; the AI assistant and exports carry the same character.
**Grounding:** P4.

**Consequences (testable):**
- Sent character replies cannot be edited.

# Part D — AI Boundaries and Cross-Cutting Sections

## 7. AI Behavior Boundaries

Each AI job's boundary FR states what the system guarantees around it. The quality of its output is governed by the listed AI behavior specification and constitution and verified by evaluation, not by code tests.

| AI job | Boundary FRs | AI behavior specification | Evaluation | AI behavior constitution |
| --- | --- | --- | --- | --- |
| AI suggestions, including Guard recommendations | FR-25, FR-26, FR-27, FR-30 | `tutor-system/docs/ai-behaviors/tutor-behavior-specification.md` T01–T08, G01–G03 | `evals/promptfoo/` tutor suite | `tutor-system/docs/ai-behaviors/constitution.md` |
| Assessment drafts | FR-33, FR-34 | `tutor-system/docs/ai-behaviors/tutor-behavior-specification.md` T09.1–T09.6 | `evals/transfer-assessment/` | `tutor-system/docs/ai-behaviors/constitution.md` |
| Learning-event judging | FR-20 | `tutor-system/docs/ai-behaviors/tutor-behavior-specification.md` T02 analysis responsibilities; `tutor-system/docs/ai-behaviors/transfer-status-response-contract.md` | `evals/promptfoo/learning-progress-analyzer/` | `tutor-system/docs/ai-behaviors/constitution.md` (phishing only) |
| Character drafts | FR-47, FR-48 | none | none | none |
| Learning-target generation | FR-18 | none | none | none |

## 8. Cross-Cutting NFRs

- **NFR-1 Human supervision.** No AI-generated text reaches a learner without the room owner's explicit send. The AI assistant never changes room state on its own. **Grounding:** P2, C1.
- **NFR-2 Server authority.** Grading, attempt counting, whether a transfer assessment is due, learning progress changes, the learner seat and private transfer-assessment data are decided on the server. The browser never grades or changes learning progress directly. **Grounding:** P4, C3.
- **NFR-3 Private material.** Correct answers and learner explanations stay private until a second wrong attempt (FR-39). The reasoning behind a transfer assessment and raw AI output are never visible to participants. Reasons and instruction labels are visible to the room owner only. AI provider credentials never reach the browser. **Grounding:** C5, P2, C6.
- **NFR-4 Identity model and accepted risk.** The application identity identifies users but does not authenticate them, and room data is readable and writable by any client of the app, except the private material in NFR-3. This is accepted for the current small-scale pilot, in which students use the platform under close adult supervision and ease of use takes priority over authentication. Accepted consequences: anyone can act as any user by typing the same name and role, and any participant can read any room's messages and password. **Grounding:** P5, P6, R1.
- **NFR-5 Reliable repetition.** Repeating any request (send, attempt, delivery, judging) produces no duplicate effect. Concurrent requests resolve to one outcome. **Grounding:** P4.
- **NFR-6 Persistence.** The application identity, conversation, learning progress and transfer-assessment state survive reloads, reconnects and multiple tabs. Rooms are kept after use. **Grounding:** P4, P8, C4.
- **NFR-7 Fail visibly.** When something needed is missing or fails (conversation history, learning targets, AI output, configuration), the user gets a clear error. No placeholder content and no hidden fallback. **Grounding:** P7.
- **NFR-8 Live updates.** Messages appear for all participants within about 2 seconds; room lists and ratings update without refresh. **Grounding:** P5.
- **NFR-9 AI behavior governance.** The quality of every AI job's output is governed by an AI behavior constitution and specification (§7), each child principle naming its parent in the product constitution. The tutoring constitution governs phishing only; AI jobs without a constitution fall directly under the product constitution until one exists. **Grounding:** P1, P3.
- **NFR-10 Behavior change control.** Changing an AI model, a shared prompt or the learning-event judge changes behavior for every practice type that uses it, and must be re-evaluated for each. Constitutions change only through an explicit human decision; passing evaluations cannot authorize a change. **Grounding:** P7.
- **NFR-11 Client compatibility.** A browser running an outdated version of the app is told to reload, rather than writing data under old rules. **Grounding:** P4.
- **NFR-12 Platform.** Responsive web app for desktop, tablet and phone, in current mainstream browsers. **Grounding:** P5.

## 9. Non-Goals (Explicit)

- No accounts, passwords or email sign-in. No authentication product.
- No AI that speaks to learners directly or enforces anything automatically.
- No room-level "assessment mode", no separate quiz application, and no transfer assessments in cyberbullying rooms. The exit pop-up (FR-54) answers transfer assessments inside the room and changes no room mode.
- No permanent mastery claim; the platform does not measure long-term retention or real-world behavior.
- No multi-agent or simulated peer characters in phishing rooms (the retired "Riley").
- No scenario-specific cyberbullying learning targets.
- No tutor-made templates.
- No clearing of chat history; rooms are kept as pilot data.
- No new room-wide learning targets. Old rooms that already have them are left as they are and are not revisited.
- No reuse of rooms and no release of the learner seat.
- No violation counting for Guard and no question quota for AI suggestions.

## 10. Scope

### 10.1 In Scope
- Everything in Parts A–C for the current small-scale pilot.

### 10.2 Out of Scope
- **Success metrics and goals.** Deliberately left out of this baseline (decision of 2026-10-22). Add them when the next initiative sets targets.
- **Custom image upload** for avatars and rooms.
- **More than one learner per room.**
- **Learning-outcome measurement** (pre/post testing, retention).
- **Consent and data-retention processes.** Not needed for the current pilot.
- **A formal accessibility conformance target** (for example a WCAG level).

## 11. Open Questions and Decisions

Open: none.

Exit assessment decisions of 2026-10-29 and 2026-10-30 are recorded in `addendum.md` §G.

Questions OQ-1 to OQ-15 were all resolved on 2026-10-22. Each decision is built into the requirements; the list is in `addendum.md` §E.

## 12. Assumptions Index

- FR-52 — A tutor who is not the room owner takes part as an observer.
