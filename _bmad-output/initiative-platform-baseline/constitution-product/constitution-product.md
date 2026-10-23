---
title: Product constitution
status: draft
created: 2026-10-22
updated: 2026-10-22
---

# Product constitution

Intent: define the principles, non-negotiable constraints and priority rules that every requirement of the Online Safety Tutor Platform must trace to, so that system contracts (the PRD) and AI behavior (AI behavior constitutions and specifications) answer to one root and conflicts between values are decided in one place.

Updated: 2026-10-22. Repository baseline commit: `b671519`. Status: draft — principles and priorities await the owner's approval; constraints and rules marked with a decision are already the owner's decisions of 2026-10-22.

## Scope and layering

This constitution is the root. It states what the platform values and which value wins when they conflict. It does not state how a value is realized. Two branches realize it:

| Branch | Documents | Verified by | Cites this constitution as |
| --- | --- | --- | --- |
| System contracts | `prd-tutor-platform/prd-tutor-platform.md` (FRs, NFRs) | code tests: unit, integration, database and browser | `Grounding: P2, C1` on each FR and NFR |
| AI behavior | AI behavior constitutions (for example `tutor-system/docs/ai-behaviors/constitution.md`) and their behavior specifications | evaluations: rubrics, gold labels, human review | `Parent: P1` on each child principle |

The two branches meet only at boundary FRs in the PRD: for each AI job, the PRD states its inputs, output shape, audience, gates and failure handling, and points to the behavior specification that governs the quality of its content.

Layering rules:

1. A child principle names its parent principle here. It may narrow the parent; it may not contradict it.
2. A conflict between two principles of this constitution is decided only here, by an R rule. A child constitution decides only conflicts inside its own domain.
3. Every FR and NFR cites at least one principle or constraint. A requirement with no grounding is either missing a principle or not needed.
4. An AI job whose output reaches learners or drives learning progress is governed by a child AI behavior constitution and specification. Until one exists, it falls directly under this constitution, and the missing child is a recorded gap.

## Principles

| ID | Principle | Owns | Does not own |
| --- | --- | --- | --- |
| P1 | **Learner understanding over activity.** The platform exists to build the learner's own understanding and judgment about online risks. | What counts as learning: progress comes from what the learner shows, and checks follow demonstrated understanding rather than activity, time or compliance. | How an AI reply teaches (child constitutions). |
| P2 | **Adult supervision of the practice, including AI output.** One accountable adult, the room owner, oversees each practice and decides what reaches the learner, whether it comes from AI or not; other adults may watch. | Who decides and who may watch; what the supervisor sees (learning progress, AI reasons); the supervisor's manual corrections; and that AI never acts on the room by itself. | Whether a given AI proposal is good (child constitutions). |
| P3 | **Learner safety and dignity.** Learners are protected from harm, including harm from the practice itself, and are never humiliated. | Protective priority when a learner is at risk; managing disruption without degrading the learner; the boundaries of practice content. | Wording and tone of individual replies (child constitutions). |
| P4 | **A trustworthy learning record.** What the platform records about learning — messages, progress, attempts, results, reviews — is accurate, consistent for everyone, and kept. | Server authority, evidence behind every change, consistency across viewers and reloads, and retention of pilot data. | Whether AI judgments recorded in it are correct (child constitutions). |
| P5 | **Ease of use with minimal cognitive burden.** Tutors, learners and observers can start and run a practice with minimal steps, and each sees only what they need. | Joining without accounts, simple room creation, single-use rooms, and keeping irrelevant items out of view (for example test rooms out of teaching lists). | How much is built (P6). |
| P6 | **Quick implementation, without immediate harm.** At the pilot stage, a need is met with the smallest change that works, reusing existing mechanisms; known limitations are accepted and recorded instead of building ahead of need. A shortcut is never taken when its failure would cause immediate, uncontrolled harm, such as leaked AI provider credentials. | Scope cuts, reuse over new infrastructure, the list of accepted limitations, and the line between an acceptable limitation and an immediate harm. | Anything that would break C1–C6. |
| P7 | **Predictable behavior.** Each thing is done one way, and failures are visible. | One mechanism per job across rooms and practice types, closed sets of supported operations, no hidden fallbacks. | — |
| P8 | **Meaningful data for continuous refinement.** The platform elicits and collects the data needed to evaluate and improve the tutoring approach. | Asking participants for feedback (ratings), recording how tutors handle AI drafts, and making the data available for analysis (exports). | Accuracy of the learning record (P4). |

## Non-negotiable constraints

| ID | Principle | Constraint |
| --- | --- | --- |
| C1 | P2 | No AI-generated text reaches a learner unless the room owner sends it. |
| C2 | P1, P4 | Learning progress changes only from the learner's own contributions or the room owner's recorded manual edit. |
| C3 | P4 | Grades, attempts and progress changes are decided on the server from recorded evidence; the browser never decides them. |
| C4 | P4, P8 | Pilot data is deleted only by a tutor's explicit, confirmed deletion of a room they own, which removes their own and their students' data from it. No other action removes data: not clearing history, reusing a room or releasing the learner seat. |
| C5 | P1, P4 | Private assessment material reaches participants only at its publication point, so a transfer assessment stays a valid check. |
| C6 | P6 | AI provider credentials never reach the browser. A leak would cause immediate, uncontrolled cost and abuse, which no pilot shortcut may risk. |

## Conditional priority rules

