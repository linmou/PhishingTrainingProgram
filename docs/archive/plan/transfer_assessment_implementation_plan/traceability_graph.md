# Requirement Traceability Graph

## Intent

Map every source requirement family to one work package, an implementation owner, a verification artifact, and the milestone ledger. The original handoff remains the normative wording.

## User decisions

| Source | Preserved responsibility | Work package | Verification |
|---|---|---|---|
| U01 | Correct answers, explanations, actions, self-corrections, and acknowledgments may trigger assessment; no strong prior proof required. | [runtime](work_packages/03_transfer_runtime.md) | trigger/target cases; response contract |
| U02 | Medium transfer changes the meaningful situation, not only a brand. | [evaluation](work_packages/06_evaluation.md) | medium-transfer rubric and semantic pairs |
| U03 | Hypothetical scenarios are accurate, self-contained, and do not invent organization facts. | [runtime](work_packages/03_transfer_runtime.md) | item-validity cases and production path |
| U04 | Reuse `status` and `understanding_level`; no parallel mastery field. | [persistence](work_packages/04_persistence_and_schema.md) | schema and transition tests |
| U05 | `basic` follows initial evidence; `good` follows successful transfer; no new `excellent`. | [runtime](work_packages/03_transfer_runtime.md) | reducer, grading, progress integration |
| U06 | Do not routinely reassess verified concepts; later contradiction can reopen. | [runtime](work_packages/03_transfer_runtime.md) | no-retest and regression cases |
| U07 | Protection/correction precedes assessment; assessment precedes a new target. | [runtime](work_packages/03_transfer_runtime.md) | priority and response-contract checks |
| U08 | Add turn-level `assessment` and `transfer_assess`; assessment is not room mode. | [runtime](work_packages/03_transfer_runtime.md) | contract, enum, room-mode tests |
| U09 | Participation-only Guard uses `instruction: guard`, not null. | [runtime](work_packages/03_transfer_runtime.md) | decision contract and Guard regression |
| U10 | Mark all newly signaled concepts; assess one at a time with safety/current relevance priority. | [runtime](work_packages/03_transfer_runtime.md) | multi-target and target-selection cases |
| U11 | Valid spontaneous medium transfer can verify without a quiz. | [runtime](work_packages/03_transfer_runtime.md) | spontaneous-transfer reducer and semantic case |
| U12 | After failure, repair, wait for new learner evidence, then use a different context. | [runtime](work_packages/03_transfer_runtime.md) | fail/recover stateful sequence |
| U13 | Assessment occupies one tutor turn; answer response is tutoring or Guard, not automatic second assessment. | [runtime](work_packages/03_transfer_runtime.md) | follow-up and no-chain tests |
| U14 | Exact correct selection is sufficient; no explanation/confidence required. | [runtime](work_packages/03_transfer_runtime.md) | parser/grader and answer cases |
| U15 | Existing teacher review remains; an unsent draft is not delivered. | [runtime](work_packages/03_transfer_runtime.md) | editor and send lifecycle tests |

## Canonical behavior requirement mapping

The canonical behavior specification owns the observable requirement IDs. This table keeps T09 mapped to the original decision families and to the evidence lanes that must complete before release; it is the only requirement map for the decomposed plan.

| Behavior ID | Observable responsibility | Work packages | W0 and downstream verification |
|---|---|---|---|
| T09 | Evidence-based transfer eligibility and one-target selection; meaningful medium transfer; accurate self-contained scenarios; exact assessment lifecycle; teacher delivery boundary; ambiguity/assistance handling; feedback-first follow-up; no routine retest; contradiction reopen; existing progress-pair preservation. | [requirements](work_packages/01_requirements_and_traceability.md), [runtime](work_packages/03_transfer_runtime.md), [persistence](work_packages/04_persistence_and_schema.md), [authorization](work_packages/05_authorization_and_provider.md), [evaluation](work_packages/06_evaluation.md), [browser](work_packages/07_browser_and_release.md) | Canonical spec T09, v3 response contract, T09 evaluation contract, legacy applicability audit, BDD lifecycle feature, deterministic §14 suites, hosted SQL/RLS evidence, semantic Promptfoo evidence, and dedicated browser release evidence. |

## Implementation defaults

