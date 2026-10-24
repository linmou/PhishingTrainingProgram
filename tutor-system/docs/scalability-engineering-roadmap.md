# Scalability Engineering Roadmap

> Status: **proposed roadmap, not implemented capacity**. Created 2026-10-24.
> Scope: `tutor-system/` React + TypeScript client, Supabase PostgreSQL/Realtime/Edge Functions, hosted frontend, LLM provider.
> Objective: gain **demonstrable large-system / high-concurrency engineering experience**, while protecting the existing small school deployment. A simulated user is not a real student, and a benchmark result is not evidence of production scale.

## Executive decision

**Do not scale the production database by load-testing it.** First measure the current application against a fully isolated synthetic environment; then improve bottlenecks and rerun identical workloads. Target **1,000 concurrent simulated active sessions** as a stretch *system* experiment, with independent workload limits for real-time connections and LLM inferences. Do not claim 1,000 simultaneous LLM requests or 1,000 real users.

Keep the existing tutor/student room contract (one tutor + one student) unless a product requirement explicitly changes it. Scale by **many independent rooms and principals**, not by placing 1,000 students in one room.

### Current architecture: evidence and hypotheses

| Observed source | Finding | Consequence / hypothesis to test |
| --- | --- | --- |
| [`src/contexts/RoomContext.tsx`](../src/contexts/RoomContext.tsx) | Subscribes to room-filtered Realtime events **and** polls the room's entire ordered message history every **2 seconds** | Read amplification and repeated transfers grow with online rooms and message history. Illustrative upper-order request rate: 1,000 active rooms / 2s = 500 polling queries/s, **not** a measured throughput. |
| [`src/services/supabase.ts`](../src/services/supabase.ts) | Includes full-room ordered message retrieval; message send loads a user profile and inserts a message | Check query plans, indexes, round trips, size limits, and write contention under synthetic load. |
| [`supabase/functions/ai-api/index.ts`](../supabase/functions/ai-api/index.ts) | Awaits external chat-completions provider synchronously and returns a provider error for failed calls | Check provider tail latency, timeouts, 429s, retries, admission control, concurrency, and per-request cost; no durable queue currently demonstrated here. |
| [`src/contexts/AuthContext.tsx`](../src/contexts/AuthContext.tsx), [`docs/browser-e2e-testing.md`](browser-e2e-testing.md) | Application-managed identity from client storage; no Supabase Auth JWT required for existing browser flows | **Security/authorization risk** before exposing more users; synthetic traffic must not impersonate existing identities. Load-tested throughput cannot imply strong authentication. |
| [`docs/agent-coordination.md`](agent-coordination.md) | Cross-machine Staging lease protects shared fixtures and deployment changes | Continue to honor lease for mutations to shared Staging, but **dedicated load-test infra must not share the Staging DB, keys, fixtures, or lease**. |
| [`docs/supabase-release-workflow.md`](supabase-release-workflow.md) | Explicit change verification and staging-to-production gates | Performance changes still require functional/security checks and exact-artifact release verification. |

These are source-code observations and test hypotheses, not demonstrated performance defects at a measured scale. Do not assume a cache, queue, index, or plan change is beneficial before measuring it.

## Non-negotiable safety and scope

