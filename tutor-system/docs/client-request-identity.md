# Client request identity and idempotency

Assessment requests obtain the current tab identity immediately before sending. Analysis callbacks do not override that identity. The default transport loads Supabase lazily, so importing the service does not initialize a client or require environment variables. Tests may inject the identity getter or an API port.

| Operation | Idempotency key | Lifetime |
| --- | --- | --- |
| Learner `post_message` | Action-owned `request_id` | Retained across retries until response, realtime or catch-up confirms storage |
| `join_room` | `visit_key` | One entry/rejoin visit; StrictMode reuses the key |
| Checklist `add_item` | Client `itemId` | Same item across repeated synchronization |
| Reviewed delivery and other assessment operations | Fresh `request_id` | Each call; do not reuse an edited delivery's key |

All keys use `src/utils/requestId.ts`. Request keys are distinct from identity and never authorize a request. A failed join does not fall back to writing sessions directly.
