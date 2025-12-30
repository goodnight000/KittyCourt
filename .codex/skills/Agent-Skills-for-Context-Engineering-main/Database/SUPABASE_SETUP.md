# Supabase Setup Guide

This guide walks through setting up the Semantic Knowledge Registry on Supabase.

## Prerequisites

- Supabase account (free tier works fine)
- OpenAI API key (for embeddings)

## Step 1: Get Your Database Connection String

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/cppdscqtkzuiwqdiumdq

2. Click **Settings** (left sidebar) > **Database**

3. Scroll to **Connection string**

4. Select **URI** format

5. Copy the connection string. It should look like:
   ```
   postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```

6. **Important**: Replace `[YOUR-PASSWORD]` with your actual database password

## Step 2: Enable pgvector Extension

1. In Supabase dashboard, go to **Database** > **Extensions**

2. Search for "vector"

3. Click **Enable** on the `vector` extension

4. Wait for it to install (should be instant)

## Step 3: Configure Local Environment

Update your `Database/.env` file:

```bash
# Supabase connection
DATABASE_URL=postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres

# OpenAI API key (already set)
OPENAI_API_KEY=sk-proj-...

# Embedding configuration
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSION=1536

# Environment
ENVIRONMENT=production
```

## Step 4: Initialize Supabase Database

Run the setup script:

```bash
cd Database
python -m scripts.setup_supabase
```

This will:
- Connect to your Supabase database
- Create all required tables
- Set up pgvector indexes
- Verify the setup

## Step 5: Index Your Skills and Documents

```bash
# Index everything with embeddings
python -m scripts.index --all
```

This will:
- Index all 10 skills from `skills/` directory
- Index all documents from `docs/` directory
- Generate embeddings for semantic search
- Link documents to skills

Expected output:
```
Indexed 10 skills
Indexed 7 documents
Total indexed: 17 items

Registry stats:
  Skills: 10 (10 with embeddings)
  Documents: 7 (7 with embeddings)
  Skill-Document links: 14
```

## Step 6: Test Semantic Search

```bash
# Search for skills
python -m scripts.search "how to design tools for AI agents" --threshold 0.5

# Search specific type
python -m scripts.search "context window management" --type skills --threshold 0.4

# Get JSON output
python -m scripts.search "evaluation techniques" --json
```

## Using Both Local and Supabase

You can switch between local Docker database and Supabase by changing `DATABASE_URL`:

**Local Docker:**
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agentskills
```

**Supabase:**
```bash
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

## Verify Setup

Check your database in Supabase dashboard:

1. Go to **Table Editor**
2. You should see tables: `skills`, `documents`, `skill_sources`, `skill_versions`, `skill_references`
3. Click on `skills` table to see your indexed skills

## Costs

- **Supabase**: Free tier includes 500MB database, plenty for this use case
- **OpenAI Embeddings**: ~$0.10 per 1M tokens (indexing 10 skills ≈ $0.01)

## Troubleshooting

### Connection Refused

- Check that DATABASE_URL has correct password
- Verify you're using the **pooler** connection string (port 6543)
- Check Supabase dashboard shows project is active

### pgvector Extension Not Found

- Enable it manually: Database > Extensions > vector > Enable
- Re-run setup script

### Embedding Errors

- Verify OPENAI_API_KEY is set correctly
- Check you have API credits

### Schema Already Exists

The schema uses `IF NOT EXISTS` so it's safe to re-run. If you need to reset:

```sql
-- In Supabase SQL Editor
DROP TABLE IF EXISTS skill_references CASCADE;
DROP TABLE IF EXISTS skill_versions CASCADE;
DROP TABLE IF EXISTS skill_sources CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS skills CASCADE;
```

Then re-run `python -m scripts.setup_supabase`.

## Security

- **Never commit** your `.env` file (already in `.gitignore`)
- The Supabase publishable API key is for REST API, not direct database access
- Use Row Level Security (RLS) policies if exposing data via Supabase API
- For this internal tool, direct database access is fine

