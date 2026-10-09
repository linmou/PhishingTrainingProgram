# Transfer Provider Configuration Names

Intent: record the documentation correction that aligns Transfer provider settings with the Edge Function and evaluation runner.

Date: 2026-09-30

## Changes

The Transfer response contract and active backend, evaluation, and orchestration specs now name `REACT_APP_OAI_API_KEY` and `REACT_APP_OAI_BASE_URL`. The Edge Function reads these values from Supabase secrets; the evaluation runner reads separately configured values from its environment. Both require the exact `OAI_MODEL=qwen3.5-flash` setting where specified by their provider contract.

## Evidence

`supabase/functions/assessment-api/index.ts` reads the two `REACT_APP_OAI_*` names, and `evals/promptfoo/v1/transfer/runner-config.js` requires the same names for a live run. The existing backend provider contract already lists them. `git diff --check` passed. No runtime code changed.
