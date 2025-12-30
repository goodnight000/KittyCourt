#!/usr/bin/env python3
"""
Test script for the Semantic Knowledge Registry.

Tests:
1. Database connection
2. Skill CRUD operations
3. Document CRUD operations
4. Skill-Document linking
5. Semantic search (requires OPENAI_API_KEY)
6. Version tracking
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.db import execute_query, get_cursor
from scripts.registry import SkillRegistry, parse_skill_frontmatter, extract_title_from_markdown
from scripts.config import OPENAI_API_KEY


def test_database_connection():
    """Test basic database connectivity."""
    print("Testing database connection...")
    try:
        result = execute_query("SELECT 1 as test")
        assert result[0]["test"] == 1
        print("  [PASS] Database connection works")
        return True
    except Exception as e:
        print(f"  [FAIL] Database connection failed: {e}")
        return False


def test_pgvector_extension():
    """Test pgvector extension is available."""
    print("Testing pgvector extension...")
    try:
        result = execute_query(
            "SELECT extname FROM pg_extension WHERE extname = 'vector'"
        )
        assert len(result) == 1
        print("  [PASS] pgvector extension installed")
        return True
    except Exception as e:
        print(f"  [FAIL] pgvector check failed: {e}")
        return False


def test_tables_exist():
    """Test all required tables exist."""
    print("Testing tables exist...")
    required_tables = ["skills", "documents", "skill_sources", "skill_versions", "skill_references"]
    
    result = execute_query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    )
    existing_tables = [r["table_name"] for r in result]
    
    all_exist = True
    for table in required_tables:
        if table in existing_tables:
            print(f"  [PASS] Table '{table}' exists")
        else:
            print(f"  [FAIL] Table '{table}' missing")
            all_exist = False
    
    return all_exist


def test_skill_crud():
    """Test skill create, read, update, delete operations."""
    print("Testing skill CRUD operations...")
    registry = SkillRegistry()
    
    test_name = "test-skill-crud"
    
    try:
        # Create (without embedding to avoid needing API key)
        skill_id = registry.upsert_skill(
            name=test_name,
            description="A test skill for CRUD operations",
            content="# Test Skill\n\nThis is test content.",
            path="skills/test-skill-crud/SKILL.md",
            version="1.0.0",
            generate_embedding_flag=False  # Skip embedding for test
        )
        print(f"  [PASS] Created skill with ID: {skill_id[:8]}...")
        
        # Read
        skill = registry.get_skill(test_name)
        assert skill is not None
        assert skill["name"] == test_name
        print(f"  [PASS] Read skill: {skill['name']}")
        
        # Update
        registry.upsert_skill(
            name=test_name,
            description="Updated description",
            content="# Updated Test Skill\n\nUpdated content.",
            path="skills/test-skill-crud/SKILL.md",
            version="1.0.1",
            generate_embedding_flag=False
        )
        updated = registry.get_skill(test_name)
        assert updated["description"] == "Updated description"
        assert updated["version"] == "1.0.1"
        print(f"  [PASS] Updated skill to version {updated['version']}")
        
        # List
        all_skills = registry.list_skills()
        assert any(s["name"] == test_name for s in all_skills)
        print(f"  [PASS] Listed {len(all_skills)} skills")
        
        # Delete
        deleted = registry.delete_skill(test_name)
        assert deleted
        assert registry.get_skill(test_name) is None
        print(f"  [PASS] Deleted skill")
        
        return True
        
    except Exception as e:
        print(f"  [FAIL] Skill CRUD failed: {e}")
        # Cleanup
        registry.delete_skill(test_name)
        return False


def test_document_crud():
    """Test document create, read, update, delete operations."""
    print("Testing document CRUD operations...")
    registry = SkillRegistry()
    
    test_path = "docs/test-document.md"
    
    try:
        # Create
        doc_id = registry.upsert_document(
            title="Test Document",
            content="# Test Document\n\nThis is test content for documents.",
            path=test_path,
            doc_type="reference",
            generate_embedding_flag=False
        )
        print(f"  [PASS] Created document with ID: {doc_id[:8]}...")
        
        # Read
        doc = registry.get_document(test_path)
        assert doc is not None
        assert doc["title"] == "Test Document"
        print(f"  [PASS] Read document: {doc['title']}")
        
        # Update (change content)
        registry.upsert_document(
            title="Updated Test Document",
            content="# Updated Test Document\n\nUpdated content.",
            path=test_path,
            doc_type="research",
            generate_embedding_flag=False
        )
        updated = registry.get_document(test_path)
        assert updated["title"] == "Updated Test Document"
        print(f"  [PASS] Updated document")
        
        # List
        all_docs = registry.list_documents()
        assert any(d["path"] == test_path for d in all_docs)
        print(f"  [PASS] Listed {len(all_docs)} documents")
        
        # Cleanup
        with get_cursor() as cur:
            cur.execute("DELETE FROM documents WHERE path = %s", (test_path,))
        print(f"  [PASS] Cleaned up test document")
        
        return True
        
    except Exception as e:
        print(f"  [FAIL] Document CRUD failed: {e}")
        # Cleanup
        with get_cursor() as cur:
            cur.execute("DELETE FROM documents WHERE path = %s", (test_path,))
        return False


def test_skill_document_linking():
    """Test linking skills to documents."""
    print("Testing skill-document linking...")
    registry = SkillRegistry()
    
    try:
        # Create a test skill
        skill_id = registry.upsert_skill(
            name="test-link-skill",
            description="Test skill for linking",
            content="# Link Test\n\nContent.",
            path="skills/test-link-skill/SKILL.md",
            generate_embedding_flag=False
        )
        
        # Create a test document
        doc_id = registry.upsert_document(
            title="Test Link Document",
            content="# Link Document\n\nContent.",
            path="docs/test-link-doc.md",
            generate_embedding_flag=False
        )
        
        # Link them
        registry.link_skill_to_document(skill_id, doc_id, relevance=0.85)
        print(f"  [PASS] Linked skill to document with relevance 0.85")
        
        # Get sources
        sources = registry.get_skill_sources(skill_id)
        assert len(sources) == 1
        assert sources[0]["relevance"] == 0.85
        print(f"  [PASS] Retrieved skill sources: {len(sources)} document(s)")
        
        # Get skills for document
        skills = registry.get_document_skills(doc_id)
        assert len(skills) == 1
        print(f"  [PASS] Retrieved document skills: {len(skills)} skill(s)")
        
        # Cleanup
        registry.delete_skill("test-link-skill")
        with get_cursor() as cur:
            cur.execute("DELETE FROM documents WHERE path = %s", ("docs/test-link-doc.md",))
        print(f"  [PASS] Cleaned up test data")
        
        return True
        
    except Exception as e:
        print(f"  [FAIL] Linking failed: {e}")
        registry.delete_skill("test-link-skill")
        with get_cursor() as cur:
            cur.execute("DELETE FROM documents WHERE path = %s", ("docs/test-link-doc.md",))
        return False


def test_version_tracking():
    """Test skill version tracking."""
    print("Testing version tracking...")
    registry = SkillRegistry()
    
    try:
        # Create skill
        skill_id = registry.upsert_skill(
            name="test-version-skill",
            description="Test skill for versions",
            content="# Version 1\n\nInitial content.",
            path="skills/test-version-skill/SKILL.md",
            version="1.0.0",
            generate_embedding_flag=False
        )
        
        # Create version snapshot
        version_id = registry.create_skill_version(
            skill_id=skill_id,
            version="1.0.0",
            content="# Version 1\n\nInitial content.",
            change_summary="Initial version"
        )
        print(f"  [PASS] Created version snapshot: {version_id[:8]}...")
        
        # Update and create another version
        registry.upsert_skill(
            name="test-version-skill",
            description="Updated description",
            content="# Version 2\n\nUpdated content.",
            path="skills/test-version-skill/SKILL.md",
            version="1.1.0",
            generate_embedding_flag=False
        )
        
        registry.create_skill_version(
            skill_id=skill_id,
            version="1.1.0",
            content="# Version 2\n\nUpdated content.",
            change_summary="Added new features"
        )
        
        # Get versions
        versions = registry.get_skill_versions(skill_id)
        assert len(versions) == 2
        print(f"  [PASS] Retrieved {len(versions)} versions")
        
        # Cleanup
        registry.delete_skill("test-version-skill")
        print(f"  [PASS] Cleaned up test data")
        
        return True
        
    except Exception as e:
        print(f"  [FAIL] Version tracking failed: {e}")
        registry.delete_skill("test-version-skill")
        return False


def test_frontmatter_parsing():
    """Test YAML frontmatter parsing."""
    print("Testing frontmatter parsing...")
    
    content = """---
