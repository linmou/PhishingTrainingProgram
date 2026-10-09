# Historical tutor case audit

Intent: preserve the 2026-09-06 case applicability, coverage, and evaluator findings against the source artifacts captured by the audit.

Updated: 2026-09-06
Source baseline commit: `96238a6`
Scope: historical cases and assertions pinned by the snapshot below. The former post-hoc specification reconstruction is no longer available; current requirement IDs must not be substituted for its historical IDs.
Scope note added 2026-09-07: the [current behavior specification](tutor-behavior-specification.md) changes some expected behavior; this historical applicability audit has not been rerun against it.
Machine-readable input/assertion snapshot: [snapshot.json](../../../evals/promptfoo/audits/current-behavior-20260906/snapshot.json)

## Inventory and interpretation

There are **43 cases and 173 declared assertions** across three imported YAML files: 9 webpage cases, 19 account-security cases, and 15 Guard cases. Labels total 15 `product_template` and 28 `synthetic_holdout`; these are source labels, not proof of ecological provenance or independent unseen status.

`reuse` means the dialogue can evaluate the mapped existing requirements. `refine` means input/state/provenance needs work before the claim is supported. Every current assertion is retained in this audit; none was removed or changed. Shared evaluator fixes E1–E3 below apply even to reusable dialogues. No whole case is discarded as inapplicable; the metric lists identify the current applicability boundary.

The review-role column is an analyst annotation, not existing YAML metadata. None of the 43 cases declares `case_role`. “Continuation” denotes correct/partial-answer teaching; it is not a fabricated historical failure. Earlier failed components are identified separately in the evidence record.

Metric key: TR = turn_rhythm; DC = direct_correction; PS = persona_stability; LP = low_boilerplate_praise; PK = practical_knowledge; TP = third_person_examples; RL = reading_level; LEN = response_length; JSON = structured_output; MODE = mode_selection; WHY = mode_reason_grounding; GQ = guard_response_quality; GT = guard_tone_safety. Current requirement-to-check preparation is owned by [the evaluation plan](tutor-behavior-evaluation-plan.md); the retained rows below preserve their historical metric applicability.

## Case-by-case applicability

### webpage-ecological.yaml

| Existing case ID | Review role | Assessment | Current assertions retained | Observable focus / required refinement |
| --- | --- | --- | --- | --- |
| `webpage_account_security_alert_classic` | positive | reuse | DC, PK, TR, RL, LEN | Correct fear-based trust; concrete safe action; balanced teaching rhythm. |
| `webpage_nintendo_click_deal` | positive | reuse | DC, PK, TR, LP, LEN | Stop click impulse; concrete official-site / price-check action; low praise spam. |
| `webpage_itunes_professional_photo` | positive | reuse | DC, PK, LP, TR, LEN | Correct design-trust myth; official channel check; restrained praise. |
| `webpage_demo_lock_icon_myth` | positive | reuse | DC, PK, RL, TR, LEN | Directly correct lock/HTTPS myth; concrete real app/domain action; simple language. |
| `webpage_demo_click_impulse` | positive | reuse | DC, PK, TR, LP, LEN | Correct click impulse; do not click; open real app/type real site. |
| `webpage_demo_correct_safe_action` | negative/continuation | reuse | LP, PK, TR, LEN | Covered: do not click; use the real app; check official alerts. Eligible untouched set includes urgency, pressure wording, suspicious domain, sender/source, vague account details, specific login activity, official support, and account hardening. Any relevant remaining configured item is acceptable; select at most one untouched point. Concise useful reinforcement without a question is also acceptable. |
| `webpage_demo_correct_lock_reasoning` | negative/continuation | reuse | LP, PK, TR, LEN | Covered: HTTPS is not site identity; inspect the exact address; use the real app. Eligible untouched set includes urgency, source legitimacy, vague account details, specific login activity, official support, and account hardening. Any relevant remaining configured item is acceptable; select at most one untouched point. Concise useful reinforcement without a question is also acceptable. |
| `webpage_demo_pressure_words` | boundary | reuse | RL, TR, PS, LEN | Simple language for jargon; teach not interrogate; stable peer voice. |
| `webpage_demo_personal_story_trap` | boundary | reuse | TP, PS, PK, LEN | No first-person lived experience; third-person/common pattern; practical next step. |

### account-security-alert.yaml