1. **Separate performance lab**: create a *dedicated* Supabase project/database and separate load-generator accounts and keys, synthetic tutor/student identities, rooms, messages, ratings and assessment data. No school user data, screenshots, credentials, production dumps, teacher/students' identities, or production AI provider secrets. No automatic copying of real staging or production data. If schema parity is required, use migration artifacts with synthetic fixtures.
2. **No hosted destructive runs by default**: scripts default to local mock/in-process targets. Target allowlist, explicit `LOAD_TEST_ACK`, dry-run / budget / max VUs / duration limits, run-unique test namespace, unique confirmation for any permitted hosted target; **hard reject current Staging and Production Supabase project refs and public school frontend origins**, regardless of override flags. Never run load tests through normal PR CI or an automatic production deploy.
3. **Credentials and privacy**: isolate secrets server-side; redact identities and tokens from traces; no secret logging or artifacts; enforce app authorization and tenant/room isolation. A client-chosen UUID or role does not by itself establish identity.
4. **Resource and spend cap**: get approval before paid dedicated infrastructure, real LLM calls, increased provider concurrency or quotas, or any potentially material charges. Start with deterministic mock inference; separately approve a small provider-backed experiment within rate/cost limits.
5. **Stop conditions**: stop immediately on unexpected writes, cross-tenant access, fixture leakage, credential exposure, data corruption, budget breach, error spike, unbounded queues, or target mismatch. Preserve redacted evidence and clean test resources; fail closed if cleanup ownership is ambiguous.
6. **Existing repository rules remain in force**: no Docker per [`AGENTS.md`](../../AGENTS.md); do not bypass shared-Staging lease for normal operations. Do not turn a benchmark into a change of educational behavior, identity semantics, grading, or authorization.

## Success definition and benchmark semantics

Report **concurrent sessions**, **request arrival rate (RPS)**, **successful completions/sec**, **simultaneous open Realtime connections**, **in-flight LLM jobs**, and **real provider tokens/sec** separately. Virtual users do not imply active requests or concurrent token generation.

Before optimizing, agree on per-endpoint SLOs and *why* they matter. The following are **provisional engineering targets only**, to be adjusted after baseline and school usage observations:

| User journey / metric | Initial candidate target (lab) | Measurement |
| --- | --- | --- |
| Room listing / enter / history retrieval | p95 <= 800 ms at chosen workload | Client-observed end-to-end latency excluding initial CDN asset download; >= 95% valid response samples |
| Persist/send learner message | p95 <= 1,000 ms, errors < 1% | Successful durable write and subsequent correct read; reject unauthorized writes |
| Realtime propagation | p95 <= 2 s, no missed or duplicate durable events after reconnect/resync | Timestamped synthetic producer/consumer with sequence IDs |
| Mocked AI tutor request | p95 <= 3 s under constrained model simulator | Latency includes admission/queue wait; no hidden background backlog |
| Assessment and Guard correctness | **zero** observed duplicate awards, cross-room leaks, unauthorized approvals or inconsistent terminal grading | Repeat under contention; invariant assertions, not only HTTP 200 |
| Recovery under overload | bounded queue, 429/503 with retry guidance rather than uncontrolled cascading failures | Spike, soak, abort and recovery tests |
| Cost and work efficiency | publish spend per 1,000 successful workflows and CPU/DB/provider utilization | Cost ledger and resource snapshots, including rejected and retried requests |

Never publish a throughput claim without environment, config, duration, VUs, arrived requests, achieved RPS, sample sizes, percentile calculation, warm-up, data volume, quotas, success conditions and evidence. Distinguish **capacity passing SLOs** from a short peak that merely stayed online.

## Phased plan / milestone issues

Phases are sequential where gates depend on evidence. Independent diagnostic improvements may proceed in separate worktrees, but their combined behavior must be retested before any release.

