# Approach Selection

The selected backbone combines four materially distinct strategies:

| Plan | Selected approach | Reason |
|---|---|---|
| `selected_1.md` | `traceability-first` | Required to compare the reorganized package with the preserved original and prevent intent drift. |
| `selected_2.md` | `vertical-slices` | Required to connect learner-visible behavior to storage, processing, and UI evidence. |
| `selected_3.md` | `evaluation-first` | Required by the behavior-evaluation contract for Promptfoo metrics, calibration, baseline, candidate, and holdout evidence. |
| `selected_4.md` | `database-security-first` | Required because answer-key privacy, verified principals, RLS, and atomicity are release blockers. |

The other cards remain recorded in `pool.md` as alternatives. They are not silently merged as competing plans. Their useful concerns are represented as explicit risks or validation tasks in the selected cards.
