# Documentation update record: hosted Supabase E2E configuration

Intent: record the switch from local-only browser evaluation to the configured hosted Supabase endpoint and preserve the incomplete persistence finding.

Updated: 2026-09-09
Implementation commit ID: `20f6e32` (amended after documentation update)

## Scope

- Documented that `npm run eval:behavior:web` accepts either local or hosted Supabase configuration.
- Recorded that hosted browser runs may create test templates, rooms, and messages when explicitly authorized.
- Recorded the seven-room hosted run and its separate product/behavior verdicts.
- Recorded that hosted persistence remains incomplete until `024_raw_instruction.sql` is applied; no hosted schema migration was performed.

## Evidence

- Run directory: `evals/promptfoo/results/qwen3.5-flash/web-test-rooms-2026-09-09T07-49-06-849Z/`
- Seven of seven rooms completed request capture, parser/display checks, and shared behavior evaluation.
- The hosted `ai_suggestion_feedback` table lacks `raw_instruction`, so reviewed-send persistence failed and the product verdict remains incomplete.
