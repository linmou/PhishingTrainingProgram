# Sequential knowledge-point completion: documentation update

Intent: record the spec change that accompanies PR #86 (`3becd9b`), dated 2026-11-14.

- `ai-behaviors/tutor-behavior-specification.md` T01: correction targets the failed component only; recognition and action are gated separately by attempt or explicit confusion; recognition correction no longer carries the safe action; immediate protection unchanged.
- `ai-behaviors/tutor-behavior-specification.md` T02: a point is complete only when both Observation and Behavior tasks are demonstrated; the tutor finishes the current point before another.
- Experiment reports still show progression failures for this candidate; the spec states the intended behavior, not measured acceptance.
