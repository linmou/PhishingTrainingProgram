# Experiment: full-history replay of repeated tutor question

Intent: test whether restoring the missing conversation history is sufficient to stop the room's repeated urgency question.

## Metadata

- Status: completed primary comparison.
- Created/updated: 2026-10-15 UTC; primary calls 01:51:03–01:51:48 UTC.
- Agent: history_cutoff_test.
- Repository: PhishingTrainingProgram; commit `8dc7271c7a9a670e2e6315e4fcdfb3f39eea1768`.
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram`.
- Results address: `output/history-cutoff-replay-20261015/` (local reproducible artifacts).
- Environment: Node v22.12.0; existing tutor-system TypeScript/dotenv packages; provider access through deployed production `ai-api` v2 (source SHA `20f6ee18f7192a1a6271f55b2ab7ff5c6cda57a25a75e669f58c8dbeba5f3210`). Credentials read from `tutor-system/.env`; parameter names/provider documented in `tutor-system/.env.example`.

## Research Questions

### RQ1: Does full history restore direct teaching instead of repeated urgency elicitation?

Origin: Derived from [the initial investigation](room-repeated-urgency-question-investigation.md), which confirmed oldest-15 selection but lacked a controlled replay.

Answer criterion: compare actual configured model outputs with only history selection changed, retaining all request and response evidence.

## Hypotheses

### H1 (RQ1): Full history reliably removes the repetition

- Preregistered in the task: oldest-15 control repeats the urgency question; full-history treatment responds to learner difficulty with concrete explanation/correction instead.
- Rejection observation: the treatment still repeats urgency elicitation with the prior failed questions visible.
- Result: rejected as a sufficient/reliable explanation for this turn. A possible contribution from cutoff remains unresolved.

## Experiment Design

- Room: `8cafd448-386b-4391-b2e3-60dd842e4d80`.
- Focus: `9b77de52-37d1-45a6-a50d-cbb5eabcd567`, `2026-10-15T01:41:47.237938Z`, student: `no words , i just fine the amount`.
- Changed factor: oldest 15 database messages versus all 20 messages through the focus turn, chronological; same four pre-populated dialogue lines in both.
- Constant: generated room prompt (matches stored prompt exactly), appended active tutor policy, scenario title/description, latest student input, prior mode tutoring, qwen3.5-flash, temperature 0.3, max_tokens 100, thinking false, JSON-object response format, and production's two-attempt format-repair policy.
- Checklist appendix: absent in both. `getChecklistByRoom` selects legacy_v1, while this room only has a transfer_v1 checklist. Full checklist and update snapshots are retained for provenance. Focus is not an assessment answer, so no assessment feedback appendix applies.
- No future tutor turns were included. The final two saved repeated responses were outside the treatment history.
- Evaluation: qualitative inspection of actual outputs for repetition versus explanation; separately assess factual quality and presence of a concrete safe action. No wording-pattern score substitutes for semantic assessment.
- Stopping rule: three trials per condition. Order: oldest15-1, full-1, full-2, oldest15-2, oldest15-3, full-3. Six trials, seven provider calls because full-2 triggered one format retry.
- Limits: small sample, no fixed seed, current source reconstruction rather than a captured original HTTP request, unknown browser-local parameter overrides, no exact historical provider version identifier. Prior mode inferred from preceding tutor response_mode; all observed prior tutor modes agree with tutoring.

## Execution Commands

Supabase MCP `execute_sql` retrieved the room/messages/config/checklists/updates in one read-only query, preserved in `snapshot-query.sql` and `snapshot.json`. MCP `get_edge_function({function_slug:'ai-api'})` source/version is preserved in `deployed-ai-api.json`.

Executed in the working directory above using the documented environment; all six commands exited 0. Their call timestamps, full input/output, HTTP status, raw provider result and parser decisions are in the matching JSON files. The runner writes JSON to stdout; agent persisted each result using apply_patch.

```bash
rtk proxy node output/history-cutoff-replay-20261015/replay.cjs oldest15 1
rtk proxy node output/history-cutoff-replay-20261015/replay.cjs full 1
rtk proxy node output/history-cutoff-replay-20261015/replay.cjs full 2
rtk proxy node output/history-cutoff-replay-20261015/replay.cjs oldest15 2
rtk proxy node output/history-cutoff-replay-20261015/replay.cjs oldest15 3
rtk proxy node output/history-cutoff-replay-20261015/replay.cjs full 3
```

Structural audit in `verification.json`: initial requests differ only in conversation_history; requests within each condition are identical; all selected IDs precede or equal focus; common system-prompt SHA256 `da865fc0ac9522a8674a0d5ef1ec185a05c19e9856b3025d599019ea0ae83245`. Source hashes also recorded there.

## Results

### Result 1: Restoring history does not reliably stop repetition (RQ1/H1)

| Condition | Repeats urgency elicitation | Gives explanation without question | Supplies concrete safe action |
|---|---:|---:|---:|
| Oldest 15 | 3/3 | 0/3 | 0/3 |
| Full history | 2/3 | 1/3 | 0/3 |

All final outputs were complete JSON with HTTP 200 and model qwen3.5-flash.

- oldest15-1 and oldest15-2: “You noticed the high amount. Which words in the post try to rush you into acting quickly?”
- oldest15-3: “You found the amount is too high. Which words in the post try to rush you into acting quickly?”
- full-1: “Words like 'crazy deal' and 'instantly' create pressure to act fast. These alarming words are a sign of a scam.”
- full-2: “You found the high value. Which phrases use alarming wording to make you act without thinking?”
- full-3: “You found the high value. Which specific words or symbols try to rush you into acting quickly?”

full-2 first attempt reached max_tokens and returned truncated JSON. Its visible partial response explained the example words, then asked the learner to find those words again. The standard repair retry produced the final repeated question above. full-3 repeated on its first attempt, so retry behavior cannot fully account for persistence with full history.

Interpretation: the control reproduces the observed defect, but full history alone is insufficient. One changed response is not strong evidence of a causal effect at this sample size. Even full-1 overstates excitement/immediacy as pressure without an explicit deadline and supplies no safe action; cessation of repetition is narrower than fully appropriate tutoring.

Evidence: `oldest15-{1,2,3}.json`, `full-{1,2,3}.json`, `snapshot.json`, `verification.json`, and `replay.cjs` under the canonical results address.

## Corrections And Deviations

- Initial investigation's strong causal reading of missing history is not established by the replay. The source defect remains confirmed; sufficiency of a history fix is rejected.
- Actual stored max_tokens is 100 (below the service's cap120); all requests retained100. No enlarged-budget calls were made.
- No runtime code, deployed prompt, configuration, or room messages were changed.

## Next Research Directions

### Direction 1: Does the urgency worked example override failed-scaffold guidance?

- Motivation: full-history outputs still cite a missing urgency target and repeat the example's question structure.
- Change only urgency-specific active-prompt recommendation/worked example; retain full history, inventory and request parameters.
- Evaluate actual learner-facing responses, repetition, safe action and clue accuracy across matched trials.
- Priority high: distinguishes prompt example influence from missing evidence.

### Direction 2: Does the output budget/retry bias the surviving response?

- Motivation: full-2 truncation and repair altered its response.
- Change only output-token budget in an explicitly separate follow-up; preserve prompt/history/temperature.
- Compare first responses and retry paths. Priority medium: full-3 already demonstrates persistence without retry.

## Follow-up: urgency example ablation, 2026-10-15 01:53–01:54 UTC

### RQ2 and H2

RQ2: Does the urgency recommendation/worked example contribute to repetition when full history is visible? Origin: derived from Result1 above, at the user's request to compare rival causes. H2, specified before calls: removing those two spans should reduce urgency re-elicitation and promote direct teaching. Persistence would reject their being necessary for repetition; three trials cannot estimate a reliable rate difference.

Changed factor: starting from the frozen full-1 request, remove exactly the pressure-language recommendation sentence and its first worked-decision block. All other system text (including urgency/excitement inventory), complete history, focus message, parameters, and retry policy remain identical. `ablate.cjs` asserts each removed span occurs once. `ablation-verification.json` confirms exact-two-removals-only for all three initial requests and records the literal prompt diff. The original replay runner remains unchanged.

Executed commands, working directory/environment as above, all exit0:

```bash
rtk proxy node output/history-cutoff-replay-20261015/ablate.cjs 1
rtk proxy node output/history-cutoff-replay-20261015/ablate.cjs 2
rtk proxy node output/history-cutoff-replay-20261015/ablate.cjs 3
```

All three final outputs were complete JSON with HTTP200, model qwen3.5-flash. Four provider calls occurred because trial1 triggered the standard format retry.

- Trial1, after retry: “You found the high value. Which phrases use alarming wording to make you act fast?”
- Trial2: “The post uses 'crazy deal' and multiple exclamation points to rush you. Do not click; open the real app to verify.”
- Trial3: “Words like 'crazy deal' and 'got mine instantly' are pressure tactics. They try to rush you into acting without thinking.”

Final repetition: 1/3; direct teaching without question: 2/3; concrete safe action: 1/3. All still characterize excitement/immediacy as pressure. Trial1 first attempt visibly contained a complete-looking correction JSON, but the provider marked finish_reason:length; the unchanged service policy rejects that result and retries. The retry repeated the question. This demonstrates the observed production retry path can replace teaching with elicitation, without isolating whether sampling or the repair example caused that replacement.

Interpretation: repetition still occurs after removing the urgency example. Descriptive counts (full baseline2/3 versus ablation1/3) suggest a follow-up but do not establish a statistically reliable example effect. Both first attempts in truncation cases and all final results are preserved; no favorable-output selection occurred.

Evidence: `full-no-urgency-example-{1,2,3}.json`, `ablate.cjs`, and `ablation-verification.json` in the canonical results directory. Total experiment:9 trials,11 provider calls, no expanded-budget runs.

Next discriminating question: with full history and the ablated prompt fixed, does a larger explicitly declared output budget or a format-repair instruction without a scaffolding example reduce inappropriate re-elicitation? Vary one factor at a time, record first attempts and retries, and retain separate factual-quality judgments. This remains unexecuted.
