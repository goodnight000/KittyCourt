# How to Update Database with New Document Frontmatter

All documents in `docs/` now have frontmatter with `name`, `description`, and `source_url` fields, matching the Skills format.

## Step 1: Run Database Migration

First, add the new columns (`description` and `source_url`) to your database:

### For Local Docker Database:

```bash
cd Database
PGPASSWORD=postgres psql -h localhost -U postgres -d agentskills -f schema/add_document_fields.sql
```

### For Supabase:

```bash
cd Database

# Option 1: Using psql directly
psql "your-supabase-connection-string" -f schema/add_document_fields.sql

# Option 2: Using Supabase SQL Editor
# 1. Go to: https://supabase.com/dashboard/project/cppdscqtkzuiwqdiumdq/sql/new
# 2. Copy and paste the contents of schema/add_document_fields.sql
# 3. Click "Run"
```

## Step 2: Re-index Documents

After running the migration, re-index all documents to update them with the new frontmatter data:

```bash
cd Database

# Re-index only documents (faster)
python -m scripts.index --docs

# Or re-index everything
python -m scripts.index --all
```

This will:
- Parse frontmatter from each document
- Extract `name`, `description`, and `source_url`
- Update the database records with the new information
- Regenerate embeddings if needed

## Step 3: Verify Updates

Check that documents have been updated:

```bash
cd Database

# Check a specific document
python -c "
from scripts.registry import SkillRegistry
registry = SkillRegistry()
doc = registry.get_document('docs/blogs.md')
if doc:
    print(f\"Title: {doc.get('title', 'N/A')}\")
    print(f\"Description: {doc.get('description', 'N/A')[:100]}...\")
    print(f\"Source URL: {doc.get('source_url', 'N/A')}\")
"

# List all documents with their new fields
python -c "
from scripts.registry import SkillRegistry
from scripts.db import execute_query

results = execute_query('SELECT title, description, source_url FROM documents ORDER BY title')
print(f\"Found {len(results)} documents:\")
for r in results:
    print(f\"\\n  {r['title']}\")
    print(f\"    Description: {r.get('description', 'N/A')[:80]}...\")
    print(f\"    Source: {r.get('source_url', 'N/A')}\")
"
```

## What Changed

### Document Frontmatter Format

All documents now start with:

```yaml
---
name: document-name
description: Brief description of what the document covers
doc_type: blog|research|reference|case_study
source_url: URL or "No" if unknown
---
```

All fields (`name`, `description`, `doc_type`, `source_url`) are read from frontmatter and stored in the database, matching the Skills format.

### Updated Documents

1. **blogs.md** → `context-engineering-blogs` (doc_type: blog)
2. **claude_research.md** → `production-grade-llm-agents` (doc_type: research)
3. **compression.md** → `context-compression-evaluation` (doc_type: research)
4. **gemini_research.md** → `advanced-agentic-architectures` (doc_type: research)
5. **netflix_context.md** → `netflix-context-compression` (doc_type: case_study)
6. **vercel_tool.md** → `vercel-tool-reduction` (doc_type: blog, has source URL)
7. **anthropic_skills/agentskills.md** → `agent-skills-format` (doc_type: reference)

### Database Schema Changes

Added two new columns to `documents` table:
- `description TEXT` - Description from frontmatter
- `source_url VARCHAR(512)` - Source URL or "No"

## Troubleshooting

### Migration Fails

If you get "column already exists" errors, the migration already ran. You can skip to Step 2.

### Documents Not Updating

If documents don't update, check:
1. Frontmatter is correctly formatted (YAML between `---` markers)
2. Database connection is working
3. File paths are correct

### Need to Force Re-index

To force re-indexing even if content hash hasn't changed:

```bash
# This will regenerate embeddings and update all fields
python -m scripts.index --docs --force
```

## Next Steps

After updating:
- Documents will have proper names and descriptions in search results
- Source URLs will be tracked for attribution
- Better semantic search results with improved metadata

