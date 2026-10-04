# Browser Fixture Release Verification

Intent: record the live browser evidence for the offline-user AI Edge Function release and its fixture cleanup.

Date: 2026-10-03 local / 2026-10-04 UTC
Tested base commit: `4a0d85d0df6732fbb8d65035ab0caa6e9eb92d3b`
Source commits: `a87f7f6b8e615e1ba3efe49f2d90776ae2449074` (Edge Function), `56975a440e90cad9896d21cd5290d54844e5d3c5` (browser runner)
`ai-api/index.ts` SHA-256: `06209c184f3602626cfc467807297ef98551102a93644649dfaac47102b3f892`

The initial staging suite failed because the Edge Function rejected a 23,637-character tutor system prompt at its 12,000-character per-message limit. The browser runner also expected the old provider response envelope and retained an open checklist panel between hash-route navigations. The regression test first observed HTTP 400 for the real-sized prompt; the fix raised the per-message limit to the existing 50,000-character total limit, retaining total-size rejection. The runner now reads `data.content`, reloads each room, and requires no local provider credentials.

Local checks: `deno test --allow-env --allow-net supabase/functions/ai-api/index.test.ts` passed 8/8; `deno check supabase/functions/ai-api/index.ts` passed; `npm run test:e2e:unit` passed 15/15; `git diff --check` passed.

Staging `ciubrzggdqesgvfkpolj`: deployed `ai-api` via `supabase functions deploy ai-api --project-ref ciubrzggdqesgvfkpolj --use-api --no-verify-jwt`. The full `npm run test:e2e:staging` run `20261004012109-a59fc5e2` passed all seven tutor, checklist, Guard, and assessment workflows. All eight room cleanups passed. The runner process had `OAI_API_KEY`, `OAI_BASE_URL`, and `REACT_APP_OAI_API_KEY` unset; the browser used the staging anon key and no user JWT. Evidence: `tmp/browser_demo_runs/staging-template-20261004012109-a59fc5e2/report.json` and its provider captures and screenshots.

Production `zgbufaxooqxeabewktzd`: deployed the same `ai-api` source through `--use-api --no-verify-jwt`. The first full run showed that the configured general-purpose test room was missing and both assessment-answer cases shared the delivery room. Restored one general-purpose and two separate assessment-answer fixture rooms from validated templates, then updated the runner mapping. The full `npm run test:e2e:production` run `20261004012952-76fa9ee1` passed all seven workflows and all eight room cleanups. The runner process had the provider variables unset and used the production anon key without a user JWT. Evidence: `tmp/browser_demo_runs/production-template-20261004012952-76fa9ee1/report.json` and its provider captures and screenshots.

For these fixtures, both projects retain only the reusable template rooms; generated messages, checklists, sessions, feedback, and private assessment rows were cleaned. No schema migration was required. No quota or Supabase Auth requirement was added.