| Phase | Deliverable | Exit / evidence gate | Dependencies |
| --- | --- | --- | --- |
| **P0 — Threat model and isolation** | Document tenant/identity threats, choose lab deployment and synthetic data factory, target allowlist, budget caps, safe cleanup / negative tests | Demonstrate target rejection for school production and shared staging; prove lab identities cannot access school resources; write/read isolation tests pass | None — blocker for hosted performance testing |
| **P1 — Reproducible measurement** | k6 or equivalent protocol workload; deterministic Mock LLM; scenario manifest; basic metrics dashboard and redacted run reports | Same commit/config repeat runs give explainable distributions; measure baseline at 1/10/50/100 VUs and locate first bottleneck | P0 |
| **P2 — Read and Realtime path** | Quantify full-history 2s polling; prototype incremental cursor/bootstrap + Realtime event reconciliation with reconnect/idle fallback, capped page sizes | Before/after room-history reads, bytes, DB time, stale/missed events under disconnect, reload, concurrent messages; unchanged learning/visibility semantics | P1 |
| **P3 — SQL, transaction and concurrency hardening** | `EXPLAIN (ANALYZE, BUFFERS)` on representative **synthetic** data; index/round-trip/permission review; write contention and race tests | Explain and measure each optimization; no unauthorized access, duplicate progress/grades or lost messages under retries/concurrent requests; migration parity gates pass | P1, P2 as applicable |
| **P4 — LLM admission control and resilience** | Rate-limits per principal/room, global in-flight budget, explicit timeouts, bounded retries with jitter only for safe/idempotent operations, idempotency keys, optional durable jobs + status API | Mock delays/429/5xx/spikes prove bounded concurrency, no double assessment/graded response; small explicitly approved real-provider pilot stays within token/rate/spend budget | P0, P1 |
| **P5 — Capacity and failure demonstration** | Soak/spike/stress/recovery experiments at 100 -> 300 -> 1,000 **simulated sessions** (increase only after gates pass); compare before/after | Publish highest **measured** SLO-passing concurrency, bottleneck and costs; capture cold/warm starts, cleanup, recovered service and failure injection evidence | P2–P4 |
| **P6 — Operationalization / portfolio evidence** | Budgeted, operator-invoked reproducible benchmark recipe and historical dashboard; runbook, rollback, architectural decision records; selected safe production optimizations | Re-run results + operational handoff; no unsafe automated load in CI; production changes pass repository's integration/staging/production release gates | P5 |

### P0 implementation tasks (highest priority)

- [ ] Inventory all write/permission paths: `AuthContext`, room/message APIs, Edge functions, PostgreSQL RLS, learning transitions, assessment key handling. Produce explicit attack matrix for forged role/actor and cross-room access.
- [ ] Decide whether full authenticated identity is required for target educational deployment; do **not** claim that improving synthetic load capacity solves the current identity trust model.
- [ ] Introduce a dedicated synthetic database/project without student data or copied private production rows. Ensure no staging/production service role credentials can be used by the load runner.
- [ ] Specify a fail-closed target policy, run ID, resource budget and ownership cleanup. Include unit tests proving that production and shared Staging URLs/project IDs are rejected.
- [ ] Confirm hosted quotas and test budget before any live experiment; do not assume 1,000 Realtime connections are available on the current tier.

### P1 implementation tasks

- [ ] Define at least four representative **closed-loop** user journeys: enter/load room; read/realtime receive; send/rate; tutor approval / assessment workflow. Use a separate **open-loop** arrival-rate scenario for overload and queue tests, never confuse the two.
- [ ] Record synthetic data distributions (independent rooms, 0/20/200/2,000 message histories; number of connected clients; writes per room; target inventory); fix deterministic seed and dataset version.
- [ ] Build a mock AI endpoint or injectable provider dependency that has fixed delay/error/token-cost profiles and does not use real credentials.
- [ ] Capture latency histograms (p50/p95/p99), error reasons, throughput, read/write/query volume, CPU/memory, DB connections and slow queries, active Realtime channels, rate-limit responses, model in-flight and billed tokens.
- [ ] Store machine-readable run metadata and report with git SHA, env and mock/provider mode, workload seed, quotas, spend estimate, exact target allowlist, fixture cleanup and any omitted metric. Publish *failures* and aborted runs too.

### P2–P4 specific design choices to test, not blindly ship

- Compare Realtime subscription + **full-history polling every 2 seconds** against initial bounded page + event stream + cursor-based reconnection reconciliation and slower safety polling. Preserve message ordering, no dropped updates and private-data projection.
- Use cursor pagination for deep history and measure rate of query and payload growth. Follow existing `simplifiedAIContext` cursor work for chronological AI context; separate the AI prompt-history policy from UI message-history policy.
- Measure `rooms`, `messages(room_id, created_at, id)`, `message_feedback`, room membership and assessment state queries before prescribing indexes. Avoid redundant indexes/write amplification.
- Separate **fast synchronous tutor interactions** from optional **asynchronous, idempotent inference** only if measured queue/timeout pressure warrants it. If introducing queues, require durable state machine `queued -> running -> succeeded|failed|cancelled`, idempotent delivery, lease recovery, backpressure and TTL/cleanup; never silently transform grading semantics.
- Include row-level authorization, per-principal fairness, correlated retry storms and multiple clients in the same room. Tests must detect response duplication and unauthorized data, not merely timing.

