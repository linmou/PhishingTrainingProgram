# Reconciliation A+B: extracts vs PRD and addendum

Intent: list what `extract-A-pedagogy-tutoring.md` and `extract-B-transfer-assessment.md` say that `prd-tutor-platform.md` and `addendum.md` silently drop, contradict or misstate. Owner decisions in `.memlog.md` override the extracts. AI behavior detail (T01-T09, G01-G03) is delegated and not flagged. Do not edit the PRD from this file; it is input to the next revision.

Date: 2026-10-22. Total: 24 gaps (2 High, 10 Medium, 12 Low).

Extract items already resolved by owner decisions and therefore NOT flagged: free-text/clarification/assisted answers (OQ-6), reject/regenerate and re-proposal (OQ-7, memlog FR-35 change), tutor controls (OQ-8), rating gate scope (OQ-9), constitution scope (OQ-11), consent/retention (OQ-12), second-failure audience (OQ-2), length policy (OQ-5, G-5), regenerate-as-modified (G-7), error wording (G-8), stem overwrites context (G-9), retry wording (G-10), temperature ignored (G-6), typing/latency (G-19), clear history (FR-17, G-21), Riley (Non-Goals), identity/anonymous reads (NFR-4, OQ-1).

## High

**R-1. Guard turned on while a transfer assessment is open**
- Extract: B C9.4, C10.3 — while Guard is active a submitted answer is still graded and its result message saved in the same transaction; only the progress change is deferred, and it resumes after Guard clears if the target and cycle are still valid.
- PRD says: FR-22 pauses progress under Guard; FR-36 refuses delivery under Guard; FR-38/FR-40 say pass makes the target complete, fail moves it to Needs review. Nothing says whether the learner can still answer under Guard, whether the attempt and result message still happen, or when the pass/fail takes effect.
- Severity: High. A literal reading of FR-22 and FR-38 together is ambiguous about attempts and result messages, and the transfer flow is the part with most concurrency risk.
- Fix: add to FR-38 or FR-22: "If Guard is turned on while a transfer assessment is open, the learner can still answer; the attempt is graded and its result message saved; the progress effect (FR-40) is applied when Guard ends, only if the learning target and assessment are still valid."

**R-2. Cancelling an open transfer assessment, and the closure message**
- Extract: B C2.5, C9.2, C10.4 (`assessment_event.kind = closure`), C11.6 — an open question is cancelled without using an attempt when the target's wording or progress state changes; a closure message is saved; a contradiction reopens Covered/Partial. B glossary: "Closure message" saved for cancellation.
- PRD says: FR-32 "A later contradiction cancels the due transfer assessment; changing the learning target's wording cancels an open one". FR-39 "Every accepted attempt creates exactly one result message". Glossary has no closure message. FR-53 (manual progress edit) says nothing about assessments. FR-37 says ordinary messaging "reopens when the transfer assessment closes".
- Gaps: (a) a progress-state change of an open assessment (contradiction while open, or a manual edit under FR-53) is not stated as a cancel trigger; (b) a manual edit that sets a target to Covered, or away from it, and its effect on "due" is undefined; (c) the learner and observers see no stated record of a cancellation, so the learner's composer reopening has no visible explanation; (d) FR-39 contradicts the existing closure message by saying result messages exist only for accepted attempts.
- Severity: High (manual edits are now a supported feature, FR-53; they interact directly with eligibility).
- Fix: add a "Cancel" consequence: cancel triggers = target wording change, progress state change from any cause incl. FR-53; a cancel uses no attempt, saves one fixed-text closure message visible to everyone and included in exports, and reopens ordinary messaging. State that a manual edit never by itself makes an assessment due.

## Medium

**R-3. Grading, progress and result message commit together**
- Extract: B NFR-5, C10.3 — grade, accepted attempt, progress, history and result message commit atomically; if the result message write fails the grade rolls back.
- PRD: NFR-5 covers duplicates only; FR-39 does not say an attempt cannot exist without its result message.
- Fix: add to FR-39: "An attempt, its effect on learning progress and its result message are saved together or not at all; if the result message cannot be saved, the attempt is not counted and the learner is told to try again."

**R-4. Tutor feedback must answer the terminal result**
- Extract: B C12.1-3, Q6, QA-TA-09A — feedback must be a human tutor reply parented to that assessment's terminal answer; a reply about the next topic does not count; the next AI turn after a terminal result is tutoring feedback or Guard, never an assessment payload.
- PRD: FR-41 says only "must send tutor feedback", with the glossary "the room owner's own tutor reply to the learner's final attempt" (parent link implied but not testable).
- Fix: add consequences: "Tutor feedback counts only if sent as a reply to the learner's final attempt"; "the AI suggestion requested after a terminal result is never an assessment draft". Resolve extract Q6 (not in §11).

**R-5. Order of several due transfer assessments, and learning-target attributes**
- Extract: B C12.4, Q8, C1.3 — queued "in the server's priority order"; learning targets carry a type (detection area, verification step, understanding, behavior) and priority (critical, important, optional). A C3.4: one unmet target is chosen per turn.
- PRD: FR-41 "offered one at a time" with no order; Glossary "Learning target" has no priority or type; FR-18 lets the owner enter targets without priority.
- Fix: state the order (target priority, then earliest due) or declare it unspecified; say whether priority is a PRD concept or an implementation detail (addendum B).

