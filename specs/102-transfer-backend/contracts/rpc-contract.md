# Trusted RPC Contract

<!-- Intent: freeze the versioned storage operations, transaction boundaries, lock order, and grants. -->

## Common Rules

- The Edge Function derives the actor and validates room/role scope before calling an RPC.
- Transfer mutation RPCs accept the server-derived actor and request ID, execute only for `service_role`/`postgres`, and revoke `PUBLIC`, `anon`, and `authenticated` execution.
- Scope IDs are revalidated against stored relationships inside each RPC.
- Results are allowlisted JSON. Private rows are never returned wholesale.
- Existing public tables are not a grading authority. The private assessment row is locked before attempt count or lifecycle changes.

## Operations

| RPC | Version / status | Obligation |
|---|---|---|
| `initialize_transfer_checklist_v1` | retain/harden | create or return one active owner-scoped transfer checklist; preserve legacy rows |
| `post_assessment_message_v2` | new | store ordinary messages or a target learner's normalized structured assessment selection; never grade or expose key |
| `prepare_transfer_turn_v1` | retain/harden | return a scope-checked canonical provider context snapshot; provider call remains outside the DB transaction |
| `send_reviewed_tutor_response_v4` | new | atomically insert stem-only public tutor message and immutable private assessment, enforce one open assessment per learner, return only public projection |
| `process_assessment_message_v2` | new | row-lock assessment, dedupe, validate learner answer, append attempt, grade, apply terminal event atomically, and return role-safe DTO |
| `apply_learning_event_v1` | retain/harden | validate causal scope and atomically record evidence, progress, actual history, and event state |
| `record_transfer_provider_attempt_v1` | new internal | append one credential-free private provider request/response/error audit row; service-role-only and never browser callable |

Old transfer RPC versions remain revoked from untrusted callers and are not browser fallbacks. Migration may replace their bodies or revoke/drop obsolete signatures after dependency inspection; it must not leave two live grading authorities.

## `send_reviewed_tutor_response_v4`

Inputs: reviewed `TutorDecisionV3`, room, student, checklist, item, focus learner message, server-derived actor, request ID.

For assessment mode it must:

1. Validate mode/instruction/target and the full component-101 private assessment, including learner-safe explanation.
2. Lock the room before checking for an existing open assessment for the learner.
3. Revalidate teacher, learner, checklist, item, focus message, and room relationships.
4. Insert one tutor message whose `content` is exactly `assessment.stem`, whose structured public assessment has A-D options and selection type, and whose turn mode is assessment.
5. Insert one linked private assessment with reviewed key, explanation, transfer basis, scope, lifecycle `open`, attempt count 0, and unique delivery request ID.
6. Preserve room participation as tutoring.
7. Return only `ReviewedDeliveryDTO`; retry returns the same result.

Any error rolls back both records.

## `post_assessment_message_v2`

For an assessment answer, the RPC requires `assessment_id`, parent question message ID, and non-empty selected option IDs from the displayed A-D set. It validates the actor is the target learner and persists canonical deduplicated IDs on the answer message. It does not accept an attempt number, correctness, key, explanation, or progress result from the caller.

Malformed, cross-scope, unknown-option, terminal, or legacy-incomplete submissions create no scored attempt. Ordinary non-assessment messages preserve existing behavior.

## `process_assessment_message_v2`

Inputs: assessment ID, stored learner answer message ID, server-derived actor, request ID.

Lock order: room -> transfer checklist/item -> private assessment. Then:

1. Return an existing attempt for duplicate request or answer-message identity.
2. Reject non-open or legacy-incomplete state without mutation.
3. Validate answer author, room, assessment/parent link, and selected IDs.
4. Allocate ordinal `attempt_count + 1`, bounded to 1 or 2.
5. Grade normalized exact-set equality against private `correct_option_ids`.
6. First wrong: insert attempt, increment count to 1, leave lifecycle/progress open, return retry with no feedback.
7. Correct: insert attempt, apply one `assessment_pass` event, close passed, return no private feedback.
8. Second wrong: insert attempt, apply one `assessment_fail` event, close failed, return key/explanation only after commit.

The function returns stored authoritative counts. A third distinct submission cannot allocate an ordinal. If Guard defers a progress event, the transaction commits the terminal attempt/lifecycle plus explicit deferred learning event without changing protected progress. An authorized second-failure response may then receive terminal feedback; rollback or an unrecorded event receives none.

## Constraints and Indexes

- Unique `question_message_id` and `delivery_request_id` on private assessments.
- One open private assessment per `(room_id, student_id)` through a correctly scoped private-table partial unique index.
- Unique `(assessment_id, ordinal)`, `answer_message_id`, and `request_id` on attempts.
- Unique `(request_id, attempt_ordinal)` on private provider attempts; ordinal is 1 or 2.
- Check `attempt_count BETWEEN 0 AND 2`.
- Check lifecycle/result/terminal-answer consistency.
- Check new open/passed/failed records have non-empty key and learner-safe explanation; `legacy_incomplete` is exempt but ungradable.

## Hosted Evidence

Static SQL tests verify declarations. Hosted tests must prove grants, direct-write denial, key privacy, delivery idempotency, first-wrong persistence, pass on either attempt, second-wrong terminal disclosure, duplicate retries, two-tab races, third-attempt rejection, wrong-scope rejection, rollback, actual history, Guard behavior, and legacy preservation.
