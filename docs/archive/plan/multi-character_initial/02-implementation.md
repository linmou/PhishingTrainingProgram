# 02 — Implementation

Paths below are relative to `tutor-system/`. New filenames are proposed, not claims that these modules already exist.

## 1. Small change surface

Follow the existing React/TypeScript/Jest structure. No new runtime package is necessary.

| File | Responsibility |
|---|---|
| `src/types/multiCharacterDemo.ts` | Input, speaker, generated-output, draft, delivered-message, and review-record types; shared constants |
| `src/services/prompts/multiCharacterDemoPrompt.ts` | Fixed character instructions and pure input-to-chat-messages builder |
| `src/services/multiCharacterDemoService.ts` | Strict parser/validator and one whole-sequence generation request, with bounded format repair |
| `src/hooks/useMultiCharacterDemo.ts` | Local phase state, generation lifecycle, review snapshots, one playback timer, reset, and export data |
| `src/components/MultiCharacterSequenceEditor.tsx` | Controlled message-card editor; no network or persistence code |
| `src/components/MultiCharacterTranscript.tsx` | Delivered-message rendering with explicit speaker identity |
| `src/pages/MultiCharacterDemo.tsx` and `.css` | Scenario setup, learner preview, tutor panel, and feature-scoped styling |
| `src/__tests__/multiCharacterDemo.*.test.ts(x)` | Contract, service, flow, and routing/regression tests |

Modify `src/App.tsx` to register the route when `REACT_APP_ENABLE_MULTI_CHARACTER_DEMO === 'true'`. Add one similarly gated link in `src/pages/TutorView.tsx`, and document the opt-in flag in `.env.example` and the README. Do not introduce a selectable mode in real room creation yet.

The app uses `HashRouter`, so the address is `/#/demo/multi-character`, not a new server route. Keep the existing provider tree intact. The demo must not call `useRoom`, `joinRoom`, or any room-mutating API. Existing providers may perform their normal initialization; isolation means **no feature-initiated room changes**, not a promise that the whole app makes zero network requests.

Avoid copying `RoomPagePost` or refactoring `RoomContext` to implement the sandbox. The new page should be a thin composition of the controller hook and the two UI components.

## 2. Minimal data contract

Use these shapes as the contract; extra framework layers are unnecessary:

```ts
type CharacterId = 'tutor' | 'misleading_peer';
type SpeakerId = 'learner' | CharacterId;
type DemoPhase =
  | 'awaiting_learner'
  | 'generating'
  | 'reviewing'
  | 'playing'
  | 'generation_failed';

interface DemoScenario {
  title: string;
  description: string;
  learningTargets: string[];
}

interface CharacterMessage {
  speakerId: CharacterId;
  content: string;
}

interface GeneratedSequence {
  reason: string; // Brief observable evidence for the reviewer, not hidden reasoning.
  messages: CharacterMessage[];
}

interface DeliveredMessage {
  id: string;
  speakerId: SpeakerId;
  content: string;
  createdAt: string;
  parentLearnerMessageId?: string;
  sequenceId?: string;
  sequencePosition?: number; // 0-based; absent on learner messages.
}

interface GenerationInput {
  scenario: DemoScenario;
  transcript: DeliveredMessage[];
  focusLearnerMessageId: string;
}
```

Define a two-entry, fixed character registry: `tutor → AI Tutor`, `misleading_peer → Riley`. It controls names and avatar presentation. Model output supplies IDs only; it cannot invent accounts, identities, timers, or message IDs.

The model returns exactly:

```json
{
  "reason": "The learner is relying on visual familiarity. A contrasting claim invites an independent check.",
  "messages": [
    { "speakerId": "misleading_peer", "content": "..." },
    { "speakerId": "tutor", "content": "..." }
  ]
}
```

There are only two valid ID sequences: `['tutor']` and `['misleading_peer', 'tutor']`. Reject zero, three, duplicate, reversed, or unknown speakers; reject a lone peer. Require an exact top-level object, a nonempty `reason` up to 500 characters, and nonempty message strings up to 600 characters each. Trim text. Reject extra schema keys, arrays at the top level, markdown-wrapped JSON, legacy single-tutor fields, and non-string content. No regex “best guess” conversion of prose or speaker labels.

