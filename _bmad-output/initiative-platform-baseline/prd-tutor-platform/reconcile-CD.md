# Reconciliation: extract C and extract D against the PRD and addendum

Intent: list what `extract-C-cyberbullying-rooms-targets.md` and `extract-D-platform-tested-behavior.md` say that `prd-tutor-platform.md` and `addendum.md` drop, contradict or misstate. Owner decisions in `.memlog.md` (OQ-1 to OQ-15, FR-17 withdrawal, G-4 withdrawal) were treated as final. Items the addendum already records as gaps (G-1 to G-28) are not repeated unless the gap is incomplete. AI output quality is delegated to companion specs and is not judged here; only boundary behavior is.

Date: 2026-10-22. Severity: High = a requirement is false, or a user hits a dead end, with no recorded gap. Medium = a contract is overstated or a boundary behavior is missing. Low = detail loss.

Total: 22 gaps (2 High, 9 Medium, 11 Low).

## High

### CD-01 A long cyberbullying room becomes a dead end, and the draft failure modes are not stated
- Extract: C-21, C-28, Q-11, Q-13. The server returns 413 `CONTEXT_TOO_LARGE` above 50,000 characters, 502 `AI_OUTPUT_TRUNCATED` on truncated output, and fails after 2 invalid-output attempts. The dialogue is sent as one JSON message. Clear chat is unsupported for cyberbullying.
- PRD says: FR-47 lists inputs, output and refusals (AI off, no learner message). FR-48 says the owner cannot send a tutor reply without first requesting and reviewing a character draft. FR-25 and FR-27 give the error and repair rule for phishing only. Addendum B lists the limits but no consequence.
- Why it matters: once a room's history exceeds the limit, no character draft can be produced, so the owner can never reply again. Rooms are single-use and cannot be cleared (FR-17 withdrawn, section 9).
- Suggested fix: add to FR-47 that invalid or truncated output, and a conversation over the size limit, show the owner an error and generate no draft. Add a gap or open question for the long-room dead end (a size limit, or an owner-typed reply path). Add the equivalent of FR-27's output-contract rule to FR-47.

### CD-02 Cyberbullying judging failure is silent, against FR-46 and NFR-7
- Extract: C-20. When analysis of a saved learner message fails, "the failure is logged, not thrown" (`RoomContext.tsx:738-744`). The unprocessed prefix is re-analyzed on the next send or focus (C-13), and before generating a character draft (C-21).
- PRD says: FR-46 says "if judging fails, the message stays saved". FR-20 says the message "stays retryable". NFR-7 says the user gets a clear error. Addendum G-12 lists silent fallbacks but not this one.
- Suggested fix: add a gap (the tutor and learner are not told that progress did not update). State in FR-46 when retry happens. Say whether a failed prefix analysis blocks character-draft generation (C-21 analyzes the prefix first).

## Medium

### CD-03 Regenerate in cyberbullying records `modified`, but the PRD says `ignored`
- Extract: C-22. In cyberbullying, regenerate records `modified`. Replacing the draft with a new suggestion records `ignored`.
- PRD says: FR-48 says "Suggestion actions follow FR-28". FR-28 says a new request records `ignored`. G-7 covers only the phishing Quick Adjust case.
- Suggested fix: extend G-7 to cyberbullying regenerate, or state the cyberbullying rule in FR-48.

### CD-04 Tutor-ownership gap is wider than G-14
- Extract: D section 2 matrix, C1 and C12. A tutor can send messages in any room (no owner check on send). `deleteRoom` warns on an owner mismatch but proceeds. Clear history checks ownership in the browser before the trusted call. Only cyberbullying draft generation checks ownership on the server.
- PRD says: FR-52 lists "tutor replies" among owner-only controls and says "the server refuses tutor operations from anyone but the room owner". FR-9 limits deletion to own rooms. G-14 names only AI, Guard and learning-progress controls.
- Suggested fix: extend G-14 to tutor replies, room deletion and manual progress edits. FR-52's "server refuses" consequence is false today for phishing rooms; mark it a target state tied to G-14.

### CD-05 Export content is gated by global role, and the learning-progress rules are imprecise
- Extract: D C11, section 2, Q8, Q6. Export role gating uses the user's global `current_role`, not the room role. TXT exports never include learning progress. Phishing exports omit durable learner progress (C extract Q-08, undecided).
- PRD says: FR-50 says the owner's export adds tutor-review records. It also says "Cyberbullying exports include the learner's learning progress for every participant". Neither the TXT limit nor the phishing behavior is stated, and Q-08 is neither resolved nor listed.
- Consequence: a non-owner tutor gets the AI interaction data and the owner-only export content (conflicts with NFR-3 and FR-52). This is a data-boundary gap, not only a controls gap.
- Suggested fix: add a gap for global-role gating. State "JSON only" for learning progress. Record the phishing-export decision explicitly.

