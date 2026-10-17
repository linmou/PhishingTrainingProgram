# Contextual reply regression evaluation

Intent: test whether the tutor interprets a short learner reply against the latest tutor turn after the conversation changes topic.

Date: 2026-10-16. Endpoint: case addition and focused unchanged-prompt evaluation. No prompt refinement or release acceptance is in scope.

## Grounding and observable outcomes

Reuse constitution `phishing_tutor_constitution` 1.0 and its recorded human adoption, canonical tutor specification T01/T02/T03, and response-contract C01. The specification's existing resolved grounding applies: P2 owns responsive guidance and target selection; P4/H4 requires truthful observable justification. No principle, requirement, decision category, rubric, or priority changes.

For room `8cafd448-386b-4391-b2e3-60dd842e4d80`, the latest tutor asks the learner to check whether a shortened link leads to an official Apple website. “Looks like it does” affirms that proposition; it does not newly identify a suspicious account. T01 requires correction of the mistaken link inference and a concrete safe action after that focused scaffold. T02 addresses the current URL misconception. C01's reason must attribute the current claim accurately. References to earlier correct account evidence are allowed as history, but cannot replace or reverse the current claim.

The controlled derivative changes only the latest reply to “Looks like it doesn't.” It rejects apparent official affiliation. Acknowledge or explain that correct observation, or scaffold a remaining gap; do not falsely correct it or infer that the learner checked the destination. Neither reply establishes intentional obstruction or an imminent click; both remain tutoring.

## Method and scope

Preserve the 61 existing scenario-rich cases and all their assertions; `contextual-reply.js full OUT` composes the 63-case expanded suite as a run artifact. Record a reuse audit for every existing case. Add one real-room ecological case and one single-field ecological derivative, both exposed development/regression cases, not unseen holdouts. Use the product history formatter, actual saved room prompt, full saved dialogue through the focus message, and existing product request builder. Expected labels and provenance stay outside target input.

Reuse all 13 checks from the iTunes ecological case. Deterministic checks compare mode/instruction and validate contract/length. Existing LLM rubrics assess grounding, target selection, feedback, realization, knowledge and treatment independently on the same output. Initial decision-reasoning calibration failed to reject the observed stale reason (2/3 agreement), so registry v1.4 adds the supporting C01/H4 `current_turn_grounding` check without changing any existing rubric. Its sole property is resolving the current contextual contribution without substituting older evidence. The generic justification check remains separately reported; it cannot offset a failure of the more specific check. Calibrate that new check on the same observed negative, positive and negation boundary before target generation. Other unchanged rubric calibration is historical; this focused Qwen3.8-judge diagnostic does not establish full judge/model acceptance.

Run three independent generations per added case with production Qwen3.8 Flash, temperature 0.3, max_tokens 100, thinking disabled, JSON output and the existing format repair. Use the configured semantic judge with explicit recorded settings. Keep two workers and concurrency two. No seed is configured. Capture every raw target and judge response, request, settings, case, rubric/spec/prompt snapshot and error in immutable run directories.

Focused success requires all six outputs to preserve the short reply's meaning, satisfy their mode/action reference labels and grounded reasons, and pass both members of the semantic pair. Other checks retain registry thresholds. Any failure is reported; no semantic-failure retry or prompt edits. Full-suite non-regression and independent holdouts remain outside this focused result and cannot be claimed from it. Report per-repetition classifications, pooled predictions and fixed two/three-member majorities; ties abstain.

## Experimental factors

Added factors: full real-room history, short context-dependent affirmative reply, and a one-word negation pair. Target model/decoding and tutor policy stay unchanged. This is an offline reproduction of the saved conversation, not a claim to replay the exact historical HTTP request or execute live checklist enrichment. Production transport, UI, database state and learning outcomes are outside the measured scope.
