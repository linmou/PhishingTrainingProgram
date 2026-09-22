# Contract: Transfer Domain Determinism

**Intent**: Define the pure function and fixture obligations for W2 implementation and downstream consumption.
**Date**: 2026-09-11  
**Revised**: 2026-09-22

## Pure Boundaries

| Boundary | Input | Output | Must not do |
|---|---|---|---|
| `parseAssessmentAnswer` | learner content, selection type, public options | selection, clarification code, or not-selection | semantic guessing, grading, or progress writes |
| `gradeSelection` | selected IDs and private key IDs | `pass` or `fail` | partial credit, explanation analysis, or LLM calls |
| `renderAssessment` / validation | assessment stem, type, options | canonical text and deterministic errors | leak the key/basis or vary option order |
| `applyLearningEvent` | valid progress pair and event kind | apply, no-change, or reject with next pair/error | write storage or invent a new state |
| v3 parser/validator | JSON content and known IDs | normalized validated `TutorDecisionV3` | accept unknown IDs or incompatible modes; reject Guard merely for using a real teaching instruction |
| answer resolver/orchestrator | delivery, current context, learner message, private assessment, server-owned attempt snapshot | next immutable snapshot, one stable lifecycle disposition, disclosure boundary, and next action | grade undelivered/stale/duplicate/terminal answers, persist attempts, chain assessments, call APIs, or project transport DTOs |

## Required Fixture Suites

1. `contract`: valid v3 decisions for tutoring with a real teaching instruction, Guard with `guard`, Guard with each real teaching instruction, and assessment with `transfer_assess`; required learner-safe explanation; every invalid mode/instruction/target/payload/cardinality/privacy case.
2. `parser`: explicit label normalization, exact option text, Unicode/full-width forms, ambiguity, content help, and malformed input.
3. `grader`: all 16 A-D subsets, duplicate/order normalization, single and multiple keys, and empty selection.
4. `rendering`: option order, instruction selection, 80/81 segment boundary, two/three sentence boundary, exactly four options.
5. `reducer`: all 28 state/event cells and invalid state pairs.
6. `orchestrator`: correct-first, incorrect-correct, incorrect-incorrect, duplicate at each stage, terminal third submission, reload/tab-equivalent snapshot, undelivered, clarification, assistance, repair, contradiction, spontaneous transfer, stale, Guard, and no-chain sequences.

## Sequence Expectations

- **Pass first**: signal -> delivered question at `open/0` -> correct labels -> `passed/1` and `covered/good` -> terminal feedback -> tutoring feedback -> no retest.
- **Retry then pass**: signal -> wrong -> `open/1`, progress unchanged, no terminal feedback -> correct -> `passed/2` and `covered/good` -> terminal feedback.
- **Fail/recover**: signal -> wrong -> retry -> wrong -> `failed/2` and `needs_review/basic` -> terminal feedback -> repair -> new learner signal -> different context -> pass.
- **No repair**: terminal fail -> acknowledgment -> remain `needs_review/basic`.
- **Clarification**: question -> `B or D?` -> unchanged/open -> format help -> clear labels -> pass.
- **Assistance**: question -> content help -> assisted/cancelled, no failure -> fresh signal -> different question.
- **Correct-with-reason**: correct labels plus inaccurate optional learner input prose -> pass once; no same-message downgrade.
- **Regression**: covered -> distinct later contradiction -> `needs_review/basic`.
- **Spontaneous**: changed-context application -> `covered/good` without generated question.
- **Multi-target**: three initial signals -> all partial/basic -> one assessment; other targets remain eligible.
- **Guard**: valid answer under Guard -> no protected progression write; reviewed recovery -> deferred event applies once when still valid.
- **Races/stale**: duplicate send, duplicate answer at attempt one or two, retry, terminal third answer, stale draft/manual update -> no extra attempt, question, progress, or feedback effect.
- **Disclosure**: unresolved and retryable results contain neither key nor learner-safe explanation; passed/failed terminal results contain both in `terminal_feedback`.

## Fixture Stability

Fixture IDs, attempt/result types, and expected disposition names are public planning artifacts for downstream 102/104. Component 102 owns persistence and facade/API projection and must consume these outputs rather than duplicate their rules. Error messages may be more specific in implementation, but each invalid class must retain a stable category so tests do not depend on incidental wording.