name: test-skill
description: A test skill for parsing
version: 1.0.0
---

# Test Skill

Content here.
"""
    
    try:
        frontmatter = parse_skill_frontmatter(content)
        assert frontmatter["name"] == "test-skill"
        assert frontmatter["description"] == "A test skill for parsing"
        print(f"  [PASS] Parsed frontmatter: name={frontmatter['name']}")
        return True
    except Exception as e:
        print(f"  [FAIL] Frontmatter parsing failed: {e}")
        return False


def test_title_extraction():
    """Test title extraction from markdown."""
    print("Testing title extraction...")
    
    content = """# My Document Title

Some content here.
"""
    
    try:
        title = extract_title_from_markdown(content)
        assert title == "My Document Title"
        print(f"  [PASS] Extracted title: {title}")
        return True
    except Exception as e:
        print(f"  [FAIL] Title extraction failed: {e}")
        return False


def test_stats():
    """Test stats retrieval."""
    print("Testing stats...")
    registry = SkillRegistry()
    
    try:
        stats = registry.get_stats()
        assert "skills" in stats
        assert "documents" in stats
        assert "skill_document_links" in stats
        print(f"  [PASS] Stats: {stats}")
        return True
    except Exception as e:
        print(f"  [FAIL] Stats failed: {e}")
        return False


def test_semantic_search():
    """Test semantic search (requires OPENAI_API_KEY)."""
    print("Testing semantic search...")
    
    if not OPENAI_API_KEY:
        print("  [SKIP] OPENAI_API_KEY not set, skipping semantic search test")
        return True  # Not a failure, just skipped
    
    registry = SkillRegistry()
    
    try:
        # Create skill WITH embedding
        skill_id = registry.upsert_skill(
            name="test-search-skill",
            description="A skill about designing tools for AI agents",
            content="# Tool Design for Agents\n\nThis skill covers how to design effective tools for AI agent systems.",
            path="skills/test-search-skill/SKILL.md",
            generate_embedding_flag=True  # Generate embedding
        )
        print(f"  [PASS] Created skill with embedding")
        
        # Search
        results = registry.search_skills(
            "how do I build tools for AI",
            threshold=0.5,
            limit=5
        )
        
        assert len(results) > 0
        assert any(r["name"] == "test-search-skill" for r in results)
        top_result = results[0]
        print(f"  [PASS] Semantic search found {len(results)} results")
        print(f"         Top: {top_result['name']} (similarity: {top_result['similarity']:.3f})")
        
        # Cleanup
        registry.delete_skill("test-search-skill")
        print(f"  [PASS] Cleaned up test data")
        
        return True
        
    except Exception as e:
        print(f"  [FAIL] Semantic search failed: {e}")
        registry.delete_skill("test-search-skill")
        return False


def main():
    print("=" * 60)
    print("Semantic Knowledge Registry - Test Suite")
    print("=" * 60)
    print()
    
    results = []
    
    # Run tests
    results.append(("Database Connection", test_database_connection()))
    results.append(("pgvector Extension", test_pgvector_extension()))
    results.append(("Tables Exist", test_tables_exist()))
    results.append(("Frontmatter Parsing", test_frontmatter_parsing()))
    results.append(("Title Extraction", test_title_extraction()))
    results.append(("Skill CRUD", test_skill_crud()))
    results.append(("Document CRUD", test_document_crud()))
    results.append(("Skill-Document Linking", test_skill_document_linking()))
    results.append(("Version Tracking", test_version_tracking()))
    results.append(("Stats", test_stats()))
    results.append(("Semantic Search", test_semantic_search()))
    
    # Summary
    print()
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"  [{status}] {name}")
    
    print()
    print(f"Passed: {passed}/{total}")
    
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())

