# AI Suggestion Tracking Implementation

## Overview
This implementation modifies the AI assistant to only provide suggestions (not create posts) and tracks how tutors interact with these suggestions.

## Key Changes

### 1. Database Schema
A new table `ai_suggestion_feedback` has been created to track tutor interactions with AI suggestions:

```sql
-- Run this migration in Supabase SQL Editor
-- File: supabase/migrations/004_ai_suggestion_feedback.sql

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

### 2. AI Behavior Changes
- **No more AI posts**: AI no longer creates messages in the chat
- **Suggestions only**: AI provides suggested responses that tutors can:
  - **Accept**: Copy the suggestion exactly as-is
  - **Reject**: Explicitly dismiss the suggestion
  - **Modify**: Use the suggestion but change it before sending
  - **Ignore**: Generate a new suggestion without using the previous one

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
   - Copy and run the contents of `supabase/migrations/004_ai_suggestion_feedback.sql`
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
   - The suggested response
   - Copy and Reject buttons
4. Tutor can:
   - Copy the suggestion to the input field
   - Reject it explicitly
   - Modify it before sending
   - Generate a new suggestion

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