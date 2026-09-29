# Production RPC Inventory: Transfer Assessment

<!-- Intent: record current production assessment RPC definitions and their storage behavior, inspected 2026-09-28. -->

## Current Production RPCs

The following definitions are present in the production database.

| Function | Signature | Production body behavior |
|---|---|---|
| send_reviewed_tutor_response_v3 | jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid | Validates a reviewed tutor payload and scope. In assessment mode, inserts a tutor question into public.messages with options, key, lifecycle, checklist/item, and selection type. Returns the message without assessment_key. |
| post_assessment_message_v1 | uuid, text, uuid, uuid, uuid, uuid | Validates the assessment question and target learner, then stores the learner answer as a public.messages row with assessment_id. |
| process_assessment_message_v1 | uuid, uuid, uuid | Finds the related question, resolves the answer from message content, updates the question result/lifecycle, and calls the learning-event path. Reprocessing the same answer message returns an already-processed result. |

All three assessment-specific functions are SECURITY DEFINER and check that the database role is service_role or postgres. Their request-id arguments do not implement delivery or answer-write deduplication. The processing function recognizes a repeated answer message, but does not use its request-id argument for that behavior.

The v3 assessment insert and v1 processor both reference public.messages.assessment_key. That column is absent from the live production relation. The v3 function also does not insert into private.transfer_assessments; that private table contained zero rows at inspection. Therefore catalog presence is not evidence that the assessment sequence runs successfully.

## Historical Component 102 RPC Design (Not Production)

The remaining contract below records the local component-102 v2 design. It is retained for historical test and implementation evidence and does not describe current production RPCs.

## Historical Common Rules

- The Edge Function derives the actor and validates room/role scope before calling an RPC.
- Transfer mutation RPCs accept the server-derived actor and request ID, execute only for `service_role`/`postgres`, and revoke `PUBLIC`, `anon`, and `authenticated` execution.
- Scope IDs are revalidated against stored relationships inside each RPC.
- Results are allowlisted JSON. Private rows are never returned wholesale.
- Existing public tables are not a grading authority. The trusted Edge handler obtains the private processing context, runs component 101's pure answer resolver, and sends its result to the service-role commit RPC. The private assessment row is locked before attempt count or lifecycle changes.

## Historical Operations

| RPC | Version / status | Obligation |
|---|---|---|
| `initialize_transfer_checklist_v1` | retain/harden | create or return one active owner-scoped transfer checklist; preserve legacy rows |
| `post_assessment_message_v2` | new | store ordinary messages or a target learner's normalized structured assessment selection; never grade or expose key |
| `prepare_transfer_turn_v1` | retain/harden | return a scope-checked canonical provider context snapshot; provider call remains outside the DB transaction |
| `send_reviewed_tutor_response_v4` | new | atomically insert stem-only public tutor message and immutable private assessment, enforce one open assessment per learner, return only public projection |
| `process_assessment_message_v2` | new | row-lock assessment, dedupe, validate stored answer and expected snapshot, commit the trusted resolver outcome and terminal event atomically, and return role-safe DTO |
| `apply_learning_event_v1` | retain/harden | validate causal scope and atomically record evidence, progress, actual history, and event state |
| `record_transfer_provider_attempt_v1` | new internal | append one credential-free private provider request/response/error audit row; service-role-only and never browser callable |

Old transfer RPC versions remain revoked from untrusted callers and are not browser fallbacks. Migration may replace their bodies or revoke/drop obsolete signatures after dependency inspection; it must not leave two live grading authorities.

## Historical `send_reviewed_tutor_response_v4` Contract

Inputs: reviewed `TutorDecisionV3`, room, student, checklist, item, focus learner message, server-derived actor, request ID.

For assessment mode it must:

1. Validate mode/instruction/target and the full component-101 private assessment, including learner-safe explanation.
2. Lock the room before checking for an existing open assessment for the learner.
3. Revalidate teacher, learner, checklist, item, focus message, and room relationships.
4. Insert one tutor message whose `content` is exactly `assessment.stem`, whose immutable `assessment_student_id` equals the validated checklist/private target learner, whose structured public assessment has A-D options and selection type, and whose turn mode is assessment.
5. Insert one linked private assessment with reviewed key, explanation, transfer basis, scope, lifecycle `open`, attempt count 0, and unique delivery request ID.
6. Preserve room participation as tutoring.
7. Return only `ReviewedDeliveryDTO`; retry returns the same result.

Any error rolls back both records.

## Historical `post_assessment_message_v2` Contract

For an assessment answer, the RPC requires `assessment_id`, parent question message ID, and non-empty selected option IDs from the displayed A-D set. It validates the actor is the target learner and persists canonical deduplicated IDs on the answer message. It does not accept an attempt number, correctness, key, explanation, or progress result from the caller.

Malformed, cross-scope, unknown-option, terminal, or legacy-incomplete submissions create no scored attempt. Ordinary non-assessment messages preserve existing behavior.

## Historical `process_assessment_message_v2` Contract

Inputs: assessment ID, stored learner answer message ID, server-derived actor, request ID, expected attempt count, expected resolution, resolver answer outcome, stored selected option IDs, resolver next progress, and resolver applied transition. Only the trusted Edge handler may call this service-role RPC.

The Edge handler first calls `get_transfer_assessment_processing_context_v1`, runs component 101's `resolveTransferAnswer` on that private snapshot, and passes its result to this RPC. If the RPC returns `CONCURRENT_MODIFICATION`, the handler rereads and reruns the resolver before retrying. The RPC checks duplicate request/answer identity, then locks room -> transfer checklist/item -> private assessment. It then:

1. Reject stale count/resolution with `CONCURRENT_MODIFICATION` without mutation.
2. Validate the stored answer author, assessment link, and selected IDs against the trusted call.
3. Validate outcome/ordinal shape and allocate at most two attempts.
4. First wrong: insert attempt, increment count to 1, leave lifecycle/progress open, return retry with no feedback.
5. Correct: apply one `assessment_pass` event, close passed, insert attempt, return no private feedback.
6. Second wrong: apply one `assessment_fail` event, close failed, insert attempt, return key/explanation only after commit.

The RPC does not regrade the key. It serializes and validates the trusted resolver result against current persisted state, then returns stored authoritative counts. A third distinct submission cannot allocate an ordinal. An invalid terminal progress transition raises `INVALID_TRANSITION` and rolls back the whole call. If Guard defers a progress event, the transaction commits the terminal attempt/lifecycle plus explicit deferred learning event without changing protected progress. An authorized second-failure response may then receive terminal feedback; rollback or an unrecorded event receives none.

## Historical Constraints and Indexes

- Unique `question_message_id` and `delivery_request_id` on private assessments.
- One open private assessment per `(room_id, student_id)` through a correctly scoped private-table partial unique index.
- Unique `(assessment_id, ordinal)`, `answer_message_id`, and `request_id` on attempts.
- Unique `(request_id, attempt_ordinal)` on private provider attempts; ordinal is 1 or 2.
- Check `attempt_count BETWEEN 0 AND 2`.
- Check lifecycle/result/terminal-answer consistency.
- Check new open/passed/failed records have non-empty key and learner-safe explanation; `legacy_incomplete` is exempt but ungradable.

## Historical Component And Hosted Evidence

Native tests on a disposable PostgreSQL 17 restored copy with Supabase-like roles verify grants, direct-write denial, key privacy, delivery idempotency, first-wrong persistence, pass on either attempt, second-wrong terminal disclosure, duplicate retries, two-session races, third-attempt rejection, wrong-scope rejection, rollback, actual history, Guard behavior, and synthetic legacy preservation. The local catalog comparison verifies RPC identities and private columns. Deployed Supabase grants/RLS, PostgREST and Edge authentication, and generated hosted types require separate integration evidence.
