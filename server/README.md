# Server - Court + Judge Engine

The server powers real-time court sessions, the v2 judge pipeline, memory retrieval, and case history. All data is stored in Supabase.

## Architecture

```
server/
├── src/app.js                  # Express entry
├── src/routes/
│   ├── court.js                # Court session endpoints (v2)
│   ├── memory.js               # Memory system endpoints
│   ├── dailyQuestions.js       # Daily check-ins
│   ├── usage.js                # Usage tracking
│   └── webhooks.js             # RevenueCat, etc.
└── src/lib/
    ├── courtSessionManager.js  # Source of truth for session state
    ├── courtWebSocket.js       # Socket.IO events + sync
    ├── courtDatabase.js        # Checkpoints + recovery
    ├── judgeEngine.js          # v2 pipeline (analyst, priming, hybrid)
    ├── prompts.js              # v2 prompts
    ├── jsonSchemas.js          # LLM JSON schemas
    ├── schemas.js              # Zod validation
    ├── memoryRetrieval.js      # RAG pipeline
    ├── stenographer.js         # Background extraction
    └── repairAttempts.js       # Repair library
```

## Judge Pipeline (v2)

1. Safety guardrail (OpenRouter moderation)
2. Memory retrieval (RAG from pgvector)
3. Analyst + repair selection (3 resolutions)
4. Priming + joint menu content
5. Hybrid resolution (only if users pick different options)
6. Background memory extraction

## Court Sessions

- HTTP endpoints under `/api/court/*`
- Real-time sync via Socket.IO (`court:*` events)
- Sessions checkpointed in `court_sessions` for crash recovery

## Case History

- `/api/cases` endpoints for case list/detail
- Verdicts stored in `verdicts` with multiple versions per case

## Environment Variables

```bash
OPENROUTER_API_KEY=...
OPENAI_API_KEY=...              # embeddings only
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
CORS_ORIGIN=http://localhost:5173
PORT=3000
```

## Running the Server

```bash
npm run dev     # node --watch server/src/app.js
npm test        # vitest (server tests)
```
