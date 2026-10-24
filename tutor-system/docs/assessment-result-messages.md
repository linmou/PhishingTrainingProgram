# Assessment result messages

<!-- Intent: define the approved public result-message contract and its consumers. Updated: 2026-10-24. Ordering optimization baseline: 7762cbb; runtime release commit: 518a07d. -->

## Grading and publication

Backend exact-set grading and the two-attempt limit remain authoritative. Each accepted answer creates one fixed-template result message in the grading transaction. A first incorrect answer reports one remaining attempt; a correct answer reports correctness; only a second incorrect answer publishes the stored teacher-reviewed correct option IDs and learner-safe explanation. Creating or reading these results makes no LLM call. Assistance and target/progress invalidation create an accurately attributed closure message rather than an incorrect grade.

Result messages belong to ordinary room history and its exports, visible to the room's authorized tutor, learners and observers. This is the approved extension of the earlier learner-response-only terminal-failure disclosure rule. Private question keys and explanations remain private before authorized terminal failure; transfer basis, private rationale and raw provider content remain private throughout. Passing does not publish the stored key or explanation. Existing recoverable results receive the same publication treatment during backfill.

The messages inherit the existing room transport's read visibility. Current research database policies allow direct anonymous reads of ordinary messages, so this publication has the same wider visibility. This change protects trusted event writes and private grading authority; it does not introduce a stronger reader-identity mechanism.

## Identity and persistence

Each result carries server-owned `assessment_event` metadata: stable event key and kind, assessment/question/learner/source-answer identities, attempt number, outcome/counts, terminal/lifecycle and progress-deferred state. Closure events also record their known cause. Result identity is separate from answer identity. Unique event keys prevent duplicate messages on repeated processing, reconnects and concurrent submissions. The same saved result is returned as `ProcessedMessageDTO.result_message`; cancellation without an answer can link directly to the question.

Automatic rows use the existing tutor storage role with `response_mode: null`, but present as Assessment result. They are distinct from human tutor speech, learner evidence, AI-suggestion acceptance and required-rating targets. They do not satisfy the existing requirement for a subsequent human tutor feedback reply. Grading, progress, accepted-attempt persistence and the public result become visible atomically, including when Guard defers the progress event.

Participant and legacy writes cannot forge or modify trusted event metadata/content. Public projections carry only the approved event fields and published result. Recoverable historical attempts/cancellations are backfilled from persisted authority with their original event times. Missing authoritative facts are explicitly unavailable; they cannot be reconstructed by regrading dialogue. Backfill precedes prompt-state removal.

## Room and AI consumers

Saved result messages own verdict/retry/explanation display. The question retains option controls and answer-selection navigation. Initial reads, processing responses, realtime, polling and reconnect converge on the same read-only lifecycle; stale or out-of-order events cannot reopen a terminal question. Both UI and AI history use stable causal question → answer → result ordering.

Ordering indexes result IDs by assessment and the bounded attempts-used values (0/1/2), preserving their chronological scan order. Closures depend on all results for that assessment; later attempts and their answers depend on earlier attempts' results. Sorting costs O(N log N), index construction O(N), and dependency traversal O(N + E), where E is the number of dependency references visited. Valid two-attempt histories have bounded dependencies per assessment event. Repeated/conflicting result rows can still increase E, but no event filters the full room history. Merge hydration and terminal precedence use the existing single ingress path. Reproduce the measured few/many-event cases using the command and evidence in the [optimization record](doc_update_record/documentation_update_record_v2026_10_24_assessment_ordering.md).

Tutor dialogue includes public question stem/options/selection type, learner answers and attributed result messages. The dynamic `VERIFIED ASSESSMENT STATE` section is removed. Common request instructions still require following recorded grades, preserving retries/disclosure and accurate cancellation handling, required tutor feedback and safety/Guard priority. Initial generation, selected historical-answer focus and regeneration require complete trusted result history before calling the provider. A pending grade, missing result or failed history read yields an explicit processing/unavailable state.

Readiness remains required for historical assessments after transfer learning is disabled. It covers the focused learner; another learner's unfinished answer cannot block that learner's tutor response. A private processing ledger distinguishes handled non-consuming responses from pending grading. The authorized readiness path can recover pending answers through the existing deterministic processor and resume a Guard-only deferral after Guard clears. It returns handled-answer and required-result IDs for history validation; processing bookkeeping is not a new prompt section. Ordinary result lines retain safe attempt/lifecycle/progress-deferral information. During an open question or retry, tutor feedback must not reveal, paraphrase or eliminate the answer options to supply the solution.

The room owner's existing Clear Chat History action uses an atomic trusted operation that deletes the room's assessment sources before its messages. It preserves the backup/export flow and pre-populated dialogue. Individual event edits/deletes remain protected.

## Delivery evidence

The implementation is tracked in the [release record](doc_update_record/documentation_update_record_v2026_10_17_assessment_result_messages.md). Acceptance requires actual SQL atomicity/role/backfill/concurrency cases, Edge and UI integration, real-provider prompt behavior, and affected staging/production journeys with persisted rows and cleanup. This requirements document does not establish deployment completion.
