# Candidate 11 simulated learner tests

Intent: test candidate 11 across evolving conversations where generated learner and tutor messages become later context.

Prepared: 2026-09-08. Scope: candidate-only synthetic diagnostics requested by the user, not a baseline comparison, independent holdout, or production rollout.

## Conversation design

Four source cases from the scenario-rich suite seed confusion, immediate click intent, deliberate system testing followed by recovery, and partial knowledge. Each runs twice for five tutor replies: one reply to the fixed initial learner message, followed by four generated learner/tutor exchanges. The fourth scenario uses the adult tutor role. These are 8 trajectories and 40 expected tutor replies; repeated trajectories are not 8 independent scenario designs.

Promptfoo 0.121.15's `promptfoo:simulated-user` provider manages the conversation with `stateful: false`, replaying the full transcript. Its `maxTurns` is 4 because an initial user message causes one additional tutor response before the simulator loop. The installed engine uses a hosted learner backend by default; this adapter explicitly overrides `sendMessageToUser` with the project's existing Qwen JSON API caller. Model, temperature, thinking, limits and retries come from `../settings.json`; credentials and base URL use the existing `.env` configuration described in `tutor-system/.env.example`. No Promptfoo hosted learner service is called.

The tutor receives candidate 11 through the same `messagesFor` builder as the fixed-history evaluation. Every turn contains the unchanged room scenario and knowledge inventory, the original seed history, all generated learner/tutor exchanges, the latest learner message, and prior mode. The simulator receives the room description, seed history, its private persona, and actual visible replies; it never receives candidate prompt text, supervisor reason or decision fields. Private simulator intentions and judge criteria never enter the target request.

Each response and selected mode is assumed accepted by the human supervisor for the next simulated turn. This is an explicit simulation policy, not automatic production mode enforcement. Simulator intent does not prove what the generated learner actually did; semantic judgments use actual conversations.

## Evaluation and boundaries

The manifest owns metric metadata. Clean rubric files contain only conversation-judge instructions. Five exploratory conversation checks cover knowledge, participation, progression, decision consistency and relationship/accessibility. These aggregate diagnostic dimensions do not replace the separate v1 behavior metrics. Focused hints can convey useful knowledge without stating the whole answer, and serious Guard correction is allowed in peer voice. These rules follow the adopted specification; old frozen evaluations are not rescored.

Deterministic checks validate full context and state preservation, v2 output validity, length, and complete five-turn coverage. Later mode/action correctness is judged semantically from generated history rather than assigning labels based on simulator intentions. Initial seeds retain their original provenance, but generated trajectories are labeled synthetic development and ineligible as unseen holdouts.

The semantic rubric set has not undergone independent acceptance calibration. Results are diagnostic, including failures and disputes; they do not establish the existing 80%-without-regression gate because the user requested candidate 11 only.

## Run and evidence

From the repository root:

```sh
rtk proxy node --test evals/promptfoo/v1/simulated/run.test.js
rtk proxy node evals/promptfoo/v1/simulated/run.js evals/promptfoo/results/qwen3.5-flash/v9-candidate-11-simulated
```

The output snapshot pins cases, candidate text, settings, source documents, rubrics, manifest, harness/adapter source and Promptfoo version. Each trajectory saves `learner-N.json`, `turn-N.json`, `conversation.json`, and `judge-METRIC.json`; requests, raw responses, timing and API usage remain in those records. Only API credentials are omitted. `report.json` reconciles all trajectories.

Resume with the same command: the fingerprint must match, completed model calls are replayed from their saved requests, and dropped/changed generated history fails explicitly. A malformed target, simulator or judge result remains an error; it is never replaced by guessed text or a passing result. In-flight requests that were not saved before interruption are unavailable and may need re-execution. Nothing is deleted by the runner.

Local integration tests exercise the actual Promptfoo engine with mock model responses across three turns, including Guard persistence/recovery, privacy boundaries, missing-history rejection, invalid target output, and zero-call replay after completion.

Provider reference: [Promptfoo simulated user documentation](https://www.promptfoo.dev/docs/providers/simulated-user/). Installed source was inspected to verify max-turn behavior and the learner-provider extension.