**R-6. No requirement lets the room owner edit or remove learning targets**
- Extract: B C2.5, C1.3 — editing wording invalidates readiness and cancels open questions; editing notes or priority keeps readiness; re-initialising keeps existing items and progress.
- PRD: FR-32 depends on "changing the learning target's wording", but FR-18/FR-44/FR-53 give no way to edit or remove phishing learning targets after approval. FR-44 says cyberbullying targets "cannot be edited". Re-approving targets (idempotency) is not stated for phishing.
- Fix: add an FR (or a FR-18 consequence): whether and when phishing targets can be edited, which edits cancel assessments (R-2), and that re-approval never resets progress.

**R-7. Evaluation gate weakened**
- Extract: A NF-EVAL1 (at least 80% per metric on ecological, holdout and correction slices), NF-GOV1, C3 status (model conformance unproven).
- PRD: FR-26 "released only after its evaluation suite has been run"; NFR-10 "re-evaluated". Run-only is weaker than pass. Addendum G-20 records a failed run on a deployed model, so the PRD baseline may be intending "run, not pass".
- Fix: state the release criterion explicitly (threshold passed, or owner-recorded exception), and say which it is for the baseline.

**R-8. Whether the learner is told that a reply was AI-assisted**
- Extract: A NF-PRIV1 (the "AI chatbot" badge is hidden from students; stale-doc source, `docs/ai-assistant-module.md:145`), V3.
- PRD: silent. FR-14 and Glossary treat AI-drafted replies as ordinary tutor replies; character replies appear under persona names. For a product for ages 7-12 this disclosure choice is a boundary behavior.
- Severity: Medium (source doc is stale; confirm in code).
- Fix: confirm the code behavior, then add an FR/NFR stating whether learners are told replies are AI-assisted, and an open question if undecided.

**R-9. FR-22 claims events gathered during Guard are applied afterwards; extracts support only the assessment case**
- Extract: A C13.5 says only "learning progress is locked" at the UI (`RoomPagePost.tsx:1094`); B C9.4 defers progress only for assessment grades.
- PRD: FR-22 "learning events gathered meanwhile are applied when Guard ends, if still valid"; UJ-4 "learning progress does not advance".
- Severity: Medium (may be right; source is extract C or D, outside this comparison).
- Fix: verify against code; if learner-message judging is simply skipped or the UI lock only blocks manual edits, restate FR-22 and add an assumption tag or gap.

**R-10. Operator kill switch and per-room setting in flight**
- Extract: B C16.1-2, C14.5, X8/Q4 — an operator `false` makes every assessment operation return a disabled error and the room shows "unavailable"; legacy tutoring and Guard keep working; history readiness for historical assessments still applies when disabled but `read_review` is refused.
- PRD: FR-31 "operator can turn transfer assessments off everywhere", "AI suggestions and Guard keep working" (per room only). No behavior for an assessment that is due or open when the switch (or the room setting) is turned off, and no "unavailable" state.
- Fix: state the learner and room-owner view when assessments are off, and what happens to due/open assessments; resolve extract Q4 (which "disabled" ARM:27 means).

**R-11. The AI suggestion request needs complete judging first**
- Extract: B C3.1, C3.2, C14.2 — preparation first runs learning-event analysis up to the focused message; incomplete analysis is a visible error (`ANALYSIS_INCOMPLETE`), never a silent fallback to ordinary tutoring; readiness also applies to a historical focus and to regeneration.
- PRD: FR-25 inputs include "the learner's learning progress" but do not require it to be current; FR-43 only covers result messages. NFR-7 is general.
- Fix: add to FR-25/FR-33: "If any earlier learner message has not been judged, the request first judges it; if that fails the room owner sees an error and no AI draft, and the same applies to regeneration."

**R-12. Learner AI-role lock and default AI role are underspecified; extract questions unresolved**
- Extract: A C14, X9, Q3, Q12 — new rooms default to Trusted adult (the feedback status says Peer); the lock has no unlock path, the tutor cannot override it, a second student joining before selection rejects the write; hidden when two or more students.
- PRD: FR-29/FR-24 give no default AI role and do not say the lock is permanent. "Exactly one student" is ambiguous now that a second student becomes an observer (Glossary). 
- Fix: state default role, that the lock is permanent for the room, and whether observing students count as "students" for the offer.

## Low

**R-13. FR-34 word limit is ambiguous**
- Extract: B C4.2 — the stem has at most two sentences; the full learner-visible question (stem plus options) has at most 80 word-like segments; boundaries inclusive at 2 and 80.
- PRD: "A question of at most two sentences and 80 words" reads as stem-only for both limits.
- Fix: "stem of at most two sentences; stem plus options at most 80 words".

