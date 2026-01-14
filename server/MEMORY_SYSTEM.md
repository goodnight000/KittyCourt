# Memory System Overview

This document describes the server-side memory system used to enrich verdicts and to persist long-term user insights.

## Two-Tier Memory Architecture

The memory system combines two tiers of context:

1. **Static profile context**
   - User profile fields (language, preferences, and relationship metadata).
   - Retrieved on every verdict to provide stable, low-latency context.

2. **Dynamic memory embeddings**
   - Long-term memories extracted from resolved cases and daily answers.
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
   - V1: single case-level query embedding (camera facts + feelings + addendums).
   - V2 (feature-flagged): per-user query embeddings using user-specific inputs.

4. **Memory retrieval**
   - Query the memory table using similarity search.
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

There is a parallel extraction flow for daily question answers with a smaller schema and tighter limits.

## Configuration Notes

- Memory retrieval behavior is feature-flagged by `MEMORY_ENGINE_V2_ENABLED`.
- Extraction is rate-limited and guarded by the prompt security layer.
- Language normalization is applied to both retrieval and extraction to keep results consistent.

## Related Files

- Retrieval: `server/src/lib/memoryRetrieval.js`
- Extraction: `server/src/lib/stenographer.js`
- Embeddings: `server/src/lib/embeddings.js`
