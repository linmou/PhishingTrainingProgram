# Service configuration

<!-- Intent: locate maintained scenario targets, AI configuration and their verification. Updated: 2026-11-12. Baseline commit: e665cfd. -->

The supported tutor/context path is `aiService.ts` → `simplifiedAIContext.ts`,
with transport through the `ai-api` Edge Function. The application is private;
its internal source modules are not a published package API. Retired alternatives
are preserved as source references outside `src` in
[`reference/legacy-ai`](../../reference/legacy-ai/README.md), with their consumer
inventory and historical hashes. Existing evaluation run snapshots stay frozen.

Room components use `useChecklist` directly and retain the live
`RoomFeaturesService.checklist` facade. Components and hooks own their subscriptions
and cleanup; the service facade does not expose lifecycle or health checks.

`detectionTemplates.ts` defines the complete learning-point text directly from
`General Learning Goals.docx`, with its source hash, for the six teaching
scenarios: four points each for home-location
and movie-meetup rooms, five for the others. The generic `General Scam Indicators`
fallback retains its five points. Cyberbullying uses the document's five shared
points in document order, with versioned persisted inventories.
`demoRoomTemplates.ts` packages teaching and demo rooms; `checklistGenerationContext.ts`
reads saved inventories; `llmExtractionService.ts` extracts the same single-list contract.

See [AI service configuration](../../docs/aiService.md#scenario-templates) for the
target contract and [release evidence](../../docs/doc_update_record/documentation_update_record_v2026_11_12_document_learning_targets.md)
for verification and deployment status.

`prompts/activeTutorAgentPrompt.ts` supplies full candidate11. Tutor requests use
temperature0.3, max_tokens600 and thinking disabled. `aiModels.ts` declares
Qwen3.8 Flash for React and ai-api; assessment-api retains Qwen3.5. See the
[candidate11 release record](../../docs/doc_update_record/documentation_update_record_v2026_10_15_candidate11_qwen38_conditional_release.md)
for evaluation limitations and staging/production verification status.

`aiService.ts` dispatches from the stored practice type; Cyberbullying proposals
use the existing ai-api and tutor approval path. Shared Guard state uses a boolean.
See [Cyberbullying practise](../../docs/cyberbullying-practise.md) for the five
targets, role identities, progress analysis and operation boundaries.

`simplifiedAIContext.ts` reads the complete saved discussion and trusted assessment
results. It filters malformed or empty legacy template posts before their five-post
limit, retaining valid later entries. Jest covers the paginated history, assessment
readiness, and legacy post normalization at the Supabase boundary.