### CD-06 Identity continuity when a user changes their name or role
- Extract: D C1.2, C2.1, C15, Q2. The user ID is a hash of normalized name and role. Profile edits keep the old ID, but a fresh join with the new name or role makes a different user. Two honest users with the same name and role are one user.
- PRD says: FR-1 "the same name and role return the same user on any device". FR-2 "the user identifier does not change". FR-9 "see the rooms they own whenever they return". NFR-4 mentions only impersonation.
- Consequence: after a profile rename, rejoining on another device creates a new user who owns no rooms. A learner cannot reclaim the learner seat, and the seat is permanent (FR-12).
- Suggested fix: add a testable consequence to FR-2 and an accepted consequence to NFR-4 (name collisions, loss of ownership and seat after a rename on a fresh device).

### CD-07 Read-only observation is weaker than FR-13 claims
- Extract: D C7 and C4.5, NFR-5, Q8. A student in room-observer mode is blocked only by the UI. The `sessionStorage` flag is removed on first read, so a reload loses observer mode. The `messages` policy is ALL/true. In cyberbullying rooms the database rejects non-learner inserts (C-08, `OBSERVER_READ_ONLY`).
- PRD says: FR-13 "Observers cannot post". NFR-6 says state survives reloads. G-2 covers direct database access in general.
- Suggested fix: add a gap (reload drops a student's observer mode in phishing rooms). Note that the server enforces read-only for cyberbullying rooms only.

### CD-08 Operator switch and in-room assessment toggle: effect on due and open assessments
- Extract: D NFR-11 (rollback "disables new generation and delivery without deleting evidence"), C X-05 (an item reaching Covered from Partial is marked assessment due; in cyberbullying that phase never resolves).
- PRD says: FR-31 lets the owner turn in-room assessment off and the operator turn assessments off everywhere. FR-32 to FR-37 do not say what happens to a due or open assessment when the switch goes off, or to targets that became Covered while it was off when it goes on again.
- Consequence: FR-37 disables the learner's ordinary messaging while an assessment is open. A switch-off with an open assessment could leave the learner locked out.
- Suggested fix: add consequences to FR-31/FR-32 for toggling off and on mid-room, including that an open assessment does not strand ordinary messaging. Say that nothing is deleted.

### CD-09 Evidence rules for `behavior` items are undefined
- Extract: C K-05, Q-02, C-14. Four of the five cyberbullying targets are `behavior` items, one is `understanding`. The response contract defines evidence-type rules only for `understanding` and `detection_area`.
- PRD says: FR-44 and FR-20 delegate judging. G-27 notes only the missing constitution.
- Suggested fix: add this to G-27 (no evidence-type rule for behavior items, so cyberbullying judging has an undefined contract) or to the contract.

### CD-10 Riley retirement: stored transcripts and cleanup status
- Extract: C-26, Q-10, cb-request R3. Stored historical Riley transcripts are preserved, not destroyed by cleanup. The multi-agent template is hidden. Cleanup completeness is unverified (`RoomContext.multiAgentDraft.test.tsx` remains).
- PRD says: only the section 9 non-goal "no multi-agent or simulated peer characters in phishing rooms".
- Suggested fix: add a consequence (old rooms keep their Riley messages, with the persona shown) and a cleanup-verification gap.

### CD-11 Deleting a room versus "rooms are kept"
- Extract: C-09, D section 2 (`deleteRoom` proceeds on owner mismatch). "Active room" is the only room lifecycle state in the code (D C3, C6). No source says what ends activity.
- PRD says: FR-9 lets the owner delete a room. The glossary and NFR-6 say rooms are kept after use as pilot data. FR-11 and FR-13 list "active rooms", never defined.
- Suggested fix: define "active", and say what delete removes (messages, learning progress, private assessment data, exports) or that it is hard delete.

## Low

### CD-12 Cyberbullying draft output shape is incomplete
- Extract: C-21, C glossary. The model output is JSON with `student_role` (4 learner categories), `response_in_role` (5 characters) and `final_response`. `student_role` flows into `guard_reason`.
- PRD says: FR-47 output "one character and its text". FR-30 mentions Guard recommendation for phishing only.
- Suggested fix: state whether a cyberbullying draft carries a learner classification or Guard recommendation visible to the owner, and where it is recorded.

### CD-13 Browser-held draft lifecycle
- Extract: C-22, C-21. Draft state lives in the browser, and reload or discard expires it. Late results are dropped after a new request or room switch. A failed regenerate keeps the current draft and character. No record is made for a draft lost to reload.
- PRD says: nothing about draft persistence. FR-51 says the system records every draft's action.
- Suggested fix: add one line to FR-28/FR-48 and a limit to FR-51 (drafts lost by reload leave no record).

### CD-14 Draft-time context details
- Extract: C-28, C-21. Messages whose user row is missing are dropped silently by an inner join. The pending learner prefix is analyzed before generation.
- PRD says: FR-47 "complete conversation".
- Suggested fix: add as a gap (silent drop against NFR-7) or restate "complete".

### CD-15 Prompt audience age differs from the owner's learner age
- Extract: C section 3 ("simple language, learners aged 9-14").
- PRD says: learners are about 7-12 (section 2.1; owner edit in memlog).
- Suggested fix: add a gap for the prompt age band, owned by the future character-draft specification (G-25).

### CD-16 Canonical wording of the five cyberbullying targets
- Extract: C-19, K-04. The database trigger requires exact stored text. `cyberbullying-practise.md` is a paraphrase. The PRD list is another paraphrase.
- PRD says: FR-44 lists short names and cites `cyberbullying-practise.md` as the companion.
- Suggested fix: name `detectionTemplates.ts` and the migration as canonical, or state that the names are labels only.

### CD-17 FR-7 omissions
- Extract: C-03, C-26. The original poster of a cyberbullying room is the scenario post author with the scenario avatar, the title defaults to "Cyberbullying practise - {scenario.id}", and the catalog has 2 situations pinned to a Copilot commit with hashed images. Any change to the role strategy is an explicit reviewed correction (upstream fidelity).
- PRD says: FR-7 says the owner may edit the post. The glossary says the original poster is the owner's profile or a custom name.
- Suggested fix: state the poster rule, and the pinned-upstream fidelity rule in section 7 or FR-47.

### CD-18 Known Learning Progress panel defect not recorded
- Extract: C-17. A collapsed-button overlap exists at 1024, 769, 768 and 320 px.
- PRD says: FR-23 says the panel never covers the owner's AI controls on desktop and uses full width on narrow screens.
- Suggested fix: add a gap.

### CD-19 Custom image upload control is still shown
- Extract: D C13, Q5. The UI offers upload; it always fails with "User not authenticated". Tests mock `auth.getUser`.
- PRD says: section 10.2 and G-1 treat it as out of scope and broken.
- Suggested fix: add to G-1 that the control should be hidden or removed (NFR-7).

### CD-20 No rate limiting or audit trail
- Extract: D section 4 (non-goal 8: "no rate limiting, limited audit logging").
- PRD says: NFR-4 and section 9 are silent. Anyone can type a tutor's name and call the AI functions repeatedly.
- Suggested fix: add to NFR-4's accepted consequences (cost and abuse exposure) or to section 9.

### CD-21 Glossary: non-owner tutor is not an Observer
- Extract: D C6 (observer join requires `current_role='observer'`), D section 2.
- PRD says: the glossary defines Observer as the observer role or a student entering an occupied room. FR-52 says another tutor "takes part as an observer" and the assumption index repeats it.
- Suggested fix: add a non-owner tutor to the Observer definition, or reword FR-52.

### CD-22 Smaller details dropped
- Smart Generate removes exact duplicates after trimming (C-11). Not in FR-18.
- At most one eligible event is applied per target per message (C-14). Not in FR-20.
- Unknown historical Guard provenance stays null and never becomes false (X-06). Not in FR-51.
- The rating gate targets the latest unrated tutor reply (X-11). FR-16 says "most recent".
- Maintenance mode refuses writes (`PRACTICE_MAINTENANCE`, C-25). NFR-11 covers only outdated clients.
- A phishing template also sets the AI configuration (C-04). FR-6 lists scenario, image, poster, password and dialogue.
- Learner-owned targets cannot be edited in place (C-12, `checklistService.ts:959`). FR-32 says that changing a target's wording cancels an open assessment. Verify the edit path exists.
- Test rooms are identified by the title marker, a `Demo:` template or a `DemoTutor_*` owner, not only by creation area (C-05, D C3). FR-8 and the glossary define them by creation area.
- Suggested fix: add each as a one-line consequence or addendum note.

## Checked and consistent (no gap)

The single-learner rule (FR-12), practice type immutability (FR-5), password gate (FR-10, accepted G-3), pre-populated dialogue never rated or evidence (FR-16, FR-20), the five fixed cyberbullying targets and no scenario variation (FR-44, section 9), the closed operation set (FR-45), persona names (glossary, FR-49), client-contract gate (NFR-11, addendum B), shared model change control (NFR-10, G-20), Guard pausing progress (FR-22), the saved-before-judged rule (FR-46), the withdrawal of clear chat (FR-17, G-21), and the identity-risk acceptance (NFR-4).
