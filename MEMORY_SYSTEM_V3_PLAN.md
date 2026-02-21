# Pause Memory System V3 Implementation Plan

## 1) Goal

Build the highest-trust memory system for Pause so personalization is:
- accurate over time
- safe for emotionally sensitive relationship contexts
- resilient to failures and concurrency
- explainable and user-governable
- performant at scale

Success definition:
- No silent memory-write loss
- No duplicate memory rows from race conditions
- No retrieval of inactive/invalid memories
- Deterministic behavior across language/couple lifecycle edge cases
- Explicit contradiction/supersession handling for outdated facts
- Deterministic pruning/archival so retrieval quality does not decay over time
- End-to-end test coverage across all memory write/read/retrieval pipelines

---

## 2) Complete Current Memory Touchpoint Inventory

### A. Write Pipelines (DB writes)

1. Court/case extraction (background):
- `server/src/lib/courtSessionManager.js`
- `server/src/lib/court/PhaseTransitionController.js`
- `server/src/lib/stenographer.js`

2. Daily questions extraction trigger:
- `server/src/routes/dailyQuestions.js`
- `server/src/lib/stenographer.js`

3. Appreciation extraction trigger:
- `server/src/routes/appreciations.js`
- `server/src/lib/stenographer.js`

4. Memory-caption extraction trigger:
- `server/src/routes/memories.js`
- `server/src/lib/stenographer.js`

5. Raw memory persistence helpers:
- `server/src/lib/supabase.js` (`insertMemory`, `reinforceMemory`)

### B. Read Pipelines (non-RAG reads)

1. Memory APIs:
- `server/src/routes/memory.js`
- `server/src/lib/supabase.js` (`getUserMemories`, `checkUserHasMemories`, `checkMemoriesBySource`)

2. Couple gallery:
- `server/src/routes/memories.js` (`memories`, `memory_reactions`, `memory_comments`)

3. Insights generator memory candidates:
- `server/src/lib/insightService.js` (`from('user_memories')`)

4. Exports + deletion:
- `server/src/lib/dataExportService.js`
- `server/src/routes/account.js`

### C. Retrieval Pipelines (RAG)

1. Judge historical context:
- `server/src/lib/memoryRetrieval.js`
- `server/src/lib/judgeEngine.js`

2. Event planner personalization:
- `server/src/lib/eventPlanner.js`

3. SQL RPC layer:
- `supabase/migrations/036_i18n.sql`
- `supabase/migrations/033_rag_memory_v2.sql`
- `supabase/migrations/025_fix_memory_function_overloading.sql`