## Experiment matrix

| Experiment | Synthetic input | Prove |
| --- | --- | --- |
| **Baseline ramp** | 1, 10, 50, 100 simultaneous active clients; long-lived 5–10 min after warm-up | First SLO failure, client RPS, DB and Realtime footprint |
| **Read amplification** | 20 vs 200 vs 2,000 history rows, constant online users | Full-history polling scaling and benefit of pagination/incremental sync |
| **Realtime fan-out** | Many 1:1 rooms vs a few busy rooms; drop/reconnect | Delivery completeness, duplicate handling, reconnection and resync |
| **Write contention** | Concurrent student send/tutor approve/rating/assessment retries in separate and shared rooms | Idempotency, state-machine invariants, transaction safety |
| **Mock LLM burst** | Arrival-rate bursts with 100–500 ms and 3–10 s synthetic latency; 429/5xx injected | Admission/queue wait, retries, overload and cost ceilings |
| **Soak** | 30–60 min at last SLO-passing measured load | Resource leaks, connection churn, stability; budget-capped |
| **Stress/recovery** | Carefully increase above passing load, then reduce | Fail-safe saturation, no data corruption, recovery time |
| **Stretch** | 300 -> 1,000 simulated concurrent sessions only if quota, cost, privacy and gates pass | Verified maximum under explicit SLOs, not marketing capacity |

Do not run thousands of browsers for protocol metrics: use protocol-level HTTP/WebSocket generation where supported, and a smaller Playwright cohort to validate actual UI rendering, timing and behavior. Count one user only when its session performs the stated journey.

## Release discipline

- **P0/P1 documentation, mock tooling and isolated lab-only tests** should not touch deployed behavior. Put the load tests behind explicit *operator-only* commands and a hard target allowlist.
- Any change to existing Edge, RLS, SQL, auth or frontend uses [Supabase Release Workflow](supabase-release-workflow.md), [Browser E2E](browser-e2e-testing.md) and [Shared Staging Coordination](agent-coordination.md). Respect no-Docker constraints and shared Staging leases. A staging smoke test is not a load test.
- For improvements touching identity/permissions, require adversarial negative tests and affected full lifecycle journeys before staging, and targeted production verification of integrated source; do **not** inject load into production.
- For production rollback, define component and DB compatibility, exact artifact hash, trigger, owner and cleanup evidence. Record before/after performance and regressions, including any negative results.

## Evidence pack / truthful portfolio claims

Keep versioned, redacted reports in a dedicated documentation/results location with:

1. **Problem and hypothesis:** e.g., room-history polling causes O(online rooms × history size) repeated data transfer.
2. **Controlled experiment:** scripts, synthetic fixture generator seed, git SHA, environment size, observed bottleneck, raw measurement summary and costs.
3. **Design trade-offs:** why event reconciliation, indexes, batching, queues or backpressure were/weren't selected.
4. **Before/after:** same data, workload and thresholds; p95/p99, throughput, errors, resource utilization and correctness invariants.
5. **Operational outcome:** recovery behavior, safety stop conditions, production validation/rollback if applicable.

**Permitted résumé statement *after* verification**: “Designed a reproducible load-testing and backpressure framework for a school-deployed LLM tutoring platform; identified and removed unnecessary message polling, documenting before/after throughput and p95 latency under N simulated concurrent sessions.”

Do **not** claim “supported 1,000 production students,” “handled 10,000 RPS,” or “enterprise-grade security” from a planned milestone, mock test or infrastructure diagram.

## Immediate next step

Implement **P0 first**, as separate reviewable tasks: (a) threat/authorization inventory; (b) isolated lab + target denylist; (c) synthetic data factory and cleanup ownership. Only then add **P1** load-generator code. This roadmap makes no production or Staging changes.