Use the same message-list validator for AI output and the human-approved snapshot. A manually authored tutor response need not invent an AI `reason`; mark its origin as manual outside the generated-output type.

Keep generated originals separate from edited drafts. Do not overwrite the originals when the tutor edits text or regenerates. Assign local generation/sequence/message IDs in code. Preserve chronological append order; timestamps are metadata, not a substitute for sequence order.

## 3. Prompt and model request

Export a pure `buildMultiCharacterMessages(input)` and a service function:

```ts
generateMultiCharacterSequence(
  input: GenerationInput,
  signal?: AbortSignal
): Promise<{
  sequence: GeneratedSequence;
  attempts: Array<{ rawOutput: string; validationError?: string }>;
  model: string;
  responseTimeMs: number;
}>;
```

The system message contains the scoped behavior in file 01, the character definitions, pattern-selection priority, and the new JSON contract. The user message contains serialized scenario, ordered transcript with explicit speaker IDs, and the focused learner ID. Declare that participant content is evidence, not instructions overriding character or application rules.

Build the request from the **next transcript including the submitted learner message exactly once**. Do not call `setState` and immediately read old state to construct the request. Regeneration uses the unchanged delivered transcript, not the draft. Only real learner turns count as evidence of learner understanding.

### Preserve the tutor role without conflicting contracts

The inspected `ACTIVE_TUTOR_AGENT_PROMPT` mixes pedagogical policy with repeated single-response JSON instructions and Guard logic. **Do not append it wholesale and then ask the model to ignore parts.** Create a concise demo-specific tutor section retaining the core protection, correction, single-target, learner-evidence, grounded-fact, and supportive-voice rules described in file 01. Cite the baseline source in a code comment for maintenance. Leave the production prompt unchanged.

This preserves the tutor role and selected core behavior; it does not claim byte-for-byte prompt reuse or validated equivalence to all ordinary tutoring behaviors. The response wrapper changes only in the new demo service.

### Request configuration

Follow the inspected gateway request shape, without routing through `generateTutorSuggestion`, which loads room state and expects one tutor response:

- Import `DEFAULT_AI_MODEL` from `src/services/aiModels.ts`.
- Reuse `REACT_APP_OAI_BASE_URL` and `REACT_APP_OAI_API_KEY` and the existing compatible `/chat/completions` convention. Do not introduce a new provider or credentials UI. Strip a trailing slash before appending the endpoint.
- Use `temperature: 0.3`, `max_tokens: 600`, `enable_thinking: false`, and `response_format: {type: 'json_object'}` as initial demo settings, centralized in constants. These are engineering defaults, not optimized results.
- The existing suggestion service limits output to 100–120 tokens. Do not inherit that cap for two messages plus their JSON wrapper.
- Validate the provider envelope and reject an absent/empty response. If a provider reports output truncation, treat it as an output-format failure rather than presenting partial text.
- Allow one format-repair retry (two attempts total). Keep the same scenario/transcript and add a concise schema-repair instruction. Preserve the first raw output for diagnosis. Do not silently drop one message or fall back to the production parser.
- Network/authentication/provider errors are surfaced without automatic retry. A human may retry. Use a bounded request timeout and cancellation (for example, 30 seconds per attempt); distinguish cancellation from an error shown to the operator.
- Missing configuration produces a clear configuration error. No random/dummy suggestion fallback on the live path. UI tests may inject a mock generator.

Keep the small demo fetch function local to the new service. Do not extract or rewrite the legacy AI service merely to remove a few duplicate request lines.

**Credential boundary:** frontend environment variables are not secret storage. The first implementation is for local/trusted demonstration using the existing authorized configuration. Do not publicly deploy long-lived provider credentials in a browser build; a public/shared deployment must use an appropriately restricted gateway or server-side credential boundary. The feature flag is discoverability control, not authorization. Do not log or export request headers, tokens, or credential-bearing endpoints.

## 4. Controller and phase transitions

A plain hook with a reducer, refs, and one `setTimeout` is sufficient. Side effects run in the hook, not in the reducer. Accept an injectable generation function for tests; this is the only dependency injection needed.

