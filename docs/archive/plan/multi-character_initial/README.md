# Multi-character phishing-training demo

Implementation plan for `linmou/PhishingTrainingProgram`.

**Inspected baseline:** `no_sign_up` at `59fd1f4ec1caca2befa90917022c2e21e1f869c9` (September 11, 2026).
**Status:** design and implementation handoff; no feature code, model evaluation, migration, or deployment was executed for this handoff.

## Decision

Build a **single-model, two-character demo**, not independent agents. The existing AI tutor remains the tutor. Add one fictional AI participant, **Riley**, who presents a plausible but wrong recommendation within the phishing-training scenario. A single model call writes one or two messages, the human reviews the complete sequence, and the application publishes the approved messages with a fixed delay.

**The learner cannot submit another message until the response cycle finishes.** They may type a draft while waiting. This restriction covers generation, human review, and playback, eliminating interrupted playback and stale-review coordination in this first version. Explicitly discarding an unsent draft returns control to the learner.

## Scope of “isolated demo”

Use a separate page inside the existing React app, with **a learner preview and a human-tutor control panel in the same browser**. This is a working interactive prototype with live model generation, not a prerecorded animation. Its transcript and draft state are in memory. Refresh resets it.

This is a chosen scope assumption to minimize implementation complexity. It is **not yet a shared room with a student and tutor on separate devices**, and its panels are not a security boundary. Separate-client delivery and persistent room integration are a later milestone; do not quietly add them to this implementation.

## Fixed choices

| Area | First implementation |
|---|---|
| Entry | Feature-flagged `/#/demo/multi-character` page; flag defaults off |
| Participants | Actual learner, existing AI tutor, one new misleading AI participant |
| Allowed generated sequences | `[tutor]` or `[misleading_peer, tutor]` |
| AI calls | One generation call for the whole sequence; at most one format-repair retry |
| Human review | Edit both messages together; regenerate the whole sequence; approve once |
| Ordering | Fixed; tutor always last; no drag-and-drop or speaker reassignment |
| Timing | First message immediately after approval; second after 3,000 ms |
| Learner interruption | Submission blocked throughout the response cycle; typing remains available |
| Cancellation | Discard before playback; Reset at any time cancels the whole demo |
| Storage | In-memory draft, transcript, and minimal review records; explicit JSON export |
| Teaching | Preserve core tutor teaching behavior; no Guard or transfer state-machine integration |
| Configuration | Existing model/gateway configuration; fixed demo character roles and request settings |

A three-second interval is a starting UI setting, not a research-backed optimum. Centralize it in one constant. There is no pause/resume scheduler in this version.

## Evaluation scope for this demo

Use a **workflow-lite** verification strategy for this isolated prototype. Do not execute the full `ai-behavior-design-eval` lifecycle merely to build or iterate on the demo-specific multi-character prompt. Required evidence is: deterministic contract/state/UI tests, the targeted multi-character behavior cases, one live browser/model smoke check when credentials are available, and ordinary regression/build checks for touched code.

Keep `ACTIVE_TUTOR_AGENT_PROMPT` and ordinary production tutor behavior unchanged by default. If implementation changes that shared prompt or shared tutor behavior semantics, run the repository's existing Promptfoo regression and quality gate in addition to the targeted demo checks. Use the full `ai-behavior-design-eval` workflow later when this behavior is promoted into ordinary production rooms or otherwise becomes a formal production tutor-policy change.

## Read order

1. [01 — Behavior and user experience](01-behavior-and-ux.md): the canonical feature behavior, character roles, sequence rules, and editor interactions.
2. [02 — Implementation](02-implementation.md): concrete file layout, state transitions, generation contract, and reuse boundaries.
3. [03 — Tasks and verification](03-tasks-and-verification.md): ordered coding tasks, completion checks, semantic cases, and runnable commands.
4. [04 — Integration and repository evidence](04-integration-and-evidence.md): what must change for shared rooms later, plus inspected source references.

Keep these responsibilities separate. Do not create a second competing feature specification or a fabricated “completed evaluation” report.

## Coding-agent handoff

> Implement the local multi-character demo described in this folder against the current repository checkout. Start with the baseline check in Task 0. Preserve ordinary tutoring routes and contracts. Keep the prototype single-browser and in-memory; add neither database migrations nor a general agent framework. Implement the behavior in file 01, interfaces and state flow in file 02, and tests/checkpoints in file 03. Retain the integration boundaries in file 04 without implementing the future work. Use real model generation when configured and clearly identify any mocked verification. Report changed files, tests executed, live checks completed, remaining limitations, and exact steps to open the demo. Do not claim hosted-room or learning-effectiveness acceptance from this prototype.

## Success criterion

A reviewer can enter a fictional scenario and learner response, obtain a live two-character draft, edit both messages, publish them in order, observe distinct identities and the delay, answer on the next learner turn, and verify that the next model input contains only the delivered conversation with correct attribution. Ordinary rooms continue to use their existing code paths.
