# Integration Edge: component 104-transfer-evaluation

**Intent**: name the artifact index, the ownership boundary against component 102 and the release gates, and the integration-edge changes this component needs but does not make.

**Recorded**: 2026-09-12. Created after the component's offline suite reached green on `104-transfer-evaluation`.

## 2026-09-22 upgrade status

The artifact index below describes the implemented historical baseline. It does not establish the approved two-attempt lifecycle or learner-safe explanation behavior. Upgrade implementation is blocked until this file records promoted immutable producer contracts:

- Component 101: `PrivateAssessment.learner_safe_explanation`, `TransferAttemptSnapshot`, and `TransferResolvedAssessment` from `specs/101-transfer-domain/contracts/transfer-domain-determinism.md` and `transfer-assessment-draft.md`.
- Component 102: planning commit `a8c8b31a91bcc1970071117ac0dbbd2dffce85ef` plus its reconciled `PublicAssessmentDTO.student_id` correction; `TransferTutorRequestV3`, `TransferTutorRequestContextV3`, canonical builders; `PublicAssessmentDTO {id, student_id, selection_type, stem, options}` with no `rendered_text`; and canonical `ProcessedMessageDTO` fields including `processing_state`, `answer_outcome`, and terminal-only `terminal_failure_feedback` from `specs/102-transfer-backend/contracts/assessment-api.md`, `provider-contract.md`, and `rpc-contract.md`.
- Integration: canonical T09 reconciliation, green promotion SHA, producer commit SHAs/content hashes, and real 101->104 and 102->104 handoff commands.

Component 104 owns upgraded cases, `learner_explanation_quality`, `learner_explanation_disclosure`, lifecycle/disclosure/parity tests, immutable evidence, and gate changes. It does not grade answers, increment attempts, authorize users, persist state, reconstruct product requests, or edit production prompts.

Live target and judge configuration is resolved by integration commit `df40f32`: both use `qwen3.5-flash` through the existing DashScope-compatible provider. Runtime mismatch or absence blocks; no fallback is allowed.

## Artifact index (owned by this component)

| Artifact | Purpose |
| --- | --- |
| `evals/promptfoo/v1/transfer/case-schema.json`, `cases.json`, `case-schema.js` | Frozen transfer case contract and its validator. |
| `evals/promptfoo/v1/transfer/metric-registry.json` | The five historical rubric IDs and supporting check; the upgrade adds `learner_explanation_quality` and `learner_explanation_disclosure`. |
| `evals/promptfoo/v1/transfer/manifest-schema.json`, `manifest.json`, `manifest-schema.js` | Immutable run manifest, its declaration, and its validator. |
| `evals/promptfoo/v1/transfer/gate-policy.json`, `quality-gate.js` | Frozen thresholds and the blocking verdict. |
| `evals/promptfoo/v1/transfer/contract-checks.js`, `followup-checks.js`, `pair-transition.js` | Deterministic contract, lifecycle, and joint pair checks. |
| `evals/promptfoo/v1/transfer/adapter.js`, `shared-request-contract.js`, `runner-config.js` | Thin target projection, the shared-contract consumer, and the runner registration. |
| `evals/promptfoo/v1/transfer/evidence-record.js`, `report.js`, `calibrate.js`, `comparison.js` | Write-once evidence, the report boundary, judge calibration records, and comparability. |
| `evals/promptfoo/v1/transfer/validate-manifest.js`, `gate-fixtures.js` | The two offline quickstart commands. |
| `evals/promptfoo/rubrics/v1/transfer_trigger_target.md`, `medium_transfer_quality.md`, `assessment_item_validity.md`, `verification_evidence.md`, `assessment_followup.md` | The five rubric contracts; registered in `evals/promptfoo/rubrics/v1/manifest.json` under `transfer_registry`. |
| `evals/promptfoo/holdouts/transfer-sealed/` | Reserved for the sealed holdout package; empty until candidate freeze. |

## Ownership boundary

- **Component 102 owns** `tutor-system/src/services/ecologicalTutorCall.ts` (the v3 request/context builder), the production Edge Function and its `TRANSFER_V3_SYSTEM_PROMPT`, the provider/secret path, migrations, and the product 1,200-token setting. This component consumes those artifacts by reading and hashing them. It does not edit them and does not copy the production prompt text.
- **Component 104 owns** the artifacts above: evaluation consumption, parity tests, immutable evidence, and gates.
- **Component 101 owns** pure attempt/grading/progress behavior. **Integration and release owners** retain database/authorization/UI/browser/activation/rollback acceptance.

## Integration-edge changes needed from component 102

The historical notes below remain true for the old harness. The upgrade is blocked until the promoted 101/102 identities and canonical T09 reconciliation named above are recorded.

1. **A 102-owned exported budget constant is the documented alternative to source-based parity.** The effective transfer budget is the literal `max_tokens: 1200` at the transfer call site of `tutor-system/src/services/transferAssessmentService.ts`, not a shared export (integration control-plane record R13; the call site moved into the browser service when the server boundary was removed for the research build). This component therefore asserts parity against the production source: `shared-request-contract.js` locates the transfer call site by the `TRANSFER_V3_SYSTEM_PROMPT` marker, extracts `max_tokens`, `enable_thinking`, and `temperature`, and asserts `1200` / `false` / `0.3`.
2. **The thinking flag received the same treatment (directive R14).** Production runs the transfer call with `enable_thinking: false`, while `evals/promptfoo/v1/settings.json` declares `target_enable_thinking: true` and `target_max_tokens: 8000` for the legacy v1 path. The transfer path declares its own `1200`/`false` values in `manifest.json` and `runner-config.js`, and asserts them against the production source. The legacy v1 values are unchanged and are not inherited by the transfer path; `manifest-schema.json` records that separation explicitly.

## Unresolved dependencies recorded rather than papered over

- The sealed holdout package under `evals/promptfoo/holdouts/transfer-sealed/` is empty. Candidate freeze before holdout exposure is a hard checkpoint, so holdouts are authored only after a candidate run exists.
- Live calibration, baseline, and candidate stages require the live configuration described in `verification-record.md`. Until they run, semantic rubric calibration is `unrun` and the gate would return `incomplete` for want of semantic evidence.
- The transfer target path has no production prompt of its own: `TRANSFER_V3_SYSTEM_PROMPT` lives in the Edge Function, and `adapter.js` consumes only the builder and the frozen prompt reference/hash.