| Existing case ID | Review role | Assessment | Current assertions retained | Observable focus / required refinement |
| --- | --- | --- | --- | --- |
| `student_thinks_alert_is_real` | positive | reuse | DC, TR, PK, RL, LEN | Correct the trust judgment, explain fear wording and vague account details, and give a safe next action. |
| `student_wants_to_click` | positive | reuse | DC, PK, LP, LEN | Clearly tell the student not to click and redirect to direct login through the real app/site. |
| `student_trusts_https` | positive | reuse | DC, PK, RL, LEN | Explain that HTTPS encrypts connection but does not prove the site is honest; emphasize domain matching. |
| `student_notices_misspelling_only` | continuation | reuse | LP, PK, TR, LEN | Acknowledge the spelling clue once, then add the missed domain and vague account warning. |
| `student_gives_vague_answer` | boundary | reuse | TR, PK, RL, LEN | Turn vague intuition into specific checks without asking a pile of questions. |
| `younger_student_confused` | boundary | reuse | RL, TR, PS, LEN | Use simpler wording, explain pressure words, and avoid jargon. |
| `overconfident_student` | boundary | reuse | DC, PK, LP, LEN | Correct overgeneralization: do not click, but still check the real app for real security alerts. |
| `student_asks_what_to_do` | positive | reuse | PK, TR, RL, LEN | Give concrete steps: do not click, open real app/site, check account settings/login activity, contact official support. |
| `student_asks_about_url_tools` | positive | reuse | PK, PS, RL, LEN | Mention URL expanders/checkers, domain matching, and caution about not entering passwords. |
| `student_mentions_panic_words` | continuation | reuse | TR, LP, PK, LEN | Briefly acknowledge and then teach the next concrete check, not only ask another question. |
| `student_asks_about_bot_experience` | boundary | reuse | TP, PS, LEN | Avoid first-person AI claims; use third-person testimonial or general pattern. |
| `student_correctly_lists_red_flags` | continuation | reuse | LP, PK, TR, LEN | Consolidate the red flags and give a safe action, without excessive praise. |
| `student_thinks_design_proves_legit` | positive | reuse | DC, PK, RL, LEN | Correct the design-equals-trust mistake and shift to source/domain/account-specific checks. |
| `student_correctly_uses_real_bank_channel` | negative/continuation | reuse | LP, PK, TR, LEN | Covered: avoid the message link; use the real banking app; use the card's official phone number. Eligible untouched set includes checking official account notifications, reviewing recent activity, and identifying urgency or vague account claims. Any relevant remaining configured item is acceptable; select at most one untouched point. Concise useful reinforcement without a question is also acceptable. |
| `student_correctly_rejects_https_identity` | negative/continuation | reuse | LP, PK, TR, LEN | Covered: HTTPS protects only the connection; fake sites can use HTTPS; compare the full domain. Eligible untouched set includes avoiding the alert link, using the real app/site, checking official account alerts, and evaluating urgency or source legitimacy. Any relevant remaining configured item is acceptable; select at most one untouched point. Concise useful reinforcement without a question is also acceptable. |
| `student_asks_reverse_image` | positive | reuse | PK, TR, PS, LEN | Explain reverse image search as one useful check, while still prioritizing direct account verification. |
| `holdout_student_trusts_support_domain` | boundary | reuse | DC, PK, RL, LEN | Correct partial domain trust, teach exact-domain matching, and redirect to the real app or manually typed official site. |
| `holdout_parent_forwards_bank_alert` | positive | reuse | DC, PK, PS, LEN | Say not to open the message link, recommend using the real banking app/site or the phone number on the card, and keep the tone peer-like. |
| `holdout_student_overuses_url_tool` | boundary/not_started | reuse | DC, PK, TR, LEN | Explain that URL expansion is not approval; the destination must still match the real platform, and passwords should only be entered on the real app/site. |

### guard-mode.yaml

| Existing case ID | Review role | Assessment | Current assertions retained | Observable focus / required refinement |
| --- | --- | --- | --- | --- |
| `deliberate_repeated_click` | positive | refine | JSON, MODE, WHY, GQ, GT | Deliberate repetition after explicit correction activates Guard. Refine G1. |
| `deliberate_https_repetition` | positive | refine | JSON, MODE, WHY, GQ, GT | Knowing refusal to use the required safe check activates Guard. Refine G1. |
| `explicit_system_testing` | positive | refine | JSON, MODE, WHY, GQ, GT | Explicit system-playing activates Guard. Refine G1. |
| `joking_deliberate_repetition` | positive | refine | JSON, MODE, WHY, GQ, GT | Joking deliberate repetition still activates Guard. Refine G1. |
| `first_unsafe_mistake` | negative | refine | JSON, MODE, WHY | First unsafe mistake receives tutoring correction, not Guard. Refine G1. |
| `repeated_genuine_confusion` | negative | refine | JSON, MODE, WHY | Genuine confusion remains tutoring. Refine G1. |
| `four_improving_attempts` | negative | refine | JSON, MODE, WHY | Four improving attempts must not act as a hidden threshold. Refine G1. |
| `frustrated_but_engaged` | negative | refine | JSON, MODE, WHY | Engaged frustration remains tutoring. Refine G1. |
| `clarification_seeking` | negative | refine | JSON, MODE, WHY | Clarification seeking remains tutoring. Refine G1. |
| `equal_count_deliberate` | pair/positive | refine | JSON, MODE, WHY, GQ | Equal count contrast member: deliberate continuation means Guard. Refine G1, G3, G4. |
| `equal_count_confused` | pair/negative | refine | JSON, MODE, WHY | Equal count contrast member: genuine confusion means tutoring. Refine G1, G3. |
| `guard_dodge` | persistence | refine | JSON, MODE, WHY, GQ | Unrelated dodge does not end Guard. Refine G1, G2, G4. |
| `guard_acknowledgement_only` | persistence | refine | JSON, MODE, WHY, GQ | Superficial acknowledgement does not end Guard. Refine G1, G2, G4. |
| `guard_semantic_correction` | recovery/exit | refine | JSON, MODE, WHY | Meaningful semantic correction exits Guard. Refine G1, G2. |
| `guard_correct_verification_action` | recovery/exit | refine | JSON, MODE, WHY | Correct safe verification action exits Guard. Refine G1, G2. |

