--!/usr/bin/env psql
-- Purpose: inspect staging provider validation results for the dedicated browser room.
SELECT attempt_ordinal, validation_outcome, error_code, finish_reason,
  raw_response->'choices'->0->'message'->>'content' AS candidate
FROM private.transfer_provider_attempts
WHERE room_id = '92081ace-7370-4fbf-bbb4-39aa10bf7f73'
ORDER BY created_at DESC, attempt_ordinal DESC
LIMIT 8;