| ID | Conflict | Rule | Decided |
| --- | --- | --- | --- |
| R1 | P5 ease of use and P6 quick implementation vs P4 trustworthy attribution | Ease and speed win while learners use the platform under close adult supervision: no authentication is built, and the application identity identifies but does not authenticate. Attribution relies on that supervision. Revisit when use is no longer supervised. | 2026-10-22, OQ-1 |
| R2 | P4 and P8 keeping the record vs P5 tidy, reusable rooms | Keeping the record wins: no clearing of chat history, no reuse of rooms, no release of the learner seat. The one exception is C4: a tutor may delete a room they own, because tutors have the right to remove their own and their students' data. | 2026-10-22, OQ-4 and FR-17 withdrawal |
| R3 | P1 a valid check vs P1 learning from a mistake | Before a transfer assessment ends, the answer stays private (C5). After the second wrong attempt, learning wins: the correct answer and explanation are published to the whole room. | 2026-10-22, OQ-2 |
| R4 | P2 supervision vs P5 speed | Supervision wins: every AI draft is reviewed by the room owner, who may reject it and write their own reply, even when that is slower. | 2026-10-22, OQ-7 |
| R5 | P2 accountable supervision vs P5 shared tutoring | One accountable supervisor wins: only the room owner uses tutor controls in a room. | 2026-10-22, OQ-8 |
| R6 | P3 safety vs P1 teaching flow | When a learner is about to take an unsafe action, protection comes before exploration; teaching resumes afterwards. | 2026-10-22; inherited from the tutoring constitution R2, confirmed as a root rule |
| R7 | P7 one mechanism vs per-room or per-practice variation | One shared mechanism wins unless a practice type needs a different behavior for learning reasons: all new learning targets are learner-owned and judged the same way; transfer assessments accept option selections only. | 2026-10-22, OQ-6 and OQ-14 |
| R8 | P8 collecting feedback vs P5 minimal burden on the learner | Collecting feedback wins: the learner rates every tutor reply before writing again. The rating stays one quick step (helpful or unhelpful plus stars). | 2026-10-22, OQ-9; confirmed as a root rule 2026-10-22 |

## Children of this constitution

| AI job | Child constitution | Status |
| --- | --- | --- |
| Phishing AI suggestions, including Guard recommendations | `tutor-system/docs/ai-behaviors/constitution.md` (phishing only) | Exists; parent links applied (below) |
| Transfer assessment generation | `tutor-system/docs/ai-behaviors/constitution.md` | Exists; parent links applied |
| Learning-event judging | `tutor-system/docs/ai-behaviors/constitution.md` for phishing | Gap: cyberbullying judging has no child constitution |
| Cyberbullying character drafts | none | Gap |
| Learning-target generation (Smart Generate) | none | Gap |

Parent links for the tutoring constitution (applied on 2026-10-22 with the owner's approval, in its "Parent links" section):

| `tutor-system/docs/ai-behaviors/constitution.md` | Parent |
| --- | --- |
| P1 Deliver contextualised knowledge | P1 |
| P2 Facilitate the learner's construction of understanding | P1 |
| P3.1 Learner confidence and emotional safety; H2 | P3 |
| P3.2 Authentic tutoring relationship; H3 | P3 |
| P3.3 Constructive participation (Guard) | P3, P2 |
| P4 Explainability for human supervision; H4 | P2 |
| H1 No falsehoods | P4 |
| R2 Protective instruction before exploration | P3 (root rule R6) |

## Decision record and revision authority

Only an explicit decision by the product owner adds, removes or reorders a principle, constraint or rule here; passing tests or evaluations cannot. Each change is recorded below with its date and reason. A child constitution may be revised by its own authority as long as it stays within its parents.

| Date | Decision | Effect |
| --- | --- | --- |
| 2026-10-22 | P6 "Proportionate protection of data and identity" replaced by "Quick implementation": protection is not a goal at the pilot stage. | P6, R1, R3, C5 |
| 2026-10-22 | Quick implementation excludes shortcuts whose failure causes immediate harm; AI provider credentials stay server-side. | P6, C6 |
| 2026-10-22 | P2 broadened from "Human supervision of AI" to adult supervision of the whole practice, including AI output. | P2 |
| 2026-10-22 | P5 broadened to include minimal cognitive burden. | P5 |
| 2026-10-22 | New principle P8: elicit and collect meaningful data for continuous refinement (ratings, tutor review of AI drafts, exports). | P8, C4, R2 |
| 2026-10-22 | Identity identifies but does not authenticate, for supervised pilot use (OQ-1). | R1 |
| 2026-10-22 | The whole room sees the answer after a second wrong attempt (OQ-2). | R3 |
| 2026-10-22 | No seat release; rooms are single-use and kept as pilot data (OQ-4); clearing chat history withdrawn. | R2, C4 |
| 2026-10-22 | Transfer assessments accept option selections only (OQ-6). | R7 |
| 2026-10-22 | The room owner can reject an assessment draft and write their own reply (OQ-7). | R4 |
| 2026-10-22 | Tutor controls belong to the room owner only (OQ-8). | R5 |
| 2026-10-22 | The AI tutoring constitution governs phishing only (OQ-11). | Children table |
| 2026-10-22 | All new learning targets are learner-owned and judged on the server; manual edits stay (OQ-14). | R7, C2 |
| 2026-10-22 | C4 weakened: tutors keep the right to delete a room they own, and with it their own and their students' data (digital autonomy). Previously "no in-app action deletes pilot data". Open for the owner: whether data autonomy is a principle of its own rather than part of P4. | C4, R2, FR-9 |
| 2026-10-22 | Constraint IDs renamed H1–H6 → C1–C6 (the "H" came from "hard" in the AI tutoring constitution; "C" is for constraint). The tutoring constitution's own H1–H4 are unchanged. | C1–C6 |