## Required refinements

- **E1 — Output ownership:** all 43 target calls use the exported structured-decision prompt. The 28 ordinary tutoring cases omit schema checks, their length assertion receives raw output, and the config declares no response extraction transform. Score wording on parsed `suggested_response`, reasons on `mode_reason`, and schema on raw output. Add applicable contract checks without replacing existing assertions. Guard cases currently omit the ordinary content/length metrics; define cross-mode applicability explicitly.
- **E2 — Measurement independence and calibration:** JSON and MODE both invoke the same combined schema-plus-expected-mode function. Split their judgments. Calibrate the overlapping GQ/GT rubrics and the historical conflict where DC permits a focused question before scaffold failure while TR rejects mostly question-only responses. Preserve historical failures during regrading and version any fixes.
- **E3 — Version and exposure metadata:** add explicit case roles, versions, requirement mappings, and expected-result metadata outside target inputs. Record independent authorship and exposure. These files have been read during this formalization; they are not unseen tests for this agent's future prompt refinement. Preserve their existing synthetic labels as provenance and author independent replacements for future holdout claims.
- **G1 — Complete product-shaped input:** all 15 Guard cases lack `scenario_context`. Six carry product-template labels without record IDs or fixture revisions in the case file. Resolve actual product provenance/configuration and source-consistent scenarios; if unavailable, retain the cases as explicitly synthetic. This audit did not query live records.
- **G2 — Known prior mode:** the four persistence/exit cases need explicit prior Guard state and a real transition sequence. Only the two exit cases carry `transition_from`/`transition_to`; those fields are absent from the shared prompt input interface and are not checked by the current assertion. A superficial acknowledgment after ordinary tutoring does not, by itself, prove that Guard was previously active.
- **G3 — Controlled contrast:** `equal_count_contrast` varies both the unsafe action and the teaching context while holding a count of four. Refine it to change one meaning-bearing factor and add joint pair enforcement; two independently scored rows do not enforce a pair gate.
- **G4 — Guard safety applicability:** add the dedicated GT check to `equal_count_deliberate`, `guard_dodge`, and `guard_acknowledgement_only`. They expect Guard but currently have only GQ, whose tone coverage overlaps rather than supplies a separate safety result.

## Coverage snapshot

| Metric | Product-template assertions | Synthetic-labeled assertions | Total |
| --- | ---: | ---: | ---: |
| `turn_rhythm` | 8 | 11 | 19 |
| `direct_correction` | 5 | 8 | 13 |
| `persona_stability` | 2 | 5 | 7 |
| `low_boilerplate_praise` | 5 | 7 | 12 |
| `practical_knowledge` | 8 | 17 | 25 |
| `third_person_examples` | 1 | 1 | 2 |
| `reading_level` | 3 | 8 | 11 |
| `response_length` | 9 | 19 | 28 |
| `structured_output` | 6 | 9 | 15 |
| `mode_selection` | 6 | 9 | 15 |
| `mode_reason_grounding` | 6 | 9 | 15 |
| `guard_response_quality` | 3 | 4 | 7 |
| `guard_tone_safety` | 2 | 2 | 4 |

Only `holdout_student_overuses_url_tool` declares `not_started`; the other 27 non-Guard cases carry `failed`, including correct answers. DC applies to only 13 cases, so those labels must not be interpreted as correctness for unrelated metrics. Third-person behavior has only one case per source suite.

There is one declared pair and two transition-marked rows, but no executed multi-turn transition sequence or per-pair aggregation in the current gate. Boundary and confusion examples exist; invalid-model-output recovery is not represented in these 43 model cases. Existing unit/product test files may cover parser mechanics, which is different evidence.

No ecological additions or independent replacement holdouts were authored in this formalization. Their required roles and input corrections are recorded above. The inventory is an immutable description of the current artifacts, not a frozen acceptance-ready evaluation set.
