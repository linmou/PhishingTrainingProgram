# Investigation: repeated urgency question

Intent: explain why room `8cafd448-386b-4391-b2e3-60dd842e4d80` repeats the same tutor question and identify the responsible prompt and context behavior.

Date: 2026-10-14 America/New_York (saved events dated 2026-10-15 UTC).
Status: Concluded diagnosis; no runtime changes.

## Findings

- Confirmed from Supabase `messages`: the room contains 22 saved messages. Tutor questions at 01:40:30, 01:41:26, 01:42:06 and 01:42:30 UTC all ask which words rush the learner. The final two responses are identical. The learner replied `$500 gift` at 01:40:53 and `no words , i just fine the amount` at 01:41:47.
- Confirmed source defect: `tutor-system/src/services/simplifiedAIContext.ts:39` sorts ascending and line 40 limits to 15. It retrieves the oldest 15 messages. In this room that history ends at the assessment feedback at 01:38:44, before all four urgency questions. `aiService.ts:666` supplies that history while separately supplying the latest learner contribution at line 667.
- Confirmed saved model rationale (`ai_suggestion_feedback`, accepted suggestions): at 01:42:06, instruction `scaffolding`, reason `The student identified the excessive value promise but missed urgency tactics. A focused question targets the remaining unmet point.` At 01:42:30, instruction `scaffolding`, reason `The student identified the excessive value promise but missed urgency language. A focused question targets that remaining detection area.`
- Confirmed prompt bias: `prompts/activeTutorAgentPrompt.ts:32` explicitly recommends asking which wording rushes the learner when pressure is unaddressed. Its worked response at line 41 is `Checking independently avoids the message link. Which words are trying to rush you?` Line 31 directs selection of one unmet target. The room inventory includes `Urgency/Excitement Language: "crazy deal!!" with multiple exclamation points`.
- Confirmed counter-rule: the room's persisted system prompt contains the responsePolicy rule at `prompts/responsePolicy.ts:17`: if the immediately preceding tutor question received an unsafe or incomplete answer, directly correct and give a safe action instead of asking another question. Missing recent history prevents reliable application of that rule.

## Conclusion

High confidence in the context defect; medium-to-high confidence in its causal interaction with the prompt example. The AI sees an unmet urgency target and a new learner answer but lacks its prior attempts at that question. Its saved rationale repeatedly treats another focused question as advancing the target. This is not evidence that a prompt explicitly demands repetition.

The scenario also conflates excitement with urgency: `crazy deal!!` expresses excitement and does not specify a deadline. Asking for words that rush action is a weaker fit than directly teaching how hype makes an offer appealing.

## Hypotheses and limits

1. A prompt directly orders repeated questions: refuted; it contains a failed-scaffold correction rule.
2. Recent tutor history is absent: confirmed from source query and the room's ordered saved messages. No captured provider request was available, so execution of a different already-running frontend build remains unverified.
3. The worked example biases target/question selection: supported by close wording and saved model rationales; exact model causality cannot be established without a controlled replay.

Browser runtime reported no available browser; room data was inspected directly through Supabase MCP. Feedback `context_messages` contains five IDs because tracking uses a separate query; it is not a complete provider-request trace.

## Fix direction and verification

Retrieve the newest history window and present it chronologically. Preserve the latest tutor question and learner reply together. Then replay this room's failed urgency scaffold to check that the tutor explains the clue rather than repeating the question. Review the excitement/urgency inventory wording and the worked example separately. No implementation or live experiment was requested or performed.

## Follow-up: 2026-10-15 UTC — controlled live replay

The user requested a full-history comparison before attributing the behavior to the cutoff, then requested competing-explanations causal research because the original scenario remains visible.

**Correction to the earlier causal conclusion:** the history-selection defect is confirmed, but it is insufficient to explain or resolve the repeated-question behavior by itself. With the actual qwen3.5-flash provider, identical prompt/settings/latest student answer and only history changed, oldest-15 history repeated urgency elicitation in 3/3 trials; full history repeated in 2/3 and explained in 1/3. None supplied the concrete safe action required by the failed-scaffold rule. One full-history repeat occurred on its first attempt, so format repair cannot account for all recurrence.

The full-history condition contained all 20 saved messages through the focus learner turn and all four setup dialogue entries, with no subsequent tutor turns. The control contained the oldest 15 saved messages and the same setup dialogue. Restoring recent history therefore makes the prior failed questions visible without reliably changing the behavior. The initial static diagnosis overstated the causal evidence available at that time.

See [the experiment log](history-cutoff-replay-experiment.md) for exact commands, settings, outputs, structural request-equality checks, provider provenance and limitations. Full request/response records are in `output/history-cutoff-replay-20261015/`.

**Prompt ablation:** three further full-history trials removed only the urgency-specific recommendation sentence and its worked example from the active policy. Repetition persisted in 1/3; direct teaching occurred in 2/3. This is suggestive of example bias, but does not establish a reliable effect with three trials. The learning inventory and general unmet-target instruction remained intact. All conditions still framed excitement/immediacy as urgency. Only one of nine final outputs included a concrete safe action.

**Retry mechanism:** two of nine trials exceeded the unchanged 100-token output budget and retried; each retry ended in a question. The repair instruction contains an example with `instruction: scaffolding`. One ablation trial's first response taught directly but was truncated, then its retry repeated a question. This is a plausible amplifier, not an isolated causal test; the complete first-attempt repeat with full history independently rules out retry as a universal explanation.

Total: nine trials, eleven live provider calls. Audits confirm history-only differences in the primary comparison and exactly two removed prompt spans in the ablation. No runtime code, deployed prompts or room state were changed.

The [competing-causes report](room-repeated-urgency-competing-causes.md) compares seven rival mechanisms. Its provisional leader is unmet-target selection overriding failed-scaffold handling, with the urgency-specific example as a plausible amplifier. It distinguishes this from missing history, the excitement/urgency premise, hidden checklist state, repeated generation on the same learner turn, and output-budget/repair behavior.
