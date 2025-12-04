# Hybrid Memory Matrix - Long-Term Memory System

This document describes the architecture and usage of the Cat Judge memory system, which provides personalized verdicts based on historical patterns and user profiles.

## Architecture Overview

The system uses a **hybrid approach** combining:

1. **Static Profiles (JSONB)** - Slowly changing facts stored in PostgreSQL
2. **Episodic Memories (Vector DB)** - Behavioral insights with pgvector embeddings

### LLM Orchestration

| Task | Model | Provider | Purpose |
|------|-------|----------|---------|
| Main Judge | Grok 4.1 Fast | OpenRouter | Verdict generation |
| Extractor Agent | Grok 4.1 Fast | OpenRouter | Insight extraction |
| Embeddings | text-embedding-3-small | OpenAI | Vector generation |

## Components

### 1. Database Schema (`migrations/20251128_add_memory_system/`)

- `profile_data` JSONB column on `User` table
- `user_memories` table with pgvector embeddings
- HNSW index for fast similarity search
- Helper functions for RAG retrieval

### 2. Supabase Client (`lib/supabase.js`)

Handles all vector database operations:
- `searchSimilarMemories()` - De-duplication check
- `retrieveRelevantMemories()` - RAG retrieval
- `insertMemory()` / `reinforceMemory()` - Storage
- `getUserProfile()` / `updateUserProfile()` - Profile management

### 3. Embeddings Service (`lib/embeddings.js`)

Generates OpenAI embeddings for:
- Memory storage (de-duplication)
- RAG query vectors

### 4. Stenographer Agent (`lib/stenographer.js`)

Post-verdict extraction pipeline:
- Runs in background after verdict delivery
- Uses GPT-4o-mini for cost efficiency
- Extracts triggers, core values, and patterns
- De-duplicates via similarity search (threshold: 0.92)

### 5. Memory Retrieval (`lib/memoryRetrieval.js`)

Pre-verdict RAG pipeline:
- Generates query embedding from case inputs
- Fetches top-4 relevant memories
- Retrieves static profiles
- Formats context for prompt injection

### 6. Memory API (`routes/memory.js`)

REST endpoints for profile management:
- `GET /api/memory/health` - System status
- `GET /api/memory/profile/:userId` - Get profile
- `PATCH /api/memory/profile/:userId` - Update profile
- `GET /api/memory/memories/:userId` - List memories
- `GET /api/memory/insights/:userId` - Insight summary

## Setup

### 1. Environment Variables

Add to your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# OpenAI (for embeddings only - judge and extraction now use OpenRouter)
OPENAI_API_KEY=sk-your-openai-key

# OpenRouter (for main judge and extraction agent)
OPENROUTER_API_KEY=your-openrouter-key
```

### 2. Run Supabase Migration

Apply the migration to your Supabase project:

```bash
# Via Supabase CLI
supabase db push

# Or manually via SQL Editor in Supabase Dashboard
# Copy contents of: prisma/migrations/20251128_add_memory_system/migration.sql
```

### 3. Install Dependencies

```bash
cd server
npm install
```

## Profile Data Schema

The `profile_data` JSONB column supports these fields:

```json
{
  "attachmentStyle": "secure | anxious | avoidant | disorganized",
  "loveLanguages": ["words of affirmation", "quality time", "gifts", "acts of service", "physical touch"],
  "conflictStyle": "collaborative | competitive | compromising | accommodating | avoidant",
  "stressResponse": "fight | flight | freeze | fawn",
  "coreNeeds": ["autonomy", "connection", "security", "validation", "respect"],
  "customFields": {}
}
```

## Memory Types

Extracted insights are categorized as:

| Type | Emoji | Description |
|------|-------|-------------|
| `trigger` | ⚡ | Emotional triggers that activate strong responses |
| `core_value` | 💎 | Deeply held beliefs that drive behavior |
| `pattern` | 🔄 | Recurring behavioral tendencies in conflict |

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        DELIBERATION FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. MODERATION CHECK                                             │
│     └─> Safety filter (OpenAI Moderation API)                   │
│                                                                  │
│  2. MEMORY RETRIEVAL (RAG) ←──────────────────────────────────┐ │
│     ├─> Generate query embedding (OpenAI)                      │ │
│     ├─> Fetch static profiles (Supabase)                       │ │
│     └─> Search relevant memories (pgvector)                    │ │
│                                                                │ │
│  3. ANALYSIS PHASE                                             │ │
│     └─> Psychological analysis (Grok 4.1 Fast)              │ │
│                                                                │ │
│  4. VERDICT GENERATION                                         │ │
│     ├─> Inject historical context ←───────────────────────────┘ │
│     └─> Generate verdict (Grok 4.1 Fast)                     │
│                                                                  │
│  5. BACKGROUND EXTRACTION ─────────────────────────────────────┐ │
│     ├─> Extract insights (GPT-4o-mini)                         │ │
│     ├─> Generate embeddings (OpenAI)                           │ │
│     ├─> De-duplicate via similarity search                     │ │
│     └─> Store or reinforce memories ──────────────────────────→│ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## API Response Changes

The verdict response now includes memory metadata:

```json
{
  "verdictId": "v_abc123",
  "status": "success",
  "judgeContent": { ... },
  "_meta": {
    "analysis": { ... },
    "hasHistoricalContext": true,
    "memoriesUsed": 3,
    "processingTimeMs": 4500
  }
}
```

## Testing the System

### 1. Check Memory System Health

```bash
curl http://localhost:3000/api/memory/health
```

### 2. Set a User's Profile

```bash
curl -X PATCH http://localhost:3000/api/memory/profile/USER_ID \
  -H "Content-Type: application/json" \
  -d '{
    "attachmentStyle": "anxious",
    "loveLanguages": ["words of affirmation", "quality time"],
    "conflictStyle": "avoidant"
  }'
```

### 3. View User's Memories

```bash
curl http://localhost:3000/api/memory/memories/USER_ID
```

### 4. Get Insight Summary

```bash
curl http://localhost:3000/api/memory/insights/USER_ID
```

## Configuration

| Setting | Location | Default |
|---------|----------|---------|
| Similarity threshold | `stenographer.js` | 0.92 |
| Max memories retrieved | `memoryRetrieval.js` | 4 |
| Min relevance score | `memoryRetrieval.js` | 0.5 |
| Extractor temperature | `stenographer.js` | 0.3 |
| Embedding dimension | `embeddings.js` | 1536 |

## Cost Optimization

- **Grok 4.1 Fast (free tier)** for extraction: $0 per case
- **text-embedding-3-small**: ~$0.00002 per embedding
- Background extraction runs asynchronously (no UI delay)
- De-duplication prevents embedding bloat