**R-14. NFR-3 contradicts what the room owner sees**
- Extract: B C5, NFR-1; A C10.
- PRD: NFR-3 says correct answers stay private until a second wrong attempt, and the reasoning behind a transfer assessment is "never visible to participants". FR-35 shows the room owner the correct answer, explanation and new context during review; the owner is a participant.
- Fix: say "private from the learner and observers"; name what the owner sees (FR-35) and what stays server-only (transfer basis evidence, raw output).

**R-15. NFR-4 vs NFR-2 on writability, and "participant" vs any client**
- Extract: B C18.4, NFR-2 — direct untrusted writes cannot create attempts, read private grading data or change progress; result messages are readable by anyone who can read ordinary messages, including non-participants. Addendum G-2 lists the exposed tables.
- PRD: NFR-4 "room data is readable and writable by any client" and "any participant can read any room's messages"; NFR-2/3 claim server-only private data.
- Fix: scope NFR-4 to messages, ratings, sessions, rooms, users; say explicitly that private assessment data, attempts and progress are not exposed; replace "participant" with "any client of the app".

**R-16. Whether the room owner sees reason and instruction label live**
- Extract: A X15, Q2 — `docs/ai-suggestion-tracking.md:103` says internal reasoning is "non-visual" in the card and appears only in exports; constitution P4 wants the supervisor to inspect it.
- PRD: FR-27 and NFR-3 state the room owner sees them; no assumption tag; baseline rule says current code behavior and tag it.
- Fix: verify in code and tag [ASSUMPTION] if unconfirmed.

**R-17. Assessment drafts are not persisted**
- Extract: B C5.3, non-goals — no saved draft row or revision; "Discard" removes the local draft; the next request prepares again.
- PRD: FR-35 does not say a draft is lost on reload; FR-51 records tutor review only for AI suggestions and character drafts, so rejected or edited assessment drafts leave no research record; FR-42 says every participant sees the same state after reload but drafts are not shared.
- Fix: state that an assessment draft exists only until sent or rejected, is not recorded, and a reload discards it (or add a requirement to record it).

**R-18. Legacy and historical assessment data**
- Extract: B C17, §6 last bullet — an assessment with no recoverable key stays `legacy_incomplete`, never inferred; historical results appear exactly once; unrecoverable facts are marked unavailable; extract says the product outcome belongs in the PRD.
- PRD: only "old rooms are left as they are" (§9, learning targets).
- Fix: one line in FR-39 or §9 for historical assessments in pilot rooms.

**R-19. Assessment message presentation**
- Extract: B C15.4, NFR-11 — each participant can collapse or expand an assessment message with no shared effect; the stem and each option render once; the UI never edits the text.
- PRD: absent. Low, UI detail.

**R-20. Invalid selections consume no attempt**
- Extract: B C7.3, C9.3 — unknown option, wrong cardinality for a single-answer question, stale, foreign or undelivered submissions are rejected before anything is saved; stale = progress changed after delivery.
- PRD: FR-37/FR-38 cover non-selection answers and "late or out-of-scope" submissions only.
- Fix: add "a selection with an unknown option or the wrong number of options is refused and uses no attempt".

**R-21. Rating gate and the delivered question**
- Extract: A C15.2 — assessment-event rows are exempt from rating; B C6.2 — the delivered question is a tutor message with `response_mode: assessment`.
- PRD: FR-16 exempts "result messages", not the delivered question (the learner cannot type anyway during an open question, but an unrated question would gate the next message after it closes).
- Fix: say whether the question message needs a rating; the extract points to exempt.

**R-22. Dummy AI mode**
- Extract: A NF-DUMMY — dummy suggestions exist when `REACT_APP_ENVIRONMENT=debug` and `REACT_APP_USE_DUMMY_AI=true`.
- PRD: NFR-7 "no placeholder content" has no mention; addendum G-12 lists silent fallbacks but not this.
- Fix: add a note that this path is debug-only (or a gap if it can reach a deployed build).

**R-23. Research-instrument intent absent from the Vision**
- Extract: A V10 — tracking and export exist "for research"; memlog: rooms kept as pilot data.
- PRD: Vision never says pilot data and exports are an intended research output; FR-50/FR-51 ground only on P8. A reader cannot tell why interaction records are kept.
- Fix: one sentence in §1.

**R-24. Stale-document list incomplete**
- Extract: B X1 (QA guide Roles table says learners cannot see another learner's lifecycle), X4 (spec-102 production snapshot), X9 (QA guide retry text), X7 (spec-103 confirmation step); A X2, X11 (tracking doc migration names).
- Addendum: lists spec-101-104 headers and several docs but not `transfer-assessment-qa-guide.md`, the spec-102 snapshot or `ai-suggestion-tracking.md`.
- Fix: add to the stale list.

## Unresolved extract questions not carried into §11 or the addendum

A-Q3 (lock lifecycle), A-Q7 (age/reading level detection; feedback #8), A-Q12 (default persona), B-Q4 (which "disabled"), B-Q5 (model and provider settings hard-coded; addendum B records the fact but not the decision), B-Q6 (feedback parent rule), B-Q8 (queue order and per-session limit). These map to R-4, R-5, R-10, R-12. A-Q7 is not covered anywhere: the PRD fixes the audience at ages 7-12 but never states whether the platform adapts to age.