### D. Schema + Security Foundations

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/006_add_vector_memory_support.sql`
- `supabase/migrations/024_security_hardening.sql`
- `supabase/migrations/031_add_performance_indexes.sql`
- `supabase/migrations/034_daily_question_memory_guard.sql`
- `supabase/migrations/053_consolidate_rls_policies.sql`

---

## 3) Target V3 Architecture

Implement a two-layer memory model (not one generic type):

1. `memory_observations` (event layer):
- Source-grounded observations with event timestamp, actor context, couple context, language, moderation state.
- Immutable append-only rows (except moderation/lifecycle fields).

2. `memory_facts` (derived layer for RAG):
- Deduplicated durable facts used by retrieval.
- Strong type constraints.
- Explicit confidence, salience, reinforcement, lifecycle status.
- Explicit stability class (`stable`, `semi_stable`, `volatile`) to control decay and pruning.
- Embedding metadata (`embedding_model`, `embedding_version`, `embedded_at`) for deterministic re-indexing.
- Contradiction handling (`superseded_by_fact_id`, `superseded_at`) to retire outdated truths safely.
- Traceability: each fact links to one or more observations.

Supporting tables:
- `memory_fact_observation_links` (many-to-many traceability)
- `memory_feedback` (user confirm/reject/hide/edit)
- `memory_jobs` (durable async extraction queue + retries + dead-letter state)
- `memory_pruning_events` (audit log for archive/supersede/delete actions)

Scope model:
- Keep person-scoped memories.
- Add couple-scoped memories for relationship-specific dynamics.
- Retrieval policy chooses scope based on source and current partner.

---

## 4) Database Design Plan

### 4.1 Normalize and De-legacy

Current `user_memories` mixes legacy columns (`content/category`) and new columns (`memory_text/memory_type`).

Plan:
1. Introduce V3 tables (do not break existing reads immediately).
2. Backfill observations/facts from `user_memories`.
3. Create compatibility view for old call sites during transition.
4. Remove legacy write paths after cutover.

### 4.2 Constraints and Integrity

Add hard constraints:
- `memory_type` enum with explicit taxonomy tiers:
  - durable identity/context (`core_value`, `relationship_boundary`, `long_term_preference`)
  - behavioral patterns (`pattern`, `conflict_trigger`, `repair_strategy`)
  - situational/ephemeral (`current_stressor`, `short_term_need`, `recent_event`)
- `source_type` enum
- `stability_class` enum (`stable`, `semi_stable`, `volatile`)
- non-null constraints for core retrieval columns
- check constraints for confidence range
- explicit lifecycle enum instead of only boolean (`pending_review`, `active`, `hidden`, `rejected`, `archived`, `superseded`)

### 4.3 Idempotency and Race Safety

Add deterministic keys:
- `dedupe_key` (hash over normalized text + type + scope + language bucket)
- partial unique index on retrievable states only (avoid duplicate active facts while allowing archived history)

Use DB upsert:
- `INSERT ... ON CONFLICT ... DO UPDATE` for reinforcement path
- no app-side read-then-write race windows

### 4.4 Performance and Partitioning

Indexes:
- retrieval index by (`scope`, `language`, `active_state`, recency/salience)
- vector index for embedding column
- source lookup index for idempotent source gating

Partition strategy (if needed after telemetry):
- monthly partition for `memory_observations`
- keep `memory_facts` hot and compact

### 4.5 Pruning, Decay, and Supersession Policy

Use explicit policy, not ad-hoc cleanup:
1. Decay score by type/stability (slow decay for `stable`, faster for `volatile`).
2. Archive candidates when combined rank (`recency + salience + reinforcement + feedback`) stays below threshold window.
3. Supersede facts when a newer higher-confidence contradictory fact is accepted.
4. Hard-delete only for privacy/legal events (account deletion, explicit user purge).
5. Record all pruning decisions in `memory_pruning_events` for explainability/audit.

---

## 5) Write Pipeline Plan (Error-Free + Edge-Case Safe)

### 5.1 Replace fire-and-forget extraction with durable jobs

Current `setImmediate` triggers become:
1. enqueue `memory_jobs` row
2. worker consumes with retry policy
3. idempotent completion marker
4. dead-letter state + alerting on repeated failure
5. job semantics are at-least-once delivery + idempotent writes (never exactly-once assumptions)

Enqueue + source-claim updates must happen in one DB transaction (outbox-safe) so claims and jobs cannot drift.

### 5.2 Extraction quality gates

For every source (case/daily/appreciation/caption):
- strict JSON schema validation before write
- source payload validation and canonicalization
- language normalization before dedupe key creation
- structured error categories (`schema_error`, `llm_error`, `db_conflict`, `retry_exhausted`)
- confidence calibration by source type and sensitivity
- low-confidence or sensitive candidate facts enter `pending_review` moderation state before becoming retrievable

### 5.3 Source-specific rules

1. Court/case:
- only extract from accepted/closed sessions by default
- optional partial extraction behind feature flag with lower confidence weighting

2. Daily question:
- move from count-then-claim to atomic claim + durable retry
- extraction claim should only finalize after successful write or terminal failure state

3. Appreciation/caption:
- sanitize text and enforce max length before LLM call
- preserve source provenance for explainability

### 5.4 User governance at write time

Allow immediate post-write controls:
- hide/reject memory
- mark “not me” / “outdated”
- optionally edit phrasing with audit trail
- "never use in AI responses" hard exclusion flag

---

## 6) Read and Retrieval Plan

### 6.1 Non-RAG reads

All memory reads must enforce:
- active lifecycle state
- ownership/scope authorization
- language strategy (strict + fallback behavior defined)
- pagination and deterministic ordering

### 6.2 RAG retrieval policy

Judge and planner retrieval both adopt shared policy module:
- query builder includes facts + feelings + needs + addendum
- weighted retrieval: semantic similarity + recency + confidence + reinforcement + user feedback
- diversity constraints across type/source/scope
- stale memory suppression via explicit per-type decay curves
- contradiction/supersession filter excludes superseded facts by default

Retrieval profiles:
- Judge profile: prioritize conflict dynamics, boundaries, repair patterns, and high-confidence couple scope.
- Planner profile: prioritize preferences, constraints, and recent logistics with lighter historical weighting.

### 6.3 Language strategy

Replace language-only hard filter with layered retrieval:
1. preferred language exact
2. alias/compatible locale
3. controlled fallback language
4. translate-on-read optional path (flagged)

### 6.4 Cross-partner safety

When partner changes:
- relationship-specific facts become archived/inactive for judge RAG
- person-general preferences can remain active
- enforce scope-aware retrieval to avoid wrong-partner bleed-through

### 6.5 Retrieval Explainability Contract

Every retrieved memory should include:
- why-selected signals (top rank contributors)
- traceability ids (fact id + source observation ids)
- user-facing reason label ("recently reinforced", "high-confidence preference", etc.)

---

## 7) All-Pipeline Hardening by File

### 7.1 Server Lib
- `server/src/lib/stenographer.js`: switch to job producer + strict schema + idempotent writes.
- `server/src/lib/supabase.js`: consolidate memory APIs behind V3 repository; remove race-prone patterns.
- `server/src/lib/memoryRetrieval.js`: use shared retrieval policy module; include scope/lifecycle filters.
- `server/src/lib/embeddings.js`: resilience (timeouts, retries, fallback metrics).
- `server/src/lib/courtSessionManager.js` and `server/src/lib/court/PhaseTransitionController.js`: trigger extraction only at approved lifecycle points.
- `server/src/lib/insightService.js`: enforce active-state filter and V3 ranking consistency.
- `server/src/lib/eventPlanner.js`: align retrieval behavior with judge policy and scope constraints.

### 7.2 Routes
- `server/src/routes/dailyQuestions.js`: atomic extraction claim + retry-aware state transitions.
- `server/src/routes/appreciations.js`: queue-based extraction trigger and audit metadata.
- `server/src/routes/memories.js`: queue-based caption extraction and moderation-aware write path.
- `server/src/routes/memory.js`: read APIs must filter inactive and support explicit lifecycle views.
- `server/src/routes/account.js`: ensure memory cleanup handles V3 tables and traceability links.

### 7.3 DB / Migrations
- Add V3 schema migration set.
- Add backfill + verification scripts.
- Add RLS updates for new tables/functions.
- Add compatibility layer migration and removal migration.

### 7.4 Client touchpoints (verification)
- `client/src/store/useMemoryStore.js`
- `client/src/store/useInsightsStore.js`
- `client/src/pages/MemoriesPage.jsx`
- `client/src/pages/InsightsPage.jsx`
- `client/src/pages/ProfilesPage.jsx`

Client plan focus:
- no behavioral regressions
- correct handling of active/archived/hide states
- predictable error surfaces

---

## 8) Edge Case Matrix (Must Pass)

1. Two simultaneous writes of same semantic memory -> one fact, reinforcement increments.
2. Extraction job fails after claim -> retries; no permanent silent skip.
3. Embedding provider timeout -> retry/backoff + observable degraded mode.
4. Language mismatch -> controlled fallback, no empty context if valid alternatives exist.
5. User switches partner -> relationship-scoped memories do not leak into new couple context.
6. User deletes account -> all V3 memory artifacts removed or irreversibly anonymized.
7. Memory marked inactive/rejected -> excluded from all retrieval and insight generation.
8. Source moderation retracts memory -> source gate can re-run extraction safely.
9. Large memory volume -> bounded retrieval latency.
10. RAG retrieval failure -> explicit metrics and safe fallback prompt path.
11. Contradictory new fact arrives -> old fact is superseded and excluded from default retrieval.
12. Pruning run executes -> no loss of user-hidden/rejected semantics and no policy-violating deletions.

---

## 9) Test Strategy (Bug-Free Quality Bar)

### 9.1 Unit tests
- Dedup key generation and normalization.
- Ranking/scoring policy.
- Scope/lifecycle filters.
- language fallback selector.
- job retry state machine.
- decay and pruning threshold evaluation.
- contradiction detection + supersession selection.

### 9.2 Integration tests (DB + RPC)
- upsert/idempotency behavior under contention.
- RLS correctness for all read/write operations.
- migration/backfill correctness.
- partial unique index behavior for retrievable vs archived states.

### 9.3 Concurrency tests
- duplicate extraction race.
- simultaneous daily-question submission.
- worker retry races.
- enqueue+claim transaction atomicity under failure injection.

### 9.4 End-to-end tests
- court -> extraction -> later court retrieval.
- daily question completion -> memory available in retrieval.
- appreciation/caption flows.
- user hide/reject -> no retrieval.
- contradictory update flow -> old fact suppressed, new fact retrieved.
- pruned/archive flow -> fact excluded from default prompts but visible in audit/history view.

### 9.5 Performance tests
- retrieval p95 latency budget.
- worker throughput and retry pressure.
- vector query behavior under realistic volume.
- pruning batch runtime and lock impact budget.

### 9.6 Security tests
- authz on every memory endpoint.
- prompt-injection resistance in extraction path.
- export payload access controls.

---

## 10) Observability and Operations

Metrics:
- extraction jobs: queued/succeeded/failed/retried/dead-letter
- memory write conflict rate
- duplicate suppression rate
- retrieval hit-rate and empty-context rate
- fallback-language usage
- inactive-memory retrieval violations (must be zero)
- supersession rate and contradiction resolution latency
- pruning actions by type (`archived`, `superseded`, `deleted`)
- retrievable-fact cardinality trend by scope (guard against unbounded growth)

Logging:
- structured logs with source ids, job ids, and error class
- no full sensitive text payloads in production logs

Alerting:
- dead-letter threshold
- retrieval error spikes
- sudden drop in memory write success

Runbooks:
- replay failed jobs
- reindex embeddings
- rollback retrieval policy flags
- restore mistakenly pruned facts from audit trail

---

## 11) Rollout Plan

Phase 0: Instrumentation first (no behavior change).  
Phase 1: Add V3 schema + dual-write behind flags.  
Phase 2: Move reads/RAG to V3 repository in shadow mode and compare outputs.  
Phase 3: Cut over retrieval policy; keep rollback switch.  
Phase 4: Disable legacy writes; retain compatibility reads.  
Phase 5: Remove legacy paths after stability window.

Rollback:
- feature flags for write path, read path, retrieval policy, and worker activation.

---

## 12) Sub-Agent Execution Strategy

Coordinator model: one orchestrator, specialized sub-agents per workstream, strict ownership boundaries.

### Agent assignments

1. `db-architecture-agent`
- Owns migrations, constraints, indexes, RLS, backfill/verification.
- Files: `supabase/migrations/*`, SQL helper scripts.

2. `write-pipeline-agent`
- Owns extraction job queue, idempotent writes, source-specific triggers.
- Files: `server/src/lib/stenographer.js`, `server/src/routes/dailyQuestions.js`, `server/src/routes/appreciations.js`, `server/src/routes/memories.js`.

3. `retrieval-agent`
- Owns retrieval policy module and RAG integrations.
- Files: `server/src/lib/memoryRetrieval.js`, `server/src/lib/eventPlanner.js`, `server/src/lib/insightService.js`.

4. `safety-governance-agent`
- Owns lifecycle moderation, user feedback controls, privacy-safe logging.
- Files: memory APIs + security utilities.

5. `test-reliability-agent`
- Owns test matrix implementation (unit/integration/e2e/concurrency/perf/security).
- Files: `server/src/**/*.test.js`, dedicated perf/concurrency scripts.

6. `review-agent`
- Performs spec compliance + code quality review after each phase.

### Working rules

- One owner per file group per phase.
- No cross-file opportunistic edits outside ownership.
- Each phase closes only after:
  1) spec review pass
  2) quality review pass
  3) regression suite pass

---

## 13) Skills Strategy (How We Will Use Available Skills)

1. `writing-plans`
- Maintain this plan and derived per-phase execution plans with explicit acceptance criteria.

2. `subagent-driven-development`
- Execute each phase with fresh specialist agents + mandatory review loops.

3. `systematic-debugging`
- Required for any production bug or flaky test in memory pipelines.

4. `test-driven-development`
- New behavior starts with failing tests for edge cases before implementation.

5. `code-review-excellence`
- Structured severity-first reviews for correctness, safety, and regressions.

6. `sql-optimization-patterns` + `supabase-postgres-best-practices`
- Query/rank/index tuning for retrieval performance and correctness.

7. `debugging-strategies`
- Incident triage for worker failures, retrieval degradations, and race conditions.

8. `webapp-testing`
- E2E verification of client-visible memory behavior across flows.

---

## 14) Definition of Done

This initiative is complete when all are true:
- V3 schema live with enforced constraints and idempotent writes.
- All write pipelines route through durable jobs with retry/dead-letter support.
- All read/retrieval paths enforce lifecycle/scope/language policy consistently.
- Memory taxonomy + stability classes are enforced and used in scoring.
- Pruning/supersession policy runs automatically with auditability.
- Edge case matrix passes in CI.
- Observability + runbooks in place.
- Legacy memory paths decommissioned behind successful stability window.

---

## 15) Immediate Next Action

Create Phase 1 execution checklist and begin with:
1. V3 schema + compatibility layer migration design.
2. Atomic idempotent write contract and job table design.
3. Memory taxonomy + stability-class schema and retrieval weighting contract.
4. Pruning/supersession policy design (`thresholds`, cadence, and audit trail).
5. First failing tests for duplicate-write race, extraction claim-failure, and contradiction supersession.
