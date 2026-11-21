# Retired implementation references

Intent: preserve historical AI source provenance while making the supported application path unambiguous.

Updated: 2026-11-08. Source baseline: `a69b836b7a46d801beb8139415691f4cb3b494ae`.

The supported runtime path is `src/services/aiService.ts` →
`src/services/simplifiedAIContext.ts`. The `.ts.txt` files here are source
references, outside the TypeScript `src` compilation scope and unavailable for
application imports. They do not define a supported alternate API.

| Former source | Observed consumers and decision |
| --- | --- |
| `src/services/aiService.original.ts` | No executable application, script, Edge or Cloud Function consumer found. Preserve its bytes here for the Phase 0 provenance references in `ecologicalTutorCall.ts` and `user_feedback_improvement_summary.{md,txt}`. The Edge-boundary test reads this new path. |
| `src/services/aiContextBuilder.ts` | Only executable consumer was `enhancedContextIntegration.test.ts`. Retire its cached `ai_conversation_contexts` path; that existing test file now exercises the supported context builder against room/message data. Preserve the old source here for inspection. |
| `src/hooks/useRoomFeatures.ts` | No importing consumer found. Retire the unused wrapper; preserve its text here. Its only lifecycle/health dependencies were log-only `RoomFeaturesService.initializeRoom` / `cleanupRoom` and constant `getServiceHealth`; those methods are retired too. |

`RoomFeaturesService.checklist` remains the application facade used by
`useChecklist` and `ChecklistPanel`, including creation, refresh, item updates,
and custom areas. The existing `ai` and `coverage` service exports also remain.
The unrelated browser-test cleanup helpers named `cleanupRoom` remain owned by
the browser harness.

The caller inventory covered tracked application sources, tests, scripts,
Supabase/Edge and Cloud Function sources, package manifests, and current docs.
`tutor-system/package.json` marks the app `private: true` and has no package
`exports`, `main`, or `types` entrypoint; no external API commitment or concrete
future consumer is documented. This supports retiring internal modules in this
application. It does not prove arbitrary unpublished external consumers are
absent. The old sources remain recoverable here and in Git.

Historical evaluation sources, run directories, IDs, prompt snapshots and
user-feedback summaries retain their original identities and text. A historical
reference to either old AI filename resolves to the same-named `.ts.txt` source
here or to that run's own frozen snapshot. This move does not replace any frozen
evaluation source with current runtime code.

The two AI source references are byte-identical to their baseline Git blobs:

| Source reference | SHA-256 | Baseline Git blob |
| --- | --- | --- |
| `aiService.original.ts.txt` | `3ce30bd2d3d99883f9e0f958413c9c4269a2ccf76bb72e333c0f898378270d30` | `02d3800c80db38f3883b5e0e46424168f8f2950e` |
| `aiContextBuilder.ts.txt` | `1e8ca7558d4187aa12678bb89cf45d20495a3e0f5ea61abcf6a212e4f1b4d072` | `699923e68a012c51d5d96e87ef169d04bad16bc7` |

`useRoomFeatures.ts.txt` preserves the unused wrapper with a final newline added.
Verification and delivery status are recorded in the
[dated update record](../../docs/doc_update_record/documentation_update_record_v2026_11_08_retired_implementations.md).
