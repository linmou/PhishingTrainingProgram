# Current transfer prompt: added-case results

Intent: preserve the result of applying the branch's 40 added cases to the current transfer-analysis component.

Executed: 2026-10-15. Source baseline: `8dc7271`; imported case commit: `af86353863c60d5517b6bb6b3a4748554c64fd36`. Verdict: complete diagnostic run, failed behavior gates. This component is shared by the current original/cleaned tutor candidates; it measures no tutor-prompt effect.

The [plan](../../../tutor-system/docs/ai-behaviors/transfer-analysis-evaluation-plan.md), [independent integration audit](audit-current-integration.json) and local immutable run `output/transfer-analysis-current/added-20261015-01/` preserve the protocol. The freeze contains full authority, source dependencies, cases, prior states, prompt and settings; generations preserve every input, raw response, applied state, score and request metadata. `resource-monitor.jsonl` and session records retain execution progress. Raw artifacts are intentionally untracked.

| Artifact | SHA-256 |
| --- | --- |
| Current transfer prompt | `3d7adb68417498e44d16404ada5a0f10533480a7bee11accb349d13afcea4e92` |
| Frozen manifest file | `6fd6ca9519b28ebe9adcfe037ac6c6f0776ad77fc88b15c61360789c10a9604b` |
| `summary-1792051937397.json` | `cd406e4e176857122df1bd65f31cfa260a06ed56048a63d727f24692ebaac25b` |
| Integration audit | `5e0e0d5ef0c4aa012cf2f006d9bc79059382809d75c8c5fcce56c8788edbb191` |

All120 logical records are present. Two exact-input aliases reuse corresponding repetitions, giving114 independent provider requests for38 distinct inputs. Existing tutor targets/judgments and historical transfer outputs were retained. Every new call returned HTTP200 and a complete response; validity passes120/120. Three repetitions use Qwen3.5 Flash, temperature0, max_tokens600, thinkingfalse, JSON object output, no seed and one attempt. Sixteen workers implement the requested fourfold concurrency increase. `OAI_MODEL=qwen3.5-flash` was supplied explicitly on the run command because the local environment file lacks that field; key and endpoint come from configured OAI variables. Usage:177504 prompt tokens and20563 completion tokens.

| Check | Result | Gate |
| --- | --- | --- |
| Raw event | 79/120 | Failed80% |
| Applied state | 79/120 | Failed80% |
| Assessment route | 120/120 | Passed80% |
| Validity | 120/120 | Passed100% |
| Semantic pair repetitions | 25/60 | Failed100% |
| Individual macro-F1, repetitions1/2/3 | 40.27% /39.27% /39.27% | Failed70% |
| Pooled macro-F1 | 39.61% | Failed70% |
| Two-member macro-F1 | 39.58% | Diagnostic |
| Three-member macro-F1 | 39.27% | Failed strictly above90% |
| Three-member no-event recall | 11/15,73.33% | Failed90% |

The unique-input diagnostic gives three-member macro-F1 40.66%; dependent aliases do not explain the failure. Thirteen logical cases are wrong in all three repetitions. All41 raw-event failures also fail applied state, so consumer filtering did not rescue those decisions. Suite event/state passes are45/60 semantic contrasts,0/12 surface variants and34/48 former holdouts. Routing still passes on these inputs; this does not establish classification correctness or whole-room lifecycle behavior. Full per-class confusion matrices, partitions, individual/ensemble predictions and joined failure records are in the summary.

The independent [failure diagnosis](diagnostic-added-current-20261015.json) separates under-credit of complete intended actions from unsupported attribution/scope credit, recognition-target interference, contradiction and transfer/repair errors. Branch reference labels remain unchanged. The largest error group invents a requirement for completed real-world execution even though the adopted contract permits a specific intended safe choice to cover a narrow action target. These results do not support acceptance. Human label review and independent unseen validation remain pending; exposed former holdouts count as regression coverage only. Any next refinement must use the expanded full suite, preserving all73 original cases and40 additions plus propagated sequence checks.
