# AI Suggestion Tracking Implementation

> Intent: Document how AI suggestions are displayed, transferred to the composer, and tracked after the Guard Mode UI update.
> Updated: 2026-09-13
> Commit ID: `31cf4e4`

## Overview
This implementation modifies the AI assistant to only provide suggestions (not create posts), tracks how tutors interact with these suggestions, and records the Guard Mode decision separately from the reviewed wording.

## Key Changes

### 1. Database Schema
The `ai_suggestion_feedback` table tracks tutor interactions with AI suggestions. The canonical current migrations are `023_guard_mode.sql` and `024_raw_instruction.sql`; the earlier `004_ai_suggestion_feedback.sql` definition is retained below as historical context:

```sql
-- Run this migration in Supabase SQL Editor
-- Historical file: supabase/migrations/004_ai_suggestion_feedback.sql

CREATE TABLE IF NOT EXISTS ai_suggestion_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) NOT NULL,
    tutor_id UUID REFERENCES users(id) NOT NULL,
    parent_message_id UUID REFERENCES messages(id) NOT NULL,
    ai_suggestion TEXT NOT NULL,
    tutor_action TEXT CHECK (tutor_action IN ('accepted', 'rejected', 'modified', 'ignored')) NOT NULL,
    tutor_final_response TEXT,
    tutor_message_id UUID REFERENCES messages(id),
    response_time_ms INTEGER,
    context_messages JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes and RLS policies
-- See full migration file for complete SQL
```

Guard Mode uses `supabase/migrations/023_guard_mode.sql`. Migration `024_raw_instruction.sql` adds constrained nullable `raw_instruction`, drops the obsolete reviewed-send RPC signature, and creates the new signature with `p_raw_instruction`. A null instruction is allowed only for Guard; Guard may still carry one of the five contract labels, while tutoring requires one. Existing rows remain null without speculative backfill.

### 2. AI Behavior Changes
- **No more AI posts**: AI no longer creates messages in the chat
- **Suggestions only**: AI provides suggested responses that tutors can:
  - **Accept**: Copy the display-only suggestion exactly as-is into the composer
  - **Reject**: Explicitly dismiss the suggestion
  - **Modify**: Edit the copied suggestion in the composer before sending
  - **Ignore**: Generate a new suggestion without using the previous one
- **Structured decision**: Candidate 11 returns `reason`, nested `decision.mode` / `decision.instruction`, and `response`; malformed decisions are surfaced as errors. The product adapter maps these to the existing `mode`, `mode_reason`, and `suggested_response` review/persistence fields.
- **Guard authority**: The suggestion-card toggle edits the pending reviewed mode; the header toggle is the confirmed room-level manual override. Internal reason/instruction labels are not shown to learners.

### 3. Tracking Features
- Records which student message the AI is responding to
- Tracks the time between showing a suggestion and the tutor's action
- Stores the tutor's final response for comparison
- Maintains context of which messages were used to generate the suggestion
- Preserves the model's raw instructional decision for accepted, modified, rejected, and ignored suggestions

### 4. Export Functionality
The download feature now supports two formats:

#### TXT Format
- Includes all messages in chronological order
- Adds AI interaction summary at the end
- Shows acceptance/rejection rates
- Tutor exports include raw mode, raw instruction, concise reason, final mode, and whether the tutor changed the mode

#### JSON Format
- Complete structured data export
- Includes all messages with metadata
- Full AI interaction history
- Summary statistics

## How to Apply the Migration

1. **Against a configured Supabase endpoint**:
   - Apply migrations through `024_raw_instruction.sql`
   - Verify the old RPC overload is absent and the new 12-argument signature is callable
   - Hosted test-room/template writes are permitted for the browser evaluation when explicitly authorized; hosted schema migration still requires separate authorization

2. **Test the Features**:
   - Login as a tutor
   - Enable AI assistant in room settings
   - Have a student send a message
   - Click the AI button to generate a suggestion
   - Try different actions (copy, reject, modify)
   - Download chat history in both formats

## User Experience

### For Tutors
1. Student sends a message
2. Tutor clicks the sparkly AI button
3. AI suggestion appears showing:
   - Which message it's responding to
   - The suggested response as display-only text
   - Copy and Reject buttons
4. Tutor can:
   - Copy the suggestion to the input field
   - Edit the copied text in the input field before sending
   - Reject it explicitly
   - Generate a new suggestion
   - Activate or deactivate Guard directly from the AI suggestion card; the control confirms the change and persists the room response mode.

When Guard Mode is active for a tutor, the composer profile switches to the `Security Supervisor` identity. The AI card continues to show only the response content; internal AI reasoning and mode metadata remain non-visual. A successful reviewed send persists the resolved response mode and updates the room authority. Failed sends retain the editable composer draft.

### Transfer Assessment Review

When a prepared transfer assessment is available, the tutor reviews it in the room view instead of using the ordinary suggestion card. The tutor can edit the question, answer text, and selected correct answers, then send it directly. There is no learner preview or separate acknowledgement gate.

The AI-selected `selection_type` is fixed for that draft: `single` renders radio controls and requires one answer; `multiple` renders checkboxes and requires two or three answers. The review surface shows every currently selected correct answer and updates immediately when the tutor changes an answer or its text. A failed send keeps those edits available for retry.

### Data Collection
Every interaction is tracked:
- **Accepted**: Tutor used the exact suggestion
- **Rejected**: Tutor explicitly clicked reject
- **Modified**: Tutor changed the suggestion before sending
- **Ignored**: Tutor generated a new suggestion

## Benefits
1. **Quality Improvement**: Track which suggestions are helpful
2. **Response Time**: Measure how quickly tutors respond with AI help
3. **Modification Patterns**: Understand how tutors adapt suggestions
4. **Export for Analysis**: Download complete interaction data for research

## Technical Details
- Uses simplified auth (no Supabase Auth required)
- RLS policies work with the deterministic user ID system
- Maintains conversation context without creating AI messages
- Real-time tracking with optimistic updates
