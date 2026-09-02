# AI Suggestion Tracking Implementation

> Intent: Document how AI suggestions are displayed, transferred to the composer, and tracked after the Guard Mode UI update.
> Updated: 2026-09-02
> Commit ID: pending at update time

## Overview
This implementation modifies the AI assistant to only provide suggestions (not create posts), tracks how tutors interact with these suggestions, and records the Guard Mode decision separately from the reviewed wording.

## Key Changes

### 1. Database Schema
The `ai_suggestion_feedback` table tracks tutor interactions with AI suggestions. The canonical current migration is `023_guard_mode.sql`; the earlier `004_ai_suggestion_feedback.sql` definition is retained below as historical context:

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

Guard Mode uses `supabase/migrations/023_guard_mode.sql`. It adds `raw_mode`, `mode_reason`, `final_mode`, and `mode_rectified`, stores `response_mode` on messages, and makes a reviewed send atomic. Pre-populated suggestions may have a null parent message; ordinary generated suggestions continue to link to their parent when one exists.

### 2. AI Behavior Changes
- **No more AI posts**: AI no longer creates messages in the chat
- **Suggestions only**: AI provides suggested responses that tutors can:
  - **Accept**: Copy the display-only suggestion exactly as-is into the composer
  - **Reject**: Explicitly dismiss the suggestion
  - **Modify**: Edit the copied suggestion in the composer before sending
  - **Ignore**: Generate a new suggestion without using the previous one
- **Structured decision**: Each usable generation returns `mode`, `mode_reason`, and `suggested_response`; malformed decisions are surfaced as errors
- **Guard authority**: Guard activation is controlled at the room level. The AI suggestion card does not display internal reasoning or a final-mode selector.

### 3. Tracking Features
- Records which student message the AI is responding to
- Tracks the time between showing a suggestion and the tutor's action
- Stores the tutor's final response for comparison
- Maintains context of which messages were used to generate the suggestion

### 4. Export Functionality
The download feature now supports two formats:

#### TXT Format
- Includes all messages in chronological order
- Adds AI interaction summary at the end
- Shows acceptance/rejection rates

#### JSON Format
- Complete structured data export
- Includes all messages with metadata
- Full AI interaction history
- Summary statistics

## How to Apply the Migration

1. **In Supabase Dashboard**:
   - Go to SQL Editor
   - Copy and run the contents of `supabase/migrations/023_guard_mode.sql`
   - Verify the table was created successfully

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

When Guard Mode is active for a tutor, the composer profile switches to the `Security Supervisor` identity. The AI card continues to show only the response content; internal AI reasoning and mode metadata remain non-visual. A successful reviewed send persists the resolved response mode and updates the room authority. Failed sends retain the editable composer draft.

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
