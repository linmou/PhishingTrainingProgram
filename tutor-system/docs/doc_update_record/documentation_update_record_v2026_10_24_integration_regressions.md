# Integrated Regression Fixture Update

Intent: record fixture repairs and focused evidence for the combined open-issues candidate.

Date: 2026-10-24. Source baseline: `79496b6`. Scope: test fixtures and test documentation.

## Changes

Message-read fixtures preserve the Supabase query builder through the bounded page limit and abort signal. Existing message, export, AI, transfer, password, and room assertions remain in place. The chat BDD fixture supplies the student join boundary and the batched feedback API used by the integrated application, retaining the actual public DTO exports.

Offline unit and BDD scenarios drive subscription failure, observe the failed reconciliation, advance the five-second recovery timer, and observe another failed read. They require the missed message to remain absent while disconnected and appear after `SUBSCRIBED` catch-up.

## Verification

Local single-worker run with inert Supabase initialization values; service boundaries are mocked and no live environment is accessed:

```sh
rtk proxy env REACT_APP_SUPABASE_URL=https://test.supabase.co REACT_APP_SUPABASE_ANON_KEY=test-key npm test -- --watchAll=false --runInBand --silent --runTestsByPath src/__tests__/real_time_chat.test.tsx src/__tests__/real_time_chat.bdd.test.tsx src/__tests__/ai_suggestion_tracking.bdd.test.tsx src/__tests__/ai_assistant.bdd.test.tsx src/__tests__/room_management.bdd.test.tsx src/__tests__/room_op_configuration.bdd.test.tsx src/__tests__/room_op_configuration.test.tsx src/__tests__/room_password_protection.test.tsx src/__tests__/chat_history_download.bdd.test.tsx src/__tests__/transfer_assessment.bdd.test.tsx
```

Result: 10 suites passed, 118 tests passed. Log: `/tmp/integration-regressions-jest.log`. After adding explicit disconnected-message absence assertions, the two chat suites passed again (24 tests); log: `/tmp/integration-chat-final-jest.log`. The release owner runs the full combined regression after integration. No deployment or fixture cleanup is required for this test-only change.