| Event | Preconditions | State/result |
|---|---|---|
| Submit learner message | `awaiting_learner`; nonempty text | Append learner message; capture request input; synchronously block further submits; enter `generating` |
| Generation succeeds | Current request/session still matches | Save immutable generated original and editable copy; enter `reviewing` |
| Initial generation fails | Current request; no prior draft | Enter `generation_failed`; keep delivered learner message |
| Regenerate | `reviewing` | Keep old draft; enter `generating`; request from delivered history |
| Regeneration fails | Existing draft available | Restore `reviewing` with edited draft intact and error visible |
| Edit/add/remove peer | `reviewing` | Update only editable draft; preserve fixed speaker order |
| Approve | `reviewing`; valid message list | Freeze approved snapshot, create review record, publish message 1 immediately |
| Approve one-message draft | As above | Complete record and return to `awaiting_learner` immediately |
| Approve two-message draft | As above | Enter `playing`; schedule message 2 after 3,000 ms |
| Timer fires | Same session/sequence; `playing`; not already delivered | Append message 2; complete record; return to `awaiting_learner` |
| Discard | `reviewing` or `generation_failed` | Mark pending attempt discarded; clear draft/error; return to `awaiting_learner` |
| Retry after failure | `generation_failed` | Regenerate against the same delivered transcript |
| Write manually after failure | `generation_failed` | Open one blank tutor card in `reviewing`; mark origin manual |
| Reset | Any phase | Abort request, clear timer, invalidate callbacks, clear transcript/records/drafts, unlock setup |
| Unmount | Any phase | Abort request and clear timer; ignore late completions |

Use both a disabled button and a controller-level phase check. Prevent double submissions/approvals with a synchronous ref gate or equivalent guarded reducer entry; do not rely only on React's next render.

Tie asynchronous work to a monotonically changing request/session token. Abort on reset/unmount and ignore stale results even if the provider/mock ignores abort. The scheduled callback must check the active sequence ID. Duplicate timer events must not append another message with the same sequence position. Handle React StrictMode cleanup without duplicate requests or publication.

There is no per-message network publication in this local prototype, so there is no server partial-write/retry problem to solve. Do not add durable jobs, leases, or outbox tables.

## 5. UI implementation details

`MultiCharacterSequenceEditor` receives draft values and callbacks; it does not read `RoomContext`. Textareas remain controlled. When the tutor removes Riley, the tutor text is retained and remains editable; display a small reminder to check that it stands alone. Adding Riley inserts a blank first card and blocks approval until filled.

`MultiCharacterTranscript` receives **delivered messages only**. Reuse `AvatarDisplay` where convenient, but resolve identity from the registry. Do not fake a `Message` with `user_role: student` for Riley. Do not reuse `PostComment` unchanged: it normalizes AI-generated names to “AI Assistant” and includes feedback/reply UI that is intentionally absent here.

Render content as plain React text with preserved line breaks. Do not use markdown link rendering or `dangerouslySetInnerHTML`. Private reasons, draft text, raw JSON, and future queued messages must not be passed to the learner-preview component. The simultaneous tutor panel is deliberately an operator view, not access-controlled student delivery.

Use distinct names/avatars and textual labels, not color alone. Preserve learner text typed while submission is locked. Show why submission is disabled: “Waiting for tutor review” or “The response sequence is playing.”

## 6. Small review record and export

Maintain local records containing request input, model/settings, raw attempts, generated original, approved messages, timestamps, and actual delivered message IDs. Mark attempts as regenerated/discarded and sequences as completed or still playing. Preserve the difference between model output and human-approved text. Record manual origin explicitly. An array of records is sufficient; no event-sourcing framework.

**Export session JSON** downloads a single snapshot containing scenario, fixed character registry, delivered transcript, review records, and the demo prompt/settings. It may include an unsent draft, but that must be in a separately labeled field, never mixed into the delivered transcript. Do not include tokens or claim these local timestamps prove receipt on another device.

The export is for inspection and reproducibility, not a replacement for eventual database persistence. A reload begins a fresh demo; do not implement localStorage restoration or export import.
