# Semantic Knowledge Registry

A PostgreSQL + pgvector database layer for the Agent Skills repository. Enables semantic search over skills and documents, allowing agents to find relevant knowledge by meaning rather than exact text matching.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Semantic Knowledge Registry                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │     Skills       │     │    Documents     │                  │
│  │  (SKILL.md)      │◄────│   (docs/*.md)    │                  │
│  │                  │     │                  │                  │
│  │  - metadata      │     │  - content       │                  │
│  │  - embedding     │     │  - embedding     │                  │
│  │  - version       │     │  - hash          │                  │
│  └────────┬─────────┘     └────────┬─────────┘                  │
│           │                        │                            │
│           └────────┬───────────────┘                            │
│                    ▼                                            │
│           ┌────────────────┐                                    │
│           │  skill_sources │  (junction table)                  │
│           │                │                                    │
│           │  tracks which  │                                    │
│           │  docs informed │                                    │
│           │  which skills  │                                    │
│           └────────────────┘                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Why Postgres + pgvector

1. **Single system of record**: Structured metadata and vector embeddings in one database
2. **Production-ready**: Battle-tested stack, easy to scale
3. **Cost-effective**: Generous free tiers on Neon/Supabase for seed stage
4. **No vendor lock-in**: Open source, standard SQL

## Prerequisites

- Docker and Docker Compose (for local development)
- Python 3.9+
- OpenAI API key (for embeddings) or compatible embedding provider

## Quick Start

### 1. Start Local Database

```bash
cd Database
docker-compose up -d
```

This starts:
- PostgreSQL 16 with pgvector extension
- Adminer (database UI) at http://localhost:8080

### 2. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 3. Initialize Schema

```bash
python scripts/init_db.py
```

### 4. Index Skills and Documents

```bash
# Index all skills
python scripts/index.py --skills

# Index all documents
python scripts/index.py --docs

# Index everything
python scripts/index.py --all
```

### 5. Search

```bash
# Semantic search
python scripts/search.py "how do I design tools for agents"

# Search with filters
python scripts/search.py "context window optimization" --type skills --limit 5
```

## Configuration

Set environment variables or create a `.env` file:

```bash
# Database connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agentskills

# Embedding provider
OPENAI_API_KEY=sk-...

# Optional: Use different embedding model
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSION=1536
```

## Schema Overview

### skills

Main registry of agent skills.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(255) | Skill identifier (e.g., "tool-design") |
| description | TEXT | Brief description from frontmatter |
| content | TEXT | Full SKILL.md content |
| path | VARCHAR(512) | Filesystem path |
| version | VARCHAR(50) | Semantic version |
| embedding | vector(1536) | Semantic embedding |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update |

### documents

Source documents used to build skills.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| title | VARCHAR(512) | Document title |
| content | TEXT | Full document content |
| path | VARCHAR(512) | Filesystem path |
| content_hash | VARCHAR(64) | SHA-256 hash for change detection |
| embedding | vector(1536) | Semantic embedding |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update |

### skill_sources

Junction table linking skills to their source documents.

| Column | Type | Description |
|--------|------|-------------|
| skill_id | UUID | Foreign key to skills |
| document_id | UUID | Foreign key to documents |
| relevance | FLOAT | How relevant the doc is (0-1) |

### skill_versions

Version history for skills.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| skill_id | UUID | Foreign key to skills |
| version | VARCHAR(50) | Version string |
| content | TEXT | Content at this version |
| created_at | TIMESTAMP | When this version was created |

## Python API

```python
from scripts.registry import SkillRegistry

# Initialize
registry = SkillRegistry()

# Semantic search for skills
results = registry.search_skills("how to design effective agent tools", limit=5)
for skill in results:
    print(f"{skill['name']}: {skill['similarity']:.3f}")

# Search documents
docs = registry.search_documents("context window management", limit=10)

# Find related skills for a new document
related = registry.find_related_skills(new_doc_content, threshold=0.7)

# Register a new skill
registry.upsert_skill(
    name="new-skill",
    description="A new skill",
    content=skill_content,
    path="skills/new-skill/SKILL.md",
    version="1.0.0"
)

# Link skill to source documents
registry.link_skill_to_document(skill_id, document_id, relevance=0.9)
```

## Agent Integration

When an agent receives a new document:

```python
from scripts.registry import SkillRegistry

registry = SkillRegistry()

def process_new_document(content: str, path: str):
    """Process a new document and determine skill updates."""
    
    # 1. Index the new document
    doc_id = registry.upsert_document(
        title=extract_title(content),
        content=content,
        path=path
    )
    
    # 2. Find semantically related skills
    related_skills = registry.find_related_skills(content, threshold=0.7)
    
    # 3. Determine action
    if not related_skills:
        # No related skills - might need a new skill
        return {"action": "create_skill", "document_id": doc_id}
    else:
        # Related skills exist - might need updates
        return {
            "action": "update_skills",
            "document_id": doc_id,
            "related_skills": related_skills
        }
```

## Production Deployment

For production, use a managed PostgreSQL service with pgvector support:

- **Neon**: Free tier with 0.5GB storage, pgvector included
- **Supabase**: Free tier with 500MB, pgvector included
- **Railway**: $5/month, pgvector included
- **AWS RDS**: pgvector extension available

Update `DATABASE_URL` to point to your production instance.

## Maintenance

### Re-index after schema changes

```bash
python scripts/index.py --all --force
```

### Check embedding coverage

```bash
python scripts/check_coverage.py
```

### Backup

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

