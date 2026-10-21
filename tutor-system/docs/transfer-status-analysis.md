# Learning-progress analyzer dialogue contract

Intent: define the room dialogue and evidence contract used when judging one learner message.

Updated: 2026-10-21. Implementation baseline: `96f280c`; naming review baseline: `518a07d`.

Status decisions and the structured output rules are defined in [the transfer status response contract](ai-behaviors/transfer-status-response-contract.md).

This is the learning-progress analyzer's product input/application contract. Its [evaluation suite](../../evals/promptfoo/learning-progress-analyzer/README.md) scores evidence classification and progress consequences; assessment-question generation is a separate operation. The filename and RPC identifiers retain their existing integration names.

## Input

`assessment-api` calls `get_transfer_message_analysis_context_v1` for a persisted, ordinary student message. The trusted database function returns the active checklist and all room dialogue through that message. Setup turns from `rooms.pre_populated_dialogue` come first in array order; persisted turns from `messages` follow in `(created_at, id)` order. Later turns are excluded. There is no fixed history limit.

The Edge Function sends a system prompt and a JSON user message to Qwen for each target. Both practice types use the shared tutoring model, currently Qwen3.8-Flash, for progress analysis. Phishing adds a final instruction repeating the exact target, authoritative status and current learner contribution. It distinguishes full, partial and unrelated evidence, and requires the concrete target feature rather than a broad association with deception or verification. Cyberbullying supplies its scenario and learner-attribution instruction. Assessment-question generation retains its separate Qwen3.5-Flash contract. All analysis requests use temperature 0, a 600-token limit, thinking disabled and JSON output.

The calls run concurrently and share the same focus learner message and dialogue. All target calls settle before application; a failure prevents partial progress updates. Cyberbullying permits one format repair and retains both audited attempts. Each JSON user message contains only its target in `items` and has this shape:

```json
{
  "focus_student_id": "student UUID",
  "evidence_message_id": "current message UUID",
  "message": { "id": "current message UUID", "room_id": "room UUID", "user_id": "student UUID", "user_role": "student", "content": "current learner text" },
  "items": [{ "id": "item UUID", "area_text": "learning target", "item_type": "verification_step", "priority": "critical", "status": "pending", "understanding_level": "none" }],
  "dialogue_history": [
    { "id": "prepop-room-0", "source": "room_setup", "user_id": null, "user_role": "others", "speaker_name": "Scenario participant", "content": "setup text" },
    { "id": "earlier message UUID", "source": "message", "user_id": "speaker UUID", "user_role": "tutor", "speaker_name": null, "content": "tutor text" },
    { "id": "current message UUID", "source": "message", "user_id": "student UUID", "user_role": "student", "speaker_name": null, "content": "current learner text" }
  ]
}
```

Each persisted turn retains its own `user_id` and `user_role`, so another student's words are distinct from the focus student's words. Setup turns retain their configured speaker name and role; they are not attributed to a real student ID.

Persisted turns also carry their stored speaker name and optional character/persona identity. Cyberbullying requests add the stored scenario and practice type; character dialogue remains context, while evidence must come from the focus learner message. See the [Cyberbullying release record](doc_update_record/documentation_update_record_v2026_10_21_cyberbullying_practise.md) for the request/model diagnostics and current deployment status.

## Output And Application

Qwen returns JSON in this shape:

```json
{
  "events": [{ "item_id": "item UUID", "kind": "initial_signal", "evidence_type": "explanation", "evidence_message_id": "current message UUID", "evidence_quote": "exact words from current learner text", "explanation": "brief reason" }],
  "explanation": "brief overall reason"
}
```

`kind` is one of `initial_signal`, `demonstrated_understanding`, `post_repair_signal`, `spontaneous_transfer`, or `contradiction`. An empty `events` array means the message supplies no new status evidence. The top-level result contains `events` and a nonempty `explanation`; the server adds private `rejected_events` when combining target results.

The Edge Function rejects malformed IDs, quotes, kinds, evidence types, or explanations. It omits well-formed events whose evidence type does not support the item or whose current status makes the event ineligible, recording them in private `rejected_events`. It combines supported events into one `apply_transfer_message_analysis_v1` call. Historical dialogue informs interpretation but cannot itself create a new status event. Assessment option answers use the separate assessment-processing path.

Cyberbullying permits one format repair for invalid analysis output. That request includes the rejected response and original learner message, so the provider can repair an evidence quote without joining separate passages. Both attempts are audited. A second invalid response prevents the whole message analysis from applying partial progress.

For future changes to this contract, follow `supabase-release-workflow.md`: validate locally, apply and test on staging, then apply to production. Deploy the matching `assessment-api` function only after its SQL is applied in each project.
