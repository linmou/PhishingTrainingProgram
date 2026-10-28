# Guard Mode Whole-Feature Implementation Plan

Intent: preserve the agreed product, AI-behavior, evaluation, and implementation plan for Guard Mode so it can be executed consistently in later work.

## 1. Feature outcome

Add a second AI response role alongside the existing tutoring mode:

- `tutoring`: supports learning, clarification, and guided progress.
- `guard`: responds with a visibly distinct, serious, direct identity when the student is deliberately continuing to violate explicit guidance or appears to be playing with the system rather than learning.

The mode is selected on every turn. Guard Mode continues while the AI selects `guard`, and the AI may return to tutoring once it judges that the student has meaningfully corrected the behavior and understanding.

The human tutor can activate, deactivate, or rectify the AI’s mode decision. The human tutor remains available throughout. The student’s further progress is blocked while Guard Mode is active and resumes only after the behavior is corrected.

## 2. Responsibility and interaction model

The human teacher remains the responsibility layer: they may modify the wording of an AI response before it is delivered. Mode selection should be handled like the existing AI suggested-response workflow:

1. AI generates a structured suggested response and a mode decision.
2. The tutor reviews and edits the response as needed.
3. The tutor may accept or rectify the mode decision.
4. Downstream logic consumes the final response and final mode.

For each turn, record:

- the AI’s raw mode decision (`tutoring` or `guard`);
- the AI’s mode reason;
- whether the human tutor rectified the mode;
- the final mode used downstream;
- the raw AI response and the reviewed wording as appropriate.

Do not hardcode a violation counter. “Four consecutive violations of the same explicit guidance” is an example of evidence that can justify Guard Mode, not a production threshold.

## 3. UI and identity requirements

### Student view

When Guard Mode is active, the student recognizes it through the changed:

- name;
- profile/avatar;
- visual appearance;
- response style.

Do not rely on a separate explanatory label such as “Guard Mode Activated” in the student-facing view.

Use one universal Guard identity everywhere; teachers do not create Guard profiles. Design it as a distinctive, gender-neutral authoritative identity—such as a security supervisor with a clear security emblem—so it is immediately taken seriously without impersonating a real person.

### Tutor view

Add a clear `Guard Mode Activated` indicator to the tutor interface.

Change the existing composer into a simulated post preview with:

- sender profile;
- sender name;
- response text;
- a reminder that Guard Mode is activated.

The preview should use the universal Guard profile when the selected/final mode is `guard`. The tutor must be able to activate or deactivate Guard Mode and rectify the AI selection. No pending-review dashboard indicator is required.

### Progress control

While Guard Mode is active, prevent further student progress. The correction loop ends when:

- the AI selects tutoring after a meaningful correction; or
- the human tutor deactivates/rectifies Guard Mode.

## 4. AI response contract

Replace the service-level plain-text suggestion contract with a structured per-turn decision:

```ts
export type TutorResponseMode = 'tutoring' | 'guard';

export interface TutorActionDecision {
  mode: TutorResponseMode;
  mode_reason: string;
  suggested_response: string;
}

export interface TutorDecisionResult {
  decision: TutorActionDecision | null;
  rawResponse: string;
  success: boolean;
  error?: string;
  contextMessages: string[];
  appliedConfig?: AppliedConfigSnapshot;
}
```

Requirements:

- The exact three decision fields are required and must be non-empty strings.
- `mode` must be exactly `tutoring` or `guard`.
- Invalid structured output must be surfaced as an error.
- Do not silently fall back to tutoring, pattern matching, or a hardcoded counter.
- Preserve the raw response, selected mode, and mode reason so downstream logic can consume and audit them.
- Existing UI consumers should read `decision.suggested_response`.

Use Qwen JSON Object mode with local exact-schema validation. The configured endpoint is the Singapore/international Alibaba-compatible endpoint. Keep the existing model, endpoint, temperature, and `enable_thinking: false`. For structured tutor-decision requests, omit `max_tokens` if required by the provider’s structured-output behavior; record this configuration factor in evaluation metadata. Response length remains controlled by the prompt and rubric.

The existing debug dummy response must not classify modes. Missing or failed provider responses must remain visible errors.

## 5. Prompt behavior rules

The prompt must state that:

- mode is decided independently on every turn;
- Guard Mode requires evidence of deliberate continuation, system-playing, or refusal to learn;
- the four-violation example is evidence only and must never become a hardcoded threshold;
- genuine confusion, imperfect attempts, frustration with engagement, and visible improvement remain tutoring cases;
- Guard Mode remains active after a dodge, superficial acknowledgement, or continued violation;
- Guard Mode exits after a semantic correction, not merely a promise to comply;
- `mode_reason` is brief and grounded in the conversation evidence;
- the Guard persona is serious, direct, and action-focused;
- Guard responses must not insult, humiliate, ridicule, use sarcasm or personal attacks, or threaten the student;
- output must be JSON only, with no Markdown fences or speaker labels.

## 6. Evaluation-first implementation

All AI behavior changes must pass the relevant evaluation. Freeze the evaluation corpus, rubrics, and gate definitions before prompt tuning.

### Evaluation cases

Product-template cases:

- repeated deliberate click violations → `guard`;
- repeated deliberate lock/HTTPS violations → `guard`;
- four failed but improving attempts → `tutoring`;
- prior Guard Mode plus an unrelated dodge → `guard`;
- prior Guard Mode plus a correct safe action → `tutoring`;
- prior Guard Mode plus a semantic paraphrase of the guidance → `tutoring`.

Synthetic cases:

