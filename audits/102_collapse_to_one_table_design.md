# Design: collapse transfer-assessment storage to one table

Status: AGREED DESIGN, NOT IMPLEMENTED. A half-written migration for this was created and then
deleted on purpose; see "Why no migration is committed yet".

## Owner decision driving this

Four of the five transfer-assessment tables are over-design. The answer key may live on the tutor
message row even though `public.messages` is readable by every room participant, because this is a
training app, not a strict exam, and a working function outranks key confidentiality.

This is a deliberate, recorded tradeoff, not an oversight. The previous design put the key in a
table with RLS enabled and **zero policies** plus no grants to `anon`/`authenticated`, specifically
to make it unreadable through the API. That protection is being given up knowingly.

Evidence for the exposure, queried from the live project:

```
messages: rls_enabled = true
          policies     = "Anyone can view messages in active rooms[public]", "Allow message operations[public]"
          authenticated_can_select = true
```

So `GET /rest/v1/messages?select=*&room_id=eq.X` would return the key. The UI not rendering the
column is irrelevant.

## Table disposition

| Table | Action |
|---|---|
| `private.learning_event_inbox` | **KEEP.** The only thing that applies `assessment_pass` / `assessment_fail` to `checklist_items`. |
| `private.assessment_question_keys` | DROP. Key moves to `messages.assessment_key`. |
| `public.assessment_questions` | DROP. Options and lifecycle move to `messages`. |
| `private.assessment_drafts` | DROP. The tutor message is the assessment; no staging row. |
| `private.assessment_request_results` | DROP. No caller reuses a `request_id`, so its replay lookup never hit. |

Net: 5 tables to 1.

## Replacement columns

The grader reads three things off the question row today. They move to `public.messages`, all
nullable so non-assessment messages are unaffected:

| New column | Replaces |
|---|---|
| `assessment_options JSONB` | `assessment_questions.options` |
| `assessment_key TEXT[]` | `assessment_question_keys.correct_option_ids` |
| `assessment_lifecycle TEXT` | `assessment_questions.lifecycle` |
| `assessment_answer_message_id UUID` | `assessment_questions.answer_message_id` |
| `assessment_closed_at TIMESTAMPTZ` | `assessment_questions.closed_at` |

The `one_unresolved_assessment_per_student` partial unique index folds onto a surviving column:

```sql
CREATE UNIQUE INDEX one_open_assessment_per_student
    ON public.messages(room_id, user_id)
    WHERE assessment_lifecycle = 'delivered';
```

`messages.assessment_id` keeps pointing nowhere: its foreign key to `assessment_questions` drops
with the table, and the column is a pre-existing public column outside this component's ownership.

## Blast radius, verified

Functions that read or write a doomed table and therefore must be re-authored in the same migration:

| Function | What it does with the tables |
|---|---|
| `send_reviewed_tutor_response_v3` | writes the question row AND the key row |
| `process_assessment_message_v1` | reads the key to grade; updates the question result |
| `post_assessment_message_v1` | reads the ledger only; otherwise fine |
| `cancel_assessment_question_v1` | reads/updates the question; **zero callers** |
| `invalidate_assessment_question_v1` | reads/updates the question; **zero callers** |

Edge Function (`supabase/functions/assessment-api/index.ts`), three sites:

- line ~227 reads the open question
- line ~293 inserts the draft
- line ~322 checks for an open question via `ASSESSMENT_ALREADY_OPEN`

Generated types: `src/types/database.ts` line ~153.

Application code: **none.** Nothing in `src/` touches these tables directly.

## Why no migration is committed yet

The first attempt re-created `post_assessment_message_v1` but left `send_reviewed_tutor_response_v3`
and `process_assessment_message_v1` referencing tables that no longer existed. Applying it would
have broken delivery and grading at runtime, silently, because plpgsql bodies are not
dependency-tracked. It was deleted rather than committed.

The complete migration must re-author **all three** functions in one file, and must be verified by
the dangling-reference sweep in the T009 lane before it is offered for application.

## Required edits, in order

1. Migration: add the five columns and the open-assessment index; re-author
   `send_reviewed_tutor_response_v3` (no question or key row; stamp
   `assessment_options`, `assessment_key`, `assessment_lifecycle='delivered'` on the tutor message),
   re-author `process_assessment_message_v1` (read the key from the tutor message, not the key
   table; stamp `assessment_lifecycle='answered'` and the answer message id), re-author
   `post_assessment_message_v1` (drop the ledger lookup), drop the two zero-caller functions, then
   drop the four tables.
2. Edge Function: remove the open-question query against `assessment_questions`, the draft insert
   into `assessment_drafts`, and the `assessment_id` linkage; read open state from `messages`.
3. Generated types: drop the four table shapes.
4. Specs: `data-model.md` reduces to one table plus the message columns; `rpc-contract.md` drops the
   removed RPCs; `assessment-api.md` drops `cancel_question` and `invalidate_question`.
5. Tests: T009 PART 1 drops the assertions for the removed tables and gains one that no kept
   function body references a dropped object — the check that catches exactly the failure the
   deleted migration had.
6. Verify with the dangling-reference sweep before applying.

## TDD note

The previous TDD activation was terminated at the pre-Red gate because its slice named no
production artifact, so Red's test was also Green's only artifact. This change has both: Red owns
the test-side artifacts (T009 assertions, the lane cases), Green owns the migration and the three
re-authored RPCs. A re-entry on that basis would pass the gate.
