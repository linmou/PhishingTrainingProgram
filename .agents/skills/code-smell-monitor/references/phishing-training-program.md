# PhishingTrainingProgram profile

Use the current checkout's `AGENTS.md`, `tutor-system/AGENTS.md`, package manifests and runtime configuration as authority. This profile was refreshed on 2026-11-21 against `origin/no_sign_up` at `244b56f`. The PR branch predates that application state; scan the candidate actually under review and record its commit. Do not use an old report as current evidence.

## Analysis boundaries

| Boundary | Roots and entrypoints | Tools and interpretation |
| --- | --- | --- |
| Browser | `tutor-system/src/index.tsx`, React 18, CRA 5, TypeScript 4.9 | Run from `tutor-system`, scoped to `src` or touched files. Use its CRA ESLint config and local TypeScript. Compare normal and production Knip; recognize CRA/Jest/BDD and dynamic imports before classifying unused candidates. |
| Edge | `tutor-system/supabase/functions/`, shared Deno modules, `tutor-system/deno.json` | Inventory actual function entrypoints. CRA `tsc` and browser reachability do not cover Deno runtime entrypoints. Explicit `.ts` imports and cross-boundary shared code are intentional; unresolved compiler-API edges are partial graph coverage, not proof of dead code. Use available Deno checks separately, record configuration and cache/network requirements. Never change imports just to appease the analyzer. |
| Firebase | `tutor-system/functions/package.json`, `src/index.ts`, generated `lib/` | Separate Node/TypeScript package and dependency audit. Scope to `src`; exclude generated `lib` from implementation counts. Use local `tsc --noEmit` for analysis; the build emits files. Do not infer that this package is active in production from its presence alone. |
| Repository tooling | `scripts/`, `.github/scripts/`, `tutor-system/scripts/`, evaluation runners | Node scripts, Python helpers and workflow entrypoints are separate consumers. Frontend-only Knip cannot establish their absence. Exclude vendored skills, frozen evaluation output and generated reports from application duplication counts. |
| Database | `tutor-system/supabase/migrations/` and deployed SQL/RPC/RLS | Generic JS/Python monitoring does not validate SQL semantics or RLS. Mark this coverage unavailable in the combined assessment unless separately checked. Live schema truth comes from target-project Supabase MCP. Follow the release workflow for any resulting server change. |

Discover additional packages such as evaluation/reviewer apps from their own manifests when the requested scope includes them. Do not label one frontend scan repository-wide coverage.

## Typical local pass

From the repository root, in a credential-free sandbox with dependencies already installed:

```bash
python3 .agents/skills/code-smell-monitor/scripts/code_smell_monitor.py \
  --repo tutor-system --scope src --install never --allow-project-execution \
  --out /tmp/ptp-smells-frontend
```

For Firebase changes, repeat with `--repo tutor-system/functions --scope src` and a separate output directory. Add `--architecture` only for a requested coupling/ownership review. Inspect each report's detector status and effective scope; dependency, type and graph checks may be package-wide even for a source-file scope. Optional tools absent from the environment remain unavailable; do not fetch arbitrary latest analyzers to obtain a green result.

Without `--allow-project-execution`, the monitor intentionally emits incomplete coverage and does not execute project plugins, package scripts, local binaries or architecture adapters. It can run an externally installed Gitleaks; raw security evidence belongs in private local output, with redaction preserved.

## Known interpretation traps

- Full TypeScript diagnostics historically include existing test/fixture errors (#89). Report the actual diagnostics and compare the same toolchain/scope against the base; a CRA build is not a clean full-typecheck result.
- `depcheck` output and Knip framework entrypoints need validation (#92). A parseable result with an unsupported exit code remains a tool failure until its semantics are verified.
- Import cycles (#91) require separating type-only edges from runtime edges. Supabase service facades, identity helpers and assessment orchestration are sensitive boundaries.
- A second checklist/AI implementation, repeated room query or React timer allocation is a candidate. Validate executable consumers, freshness/recovery needs, seat identity and persisted target semantics before proposing removal. Do not delete tests merely to silence production reachability results.
- Historical vulnerability counts and scanner candidates (#90/#94) do not establish current exposure. Refresh evidence and distinguish browser bundles, server runtime and development tools; do not publish candidate credentials.
- A focused scan's `coverage.complete` describes its supported detectors, not Edge, SQL, browser correctness or release acceptance. Preserve those limitations in the final report.

No Docker, Supabase CLI operation that may start Docker, live fixture mutation, deployment, LLM evaluation call or production `.env` loading is part of this monitor pass. Use repository release and coordination procedures if a later repair needs those actions.

## Local maintenance

The engine and regression fixtures are vendored from the installed shared skill refreshed 2026-11-09. Local differences are the default `--install never`, explicit execution opt-in, external-Gitleaks path check, compatibility summary fields, and this profile. Preserve those differences when refreshing the engine. The shared skill's invocation contract is not exposed here: this local CLI adds a mandatory execution decision for active scans.
