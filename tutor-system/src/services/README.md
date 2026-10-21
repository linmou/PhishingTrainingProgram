# Service configuration

<!-- Intent: locate maintained scenario targets, AI configuration and their verification. Updated: 2026-10-21. Baseline commit: a6c977b. -->

`detectionTemplates.ts` defines five targets per teaching scenario in one inventory.
`demoRoomTemplates.ts` packages teaching and demo rooms; `checklistGenerationContext.ts`
reads saved inventories; `llmExtractionService.ts` extracts the same single-list contract.

See [AI service configuration](../../docs/aiService.md#scenario-templates) for the
target contract and [release evidence](../../docs/doc_update_record/documentation_update_record_v2026_10_15_unified_learning_targets.md)
for verification and deployment status.

`prompts/activeTutorAgentPrompt.ts` supplies full candidate11. Tutor requests use
temperature0.3, max_tokens600 and thinking disabled. `aiModels.ts` declares
Qwen3.8 Flash for React and ai-api; assessment-api retains Qwen3.5. See the
[candidate11 release record](../../docs/doc_update_record/documentation_update_record_v2026_10_15_candidate11_qwen38_conditional_release.md)
for evaluation limitations and staging/production verification status.

`cyberbullyingScenarios.ts` maps the pinned situations into room/template data.
`aiService.ts` dispatches from the stored practice type; Cyberbullying proposals
use the existing ai-api and tutor approval path. Shared Guard state uses a boolean.
See [Cyberbullying practise](../../docs/cyberbullying-practise.md) for the five
targets, role identities, progress analysis and operation boundaries.

`simplifiedAIContext.ts` reads the complete saved discussion and trusted assessment
results. It filters malformed or empty legacy template posts before their five-post
limit, retaining valid later entries. Jest covers the paginated history, assessment
readiness, and legacy post normalization at the Supabase boundary.
