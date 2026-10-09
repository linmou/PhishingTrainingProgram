# Transfer status response contract

Intent: define how learner-message analysis reports item-level evidence and how each event changes learning progress.

Updated: 2026-10-04
Status: SQL and Edge source deployed to staging and production on 2026-10-04; production assessment verified, transfer-status event check failed.
Grounding: [AI tutoring constitution](constitution.md), P2 for demonstrated understanding, H1 for accuracy, and H4 for inspectable evidence.
Production source: [assessment-api](../../supabase/functions/assessment-api/index.ts), [TypeScript transitions](../../src/services/learningProgressTransitions.ts), and the pending SQL migration under `supabase/migrations/`.
Evidence basis: [production learner review](../../../output/production-learning-coverage-2026-10-03/review.md).

## Input and decision order

The trusted server supplies the current student message, the active learner's checklist items and progress, and room dialogue only through that message. Each dialogue turn carries its source and speaker identity. Resolve each item independently:

1. Identify the current learner's own words and the target's exact scope. Earlier dialogue explains the question but cannot itself advance status.
2. Decide whether the words give no evidence, an incomplete relevant component, accurate and sufficient understanding in the present situation, independent application in a materially different situation, or a contradiction.
3. Choose at most one status-changing event for each item given its current status. Decide protection and factual-correction flags separately.

An open tutor question may elicit full understanding. A repeated tutor explanation, bare agreement, confident verdict, or keyword does not demonstrate it. Response length does not set the status. An error that defeats the decisive reasoning prevents full coverage of that item. A narrow item can be covered while a related broader item remains partial.
An action answer does not establish even partial evidence of an unstated mechanism. For example, choosing the official app does not by itself show that the learner understands credential theft or sender-name spoofing; those explanation targets need their own learner evidence. An event must change the item's current state. More incomplete evidence on an already partial item produces no event.
For an account-check action target and a separate urgency-to-credential-theft explanation target, “ignore the link and open the official app” can cover the action target while leaving the explanation target pending. Naming urgency as pressure to click, while unsure of the later credential outcome, is partial evidence for the explanation target.

## Response shape

```json
{
  "events": [
    {
      "item_id": "approved item UUID",
      "kind": "demonstrated_understanding",
      "evidence_type": "action",
      "evidence_message_id": "current student message UUID",
      "evidence_quote": "exact words from that message",
      "explanation": "what these words demonstrate for this item"
    }
  ],
  "requires_protection": false,
  "requires_correction": false,
  "explanation": "brief overall reason"
}
```

`events` is an array, including `[]` when no item changes. Every event field and the top-level `explanation` are required nonempty strings. `kind` is the enum below; `evidence_type` is `action`, `recognition`, or `explanation`. The two flags are required booleans. `item_id` must belong to the active checklist; `evidence_message_id` must equal the focus message; `evidence_quote` must occur verbatim in that message and state the target-specific claim. Each item can occur at most once. The per-event explanation names the evidence and its relevance to the specific target, without claiming hidden model reasoning.

The Edge Function makes one model call per target, then combines supported events before one database application. It rejects malformed output rather than inferring a status. It checks the shape, enum, evidence type, item ID, current message ID, quote, flags, and explanations. An `understanding` item requires `explanation` evidence, and a `detection_area` item rejects action-only evidence. A well-formed event with the wrong evidence type or an ineligible current state is omitted from applied events and recorded under the private combined analysis's `rejected_events` with a reason. Other valid target events can still apply. The database validates the item scope and trusted operation again before applying the event. Assessment selections follow the separate deterministic grading path.

## Event meanings

| Event kind | Eligible current state | Next state | Learner evidence |
| --- | --- | --- | --- |
| `initial_signal` | `pending/none` | `partially_covered/basic` | A relevant component is shown; essential content remains unresolved. |
| `demonstrated_understanding` | `pending/none` or `partially_covered/basic` | `covered/good` | The learner accurately demonstrates the essential content of this target in the present situation. For understanding, this is the relationship, mechanism, or reason; for action, a specific safe choice distinguishing it from an unsafe alternative. |
| `post_repair_signal` | `needs_review/basic` | `partially_covered/basic` | The learner corrects a prior misconception. A later message may provide full evidence. |
| `spontaneous_transfer` | Any state other than `covered/good` | `covered/good` | The learner independently applies the target principle with sound reasoning in a materially different concrete situation. |
| `contradiction` | `partially_covered/basic` or `covered/good` | `needs_review/basic` | The learner now expresses conflicting or unsafe understanding. |

Ineligible or repeated non-assessment events leave the state unchanged. An empty array leaves every item unchanged. Protection and correction flags can defer a new assessment; they do not themselves change progress. Guard mode defers progression in the trusted database.
If both full-understanding events seem possible, use `spontaneous_transfer` when the learner applies the principle to a situation different from the one named in the target and prior discussion; use `demonstrated_understanding` for the current target situation.

`covered` means sufficient evidence for that particular item. The stored event kind identifies whether the evidence was direct understanding, transfer, or an assessment pass. Coverage does not by itself claim long-term retention or observed real-world behavior.

## Boundary examples

- “Too good to be true” can show a partial signal for recognizing implausible pricing. “A new Switch normally costs around $200, so a $20 offer is suspicious” can cover that recognition target on the first response.
- “Check previous posts” is partial for a composite account-verification target. Explaining what suspicious account age, posts, and followers mean can cover it.
- “I would open the official app myself instead of this alert's link” can cover a narrow independent-check action target in the current account-warning scenario. Applying that principle to a new delivery or payment warning may qualify as spontaneous transfer.
- “This is a scam” alone supplies no item-specific status evidence.

These are interpretation examples, not exact-word matching rules. Human review and comparable model evaluation remain necessary to establish classification quality.

The staging and production runs, including the unresolved transfer-versus-repair classification, are recorded in [the release record](../doc_update_record/documentation_update_record_v2026_10_04_direct_understanding_status.md). Passing assessment runs do not establish a model accuracy rate across other targets and learner responses.