- explicit system-testing before four repetitions → `guard`;
- four joking repetitions → `guard`;
- five credible misunderstandings with progress → `tutoring`;
- first unsafe mistake → `tutoring`;
- frustrated but engaged student → `tutoring`;
- Guard Mode plus acknowledgement without action → `guard`;
- Guard Mode plus correct domain/application verification → `tutoring`.

Expected mode or violation counts must not be passed into the production prompt. Ecological cases must come through real Test Room seeds: add only new seed IDs, verify read-back, regenerate `webpage-ecological.yaml`, and never hand-edit generated ecological dialogue.

### Metrics

Add or extend evaluation metrics for:

- `structured_output`: deterministic contract validation;
- `mode_selection`: deterministic exact expected-mode comparison;
- `mode_reason_grounding`: LLM rubric for evidence-grounded reasoning;
- `guard_response_quality`: LLM rubric for useful, corrective Guard responses;
- `guard_tone_safety`: LLM rubric for serious but non-abusive tone.

Apply the existing tutoring metrics to `suggested_response` through an assertion-level transform while preserving the raw JSON output.

### Quality gate

The gate must require:

- 100% structured-output success in both product and synthetic suites;
- at least 80% mode-selection accuracy in both suites;
- 100% on critical genuine-learning protection cases, with no false Guard activation;
- 100% on critical Guard-exit cases;
- at least 80% on new LLM-judged metrics where applicable;
- at least 80% on existing tutoring metrics independently for product and synthetic suites;
- unchanged direct-correction and scaffold-state gates;
- failure when a suite, transition, metric, or critical case is missing.

### Evaluation metadata

Every evaluation run should record:

- contract version;
- response format;
- target and judge settings;
- the removed token-cap factor, when applicable;
- expected and actual mode counts;
- transition-group results;
- critical failures;
- raw input and output;
- rubric components;
- prompt hash;
- Git state;
- timestamps;
- command exit codes.

Preserve failing baseline and tuning runs. Do not silently change prompts, cases, provider settings, or evaluation configuration to make a run pass.

## 7. TDD and implementation sequence

For executable changes, use `$fast-multi-agent-tdd` with strict Red-Green-Refactor and requirement re-checking:

1. Save `audits/<feature>_request_map.md`, classify affected paths, and start the required no-edit monitor.
2. Freeze cases, rubrics, assertions, and quality gates.
3. Run the unchanged Promptfoo baseline and preserve the expected Guard-related failures.
4. Add Red tests for the provider request and strict structured parsing.
5. Add Red tests for decision propagation into RoomContext/downstream state.
6. Add Red tests for metric-specific and critical-case quality-gate behavior.
7. Run the required review debate after Red.
8. Implement the minimal production changes only during Green: provider structured output, parsing, contract propagation, prompt rules, and evaluation integration.
9. Run the full regression suite after Green.
10. Refactor only after Green and regression; run the code-smell monitor and the cumulative review debate, followed by the full suite.
11. Tune only Guard/output prompts against the frozen evaluation set.
12. Complete `npm run eval:prompts` and retain the resulting metadata.
13. Run the live product-path Qwen suite against `TutorSuggestionService`, not a generic plain-text service.
14. Update documentation after behavior and evaluation are clean.

New executable files require the repository’s shebang and purpose-comment convention. New test files require a header comment naming the file and its purpose and must include edge cases. No Python is currently involved; TypeScript build checks apply. If Python is introduced, run mypy.

## 8. Planned code and documentation touchpoints

Likely implementation paths:

- `tutor-system/src/services/aiService.ts`: structured tutor-decision request, parser, result contract, and provider errors;
- `tutor-system/src/services/ecologicalTutorCall.ts`: ecological prompt/output behavior;
- `tutor-system/src/services/prompts/index.ts`: shared tutoring/Guard mode rules;
- `tutor-system/src/contexts/RoomContext.tsx`: decision propagation and downstream consumption;
- `tutor-system/src/components/` or tutor-view files: Guard indicator, simulated-post composer, profile, and human mode controls;
- `evals/promptfoo/promptfooconfig.yaml`: provider/configuration and assertions;
- `tutor-system/scripts/check-promptfoo-quality-gate.js`: quality-gate enforcement;
- existing Promptfoo evaluator tests under `tutor-system/src/services/__tests__/`;
- `evals/promptfoo/cases/`: frozen product and synthetic cases;
- `tutor-system/src/services/demoRoomTemplates.ts`: ecological Test Room seeds.

Add:

- `evals/promptfoo/AI_BEHAVIOR_EVALUATION_GUIDE.md`: reusable instructions for evaluating new AI behaviors.

Update the Promptfoo README, testing strategy, AI-service documentation, and the dated documentation update record when implementation is committed. Do not commit until explicitly requested.

## 9. Acceptance evidence

The feature is ready for review when:

- parser tests cover valid JSON, malformed JSON, missing fields, invalid modes, empty fields, and provider errors;
- provider-request tests verify the response-format setting and structured-output token behavior;
- failed AI calls do not silently fall back;
- existing UI consumers receive `suggested_response`;
- mode and reason reach downstream logic;
- quality gates fail correctly for missing, invalid, unsafe, or misclassified behavior;
- baseline, final targeted, and final complete Promptfoo runs are preserved;
- a live Qwen product-path run is preserved with full metadata;
- existing browser demos/regressions pass where the environment supports them;
- Guard UI behavior is covered in the later UI delivery slice.

The current evaluator foundation has a passing targeted baseline of 4 suites and 12 tests. That baseline should be retained as a reference before introducing the structured Guard Mode contract.
