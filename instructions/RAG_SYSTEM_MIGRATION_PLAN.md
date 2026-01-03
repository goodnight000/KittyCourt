# RAG System Rebuild and Retirement Plan

Goal: make the memory RAG system accurate, fresh, and shared across judging and daily questions, with safe migration away from the current pipeline.

## Objectives
- Improve relevance and freshness of retrieved memories.
- Update memories continuously (reinforce, decay, and deactivate stale insights).
- Expand ingestion beyond court cases to daily questions.
- Provide a controlled migration and retirement path for the current system.

## Non-Goals
- Replace the existing profiles system in this phase.
- Change the client UI or introduce new user-facing flows (unless needed for safety/consent).

## Current System Summary (Baseline)
- **Writes:** `server/src/lib/stenographer.js` extracts insights after court verdicts, embeds, dedupes, then inserts or reinforces in `user_memories`.
- **Reads:** `server/src/lib/memoryRetrieval.js` creates a single case-level query embedding and calls Supabase RPC `retrieve_relevant_memories`.
- **Usage:** RAG is wired into the judge pipeline only. Daily questions and AI Insights do not use RAG.
- **Storage:** `user_memories` table has legacy columns (`content`, `category`, `source_type`) and newer columns (`memory_text`, `memory_type`, `embedding`).

## Gaps to Address
- Schema mismatch between legacy `user_memories` fields and the new RAG fields.
- Retrieval ignores confidence, recency, and reinforcement signals.
- No systematic decay or deactivation of stale memories.
- Single combined embedding for both users can bias retrieval.
- No ingestion from daily questions.
- No evaluation harness to measure retrieval quality or groundedness.

## Target Architecture (RAG v2)
### Core Flow
1. **Ingest** raw inputs from cases and daily answers.
2. **Extract** structured insights with confidence and type.
3. **Embed** insight text consistently.
4. **Deduplicate / Merge** similar insights.
5. **Score** with salience = similarity + confidence + recency + reinforcement.
6. **Retrieve** per-user, rank, and diversify.
7. **Format** for prompts with source, timestamp, and confidence.

### Data Model (Incremental Changes)
Keep `user_memories` as the canonical table but normalize fields.
- Canonical fields:
  - `memory_text` (text)
  - `memory_type` (enum-like text)
  - `memory_subtype` (optional, for daily answers/preferences)
  - `embedding` (vector)
  - `confidence_score` (0..1)
  - `reinforcement_count` (int)
  - `observed_at` (timestamp, initial occurrence)
  - `last_observed_at` (timestamp)
  - `salience_score` (computed or stored)
  - `source_type` (case, daily_question, appreciation, profile, other)
  - `source_id` (UUID to source)
  - `is_active` (boolean)
  - `deactivated_reason` (optional)
- Backfill or migrate legacy `content/category/subcategory` into `memory_text/memory_type/memory_subtype`.

### Retrieval Strategy
- **Per-user query embeddings** using only that user's inputs.
- **Composite score** in RPC:
  - `score = (similarity * 0.55) + (recency * 0.20) + (confidence * 0.15) + (reinforcement * 0.10)`
- **Recency decay** using `last_observed_at`, capped to avoid permanent loss.
- **Diversity** via per-type caps or MMR to avoid over-indexing one type.
- **Filtering** by `is_active`, minimum similarity, and optional `source_type`.

### Write Pipeline Improvements
- **Case extraction**:
  - Add JSON schema validation and repair on LLM output.
  - Add per-user dedupe that respects type and subtype.
  - Always set `observed_at` and `last_observed_at` on insert.
  - Reinforce existing memories and update `last_observed_at`.
- **Daily question extraction**:
  - Trigger when both partners have answered, or when a single answer crosses a confidence threshold.
  - Use a lighter extraction prompt focused on preferences, values, and patterns.
  - Store with `source_type = daily_question` and subtype for category (ex: `preference.food`).

### Prompt Formatting
- Structured memory block:
  - `Memory: {text}`
  - `Type: {memory_type}`
  - `Confidence: {confidence_score}`
  - `Last observed: {last_observed_at}`
  - `Source: {source_type}`
- Instruction: treat low-confidence or stale memories as weak signals.

## Evaluation and Quality Guardrails
### Offline Retrieval Tests
- Create fixtures with known relevant memories.
- Metrics: precision@k, MRR, recall@k.

### LLM-as-Judge Scoring
- Direct scoring rubric for relevance and groundedness.
- Compare current vs new retrieval prompt contexts (pairwise comparison).

### Monitoring
- Log retrieval set size, average similarity, and salience per request.
- Track memory reinforcement vs insertion ratios.

## Implementation Plan (Phased)
### Phase 0: Preparation (No behavior change)
- Add feature flag: `MEMORY_ENGINE_V2_ENABLED`.
- Add schema migrations for new columns if missing.
- Add RPC `retrieve_relevant_memories_v2` with composite scoring.
- Add fallback path to current RPC.

### Phase 1: Dual-Write + Incremental Backfill
- Stenographer writes both legacy and new canonical fields.
- Backfill legacy `content/category/subcategory` into new fields.
- Start storing `last_observed_at` and `observed_at` consistently.

### Phase 2: Dual-Read and Evaluation
- Run RAG v2 retrieval in shadow mode and log diff metrics.
- Evaluate retrieval quality offline and with LLM-as-judge.
- Tune similarity thresholds and scoring weights.

### Phase 3: Switch Reads (Judging + Daily Questions)
- Enable RAG v2 retrieval for judge pipeline.
- Add daily question extraction and retrieval integration.
- Update prompt formatting to include confidence + recency.

### Phase 4: Deprecation and Cleanup
- Remove old retrieval RPC usage.
- Remove unused legacy fields from application usage.
- Archive or migrate old data.

## Safe Retirement Plan
- **Feature flag gate**: switch between v1 and v2 without deploy.
- **Shadow mode logging**: compare v1/v2 outputs before switching.
- **Rollback**: keep v1 retrieval functions intact until v2 has stable metrics.
- **Data retention**: maintain old fields until backfill and parity confirmed.

## Risks and Mitigations
- **Risk:** Missing or malformed LLM outputs.  
  **Mitigation:** schema validation + repair + fallback to empty insights.
- **Risk:** RLS or RPC signature mismatch.  
  **Mitigation:** explicit UUID types in RPC and test against service role.
- **Risk:** Over-decay of valid long-term patterns.  
  **Mitigation:** floor on salience for high-confidence memories.
- **Risk:** Daily question noise.  
  **Mitigation:** conservative extraction thresholds and per-source weighting.

## Open Questions
- Should `memory_type` be expanded beyond `trigger/core_value/pattern` to include `preference/strength/boundary`?
- Should daily question answers be stored as raw memory events for auditability?
- Which features should consume memory context beyond judging (AI Insights, planner, daily question personalization)?