| Source | Preserved responsibility | Work package | Verification |
|---|---|---|---|
| D01 | Four fixed A-D options; one key for single and two/three for multiple. | [runtime](work_packages/03_transfer_runtime.md) | contract/rendering tests |
| D02 | Multiple answers use exact-set equality; dedupe and ignore order. | [runtime](work_packages/03_transfer_runtime.md) | grader exhaustive subsets |
| D03 | Use existing chat and a structured teacher editor. | [runtime](work_packages/03_transfer_runtime.md) | UI/editor and browser slice |
| D04 | One outstanding delivered assessment per room/student. | [persistence](work_packages/04_persistence_and_schema.md) | unique index and race test |
| D05 | Explicit uncertain selection may grade; alternatives are ambiguous. | [runtime](work_packages/03_transfer_runtime.md) | parser boundaries |
| D06 | Recognized selection controls grade despite optional explanation. | [runtime](work_packages/03_transfer_runtime.md) | same-message precedence |
| D07 | Assessment render max 80 word-like segments and two stem sentences. | [runtime](work_packages/03_transfer_runtime.md) | rendering boundary tests |
| D08 | Question/key interaction is separate from learner progress. | [persistence](work_packages/04_persistence_and_schema.md) | schema and lifecycle tests |
| D09 | Every new-policy checklist has one explicit student owner. | [persistence](work_packages/04_persistence_and_schema.md) | owner/RLS tests |
| D10 | New policy applies only to new explicitly enabled checklists; legacy values remain legacy. | [persistence](work_packages/04_persistence_and_schema.md) | legacy compatibility tests |
| D11 | First valid submission resolves once; later guesses cannot improve it. | [persistence](work_packages/04_persistence_and_schema.md) | idempotency and race tests |
| D12 | Feedback tutoring turn precedes a new assessment. | [runtime](work_packages/03_transfer_runtime.md) | orchestrator/follow-up tests |
| D13 | Format clarification leaves open; content help cancels as assisted. | [runtime](work_packages/03_transfer_runtime.md) | clarification/assistance cases |
| D14 | Rejection suppresses automatic re-proposal; explicit regeneration is allowed. | [runtime](work_packages/03_transfer_runtime.md) | draft lifecycle tests |
| D15 | Exact answer grading is deterministic; LLM does not receive selected labels for grading. | [authorization](work_packages/05_authorization_and_provider.md) | provider/request inspection |
| D16 | Auth and answer-key protection are release gates; do not build a new sign-in product. | [authorization](work_packages/05_authorization_and_provider.md) | authorization attack suite |

## Cross-cutting source sections

| Source section | Work package | Evidence required |
|---|---|---|
| Non-goals, §1.3 | [requirements](work_packages/01_requirements_and_traceability.md) | scope review; no unrelated feature |
| State table and guards, §§3-4 | [runtime](work_packages/03_transfer_runtime.md) | 28 reducer cells, contract, lifecycle sequences |
| Server responsibilities, §§8-9 | [persistence](work_packages/04_persistence_and_schema.md) and [authorization](work_packages/05_authorization_and_provider.md) | SQL/transaction, idempotency, stale/race checks |
| Privacy and auth matrix, §10 | [authorization](work_packages/05_authorization_and_provider.md) | learner/teacher/backend access tests and browser inspection |
| Application integration, §11 | [runtime](work_packages/03_transfer_runtime.md) | room/UI integration and downstream consumption |
| Migration/compatibility, §12 | [persistence](work_packages/04_persistence_and_schema.md) | hosted status, actual schema, legacy preservation |
| Deterministic contract, §14 | [runtime](work_packages/03_transfer_runtime.md) | required unit and integration test files |
| Semantic evaluation, §15 | [evaluation](work_packages/06_evaluation.md) | cases, rubrics, calibration, baseline/candidate, holdouts |
| Browser acceptance, §16 | [browser](work_packages/07_browser_and_release.md) | dedicated transfer browser evidence |
| Work packages, §17 | [all] | W0-W11 milestone ledger |
| Final report/definition of done, §19 | [browser](work_packages/07_browser_and_release.md) | final evidence report and gate verdict |
| Activation/rollback, §20 | [browser](work_packages/07_browser_and_release.md) | flag state, disable path, non-destructive rollback |

## Ownership invariant

The reducer owns state transitions; parser owns selection syntax; grader owns exact-set equality; server owns authentication, atomicity, key storage, and idempotency; detector owns evidence classification; the model owns semantic instructional choice and phrasing; the teacher owns final review. React effects and prompts must not become a second progression authority.
