# Memory System Overview

This document describes the server-side memory system used to enrich verdicts and to persist long-term user insights.

## Two-Tier Memory Architecture

The memory system combines two tiers of context:

1. **Static profile context**
   - User profile fields (language, preferences, and relationship metadata).
   - Retrieved on every verdict to provide stable, low-latency context.

2. **Dynamic memory embeddings**
   - Long-term memories extracted from resolved cases, daily answers, appreciations, and memory captions.
   - Stored as vector embeddings and retrieved by similarity during the verdict pipeline.

Together, these tiers provide durable background context without leaking sensitive or irrelevant details.

## RAG Retrieval Pipeline (server/src/lib/memoryRetrieval.js)

The retrieval flow is executed before verdict generation:

1. **Supabase readiness check**
   - If Supabase is not configured, the pipeline short-circuits with empty context.

2. **Profile + memory availability fetch (parallel)**
   - Fetch profiles for both users.
   - Check if either user has stored memories to avoid unnecessary embedding work.

3. **Embedding generation**
   - Per-user query embeddings using user-specific inputs (facts, feelings, addendums).

4. **Memory retrieval**
   - Query the memory table using the V2 retrieval path (`retrieveRelevantMemoriesV2`).
   - Apply thresholds (`minSimilarityScore`, `minScore`) and caps (`maxMemoriesToRetrieve`, per-user caps).
   - If language-specific search yields no results, fall back to English.

5. **Formatting**
   - Retrieved memories are mapped into a compact, prompt-ready format.

The output becomes `historicalContext` for the judge pipeline (`server/src/lib/judgeEngine.js`).

## Stenographer Extraction (server/src/lib/stenographer.js)

After a verdict is delivered, the Stenographer agent runs asynchronously:

1. **Input**
   - Case submissions, addendums, and participant metadata.

2. **Extraction**
   - Produces durable insights for each user (triggers, core values, behavioral patterns).
   - Uses strict JSON schemas and repair logic to guarantee parseable output.

3. **De-duplication**
   - Embedding similarity checks prevent redundant memories.

4. **Persistence**
   - New insights are stored in Supabase for future retrieval.

There are parallel extraction flows for daily question answers, appreciation messages, and memory captions, each with smaller schemas and tighter limits.

Trigger behavior is queue-first and queue-only by default:
- When Supabase is configured, trigger paths enqueue memory jobs (`case_extraction`, `daily_question_extraction`, `appreciation_extraction`, `memory_caption_extraction`).
- On enqueue failure, triggers log the error and do not run inline fallback extraction.
- When Supabase is not configured, trigger paths log and return without inline extraction attempts.

## Configuration Notes

- Extraction is rate-limited and guarded by the prompt security layer.
- Language normalization is applied to both retrieval and extraction to keep results consistent.

## Queue + Worker Runtime

Memory extraction now defaults to queue-only runtime:

1. **Queue-only (default, production-safe for dedicated workers)**  
   - `MEMORY_QUEUE_ONLY=true`  
   - Requires one of:
     - `MEMORY_JOBS_WORKER_ENABLED=true` (embedded worker loop in API process), or
     - `MEMORY_JOBS_WORKER_EXTERNAL=true` (standalone worker process expected)

Additional runtime control:

- `MEMORY_JOBS_POLL_INTERVAL_MS`  
  - Poll interval for worker loops in milliseconds.
  - Defaults to `1000` and falls back to `1000` if invalid.

Recommended local queue-only split:

- API process: `MEMORY_QUEUE_ONLY=true`, `MEMORY_JOBS_WORKER_ENABLED=false`, `MEMORY_JOBS_WORKER_EXTERNAL=true`
- Worker process: run `npm run worker:memory` (or `npm run worker:memory:dev`)

## Related Files

- Retrieval: `server/src/lib/memoryRetrieval.js`
- Extraction: `server/src/lib/stenographer.js`
- Embeddings: `server/src/lib/embeddings.js`
- Runtime config: `server/src/lib/memoryRuntimeConfig.js`
- Worker entrypoint: `server/src/workers/memoryJobsWorkerProcess.js`
