# Prompt Eval Workspace

Standalone website for non-technical prompt and eval review.

This folder is intentionally outside `tutor-system`. It reads a static browser seed copied from `evals/promptfoo` artifacts and lets reviewers:

- inspect how the prompt is composed
- edit prompt sections as a safe draft
- generate or update eval cases from plain English
- export the draft eval set as JSON
- inspect parameter coverage
- compare saved current vs improved Promptfoo results
- see case-level before/after output changes

## Run

From this folder:

```bash
cd evals/web
npm test
npm start
```

Open:

```text
http://127.0.0.1:4174
```

No tutor-system dev server is required.

## Data source

The saved before/after comparison is migrated from:

- `evals/promptfoo/results/latest.json`
- `evals/promptfoo/prompts/current.prompt.txt`
- `evals/promptfoo/prompts/improved.prompt.txt`
- `evals/promptfoo/cases/account-security-alert.yaml`
- `evals/promptfoo/fixtures/seed-config.json`

The browser seed is stored at:

- `evals/web/src/evalWorkspaceSeed.js`

## Important limitation

The `Draft prompt impact` panel is a local deterministic heuristic preview for immediate feedback. It is not a live model or Promptfoo run. Real Promptfoo evaluation still requires the CLI and provider credentials.
