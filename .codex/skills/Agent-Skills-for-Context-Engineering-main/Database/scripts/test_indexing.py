#!/usr/bin/env python3
"""
Test actual skill and document indexing from the repository.

This test validates:
1. Parsing real skills from skills/ directory
2. Indexing them into the database
3. Querying and retrieving them
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pathlib import Path
from scripts.registry import SkillRegistry, parse_skill_frontmatter, extract_title_from_markdown
from scripts.config import SKILLS_DIR, DOCS_DIR


def test_index_real_skills():
    """Index actual skills from the skills directory."""
    print("Testing indexing of real skills...")
    print(f"Skills directory: {SKILLS_DIR}")
    
    registry = SkillRegistry()
    indexed = []
    
    if not SKILLS_DIR.exists():
        print(f"  [FAIL] Skills directory not found: {SKILLS_DIR}")
        return False
    
    skill_dirs = [d for d in SKILLS_DIR.iterdir() if d.is_dir()]
    print(f"  Found {len(skill_dirs)} skill directories")
    
    for skill_dir in skill_dirs:
        skill_file = skill_dir / "SKILL.md"
        
        if not skill_file.exists():
            print(f"  [SKIP] {skill_dir.name}: no SKILL.md")
            continue
        
        content = skill_file.read_text()
        frontmatter = parse_skill_frontmatter(content)
        
        name = frontmatter.get("name", skill_dir.name)
        description = frontmatter.get("description", "No description")
        
        try:
            skill_id = registry.upsert_skill(
                name=name,
                description=description,
                content=content,
                path=str(skill_file.relative_to(SKILLS_DIR.parent)),
                version="1.0.0",
                generate_embedding_flag=False  # Skip embedding for test
            )
            indexed.append(name)
            print(f"  [INDEXED] {name}")
        except Exception as e:
            print(f"  [FAIL] {name}: {e}")
    
    print(f"\nIndexed {len(indexed)} skills")
    return len(indexed) > 0


def test_index_real_documents():
    """Index actual documents from the docs directory."""
    print("\nTesting indexing of real documents...")
    print(f"Docs directory: {DOCS_DIR}")
    
    registry = SkillRegistry()
    indexed = []
    
    if not DOCS_DIR.exists():
        print(f"  [FAIL] Docs directory not found: {DOCS_DIR}")
        return False
    
    doc_files = list(DOCS_DIR.rglob("*.md"))
    print(f"  Found {len(doc_files)} markdown files")
    
    for doc_file in doc_files:
        content = doc_file.read_text()
        # Use filename as fallback for title
        filename_title = doc_file.stem.replace('_', ' ').replace('-', ' ').title()
        title = extract_title_from_markdown(content, fallback=filename_title)
        
        try:
            doc_id = registry.upsert_document(
                title=title,
                content=content,
                path=str(doc_file.relative_to(DOCS_DIR.parent)),
                doc_type="research",
                generate_embedding_flag=False
            )
            indexed.append(title)
            print(f"  [INDEXED] {title[:50]}...")
        except Exception as e:
            print(f"  [FAIL] {doc_file.name}: {e}")
    
    print(f"\nIndexed {len(indexed)} documents")
    return len(indexed) > 0


def test_query_indexed_data():
    """Query the indexed skills and documents."""
    print("\nTesting queries on indexed data...")
    
    registry = SkillRegistry()
    
    # List all skills
    skills = registry.list_skills()
    print(f"\nSkills in registry: {len(skills)}")
    for skill in skills[:5]:  # Show first 5
        print(f"  - {skill['name']}: {skill['description'][:60]}...")
    if len(skills) > 5:
        print(f"  ... and {len(skills) - 5} more")
    
    # List all documents
    docs = registry.list_documents()
    print(f"\nDocuments in registry: {len(docs)}")
    for doc in docs[:5]:  # Show first 5
        print(f"  - [{doc['doc_type']}] {doc['title'][:50]}...")
    if len(docs) > 5:
        print(f"  ... and {len(docs) - 5} more")
    
    # Get stats
    stats = registry.get_stats()
    print(f"\nRegistry stats:")
    print(f"  Skills: {stats['skills']} ({stats['skills_with_embedding']} with embeddings)")
    print(f"  Documents: {stats['documents']} ({stats['documents_with_embedding']} with embeddings)")
    print(f"  Skill-Document links: {stats['skill_document_links']}")
    
    return len(skills) > 0 or len(docs) > 0


def test_skill_detail():
    """Test retrieving a specific skill with full details."""
    print("\nTesting skill detail retrieval...")
    
    registry = SkillRegistry()
    
    # Try to get tool-design skill
    skill = registry.get_skill("tool-design")
    
    if skill:
        print(f"  Name: {skill['name']}")
        print(f"  Description: {skill['description'][:100]}...")
        print(f"  Path: {skill['path']}")
        print(f"  Version: {skill['version']}")
        print(f"  Content length: {len(skill['content'])} chars")
        return True
    else:
        print("  [INFO] tool-design skill not found, trying another...")
        skills = registry.list_skills()
        if skills:
            skill = registry.get_skill(skills[0]['name'])
            if skill:
                print(f"  Name: {skill['name']}")
                print(f"  Description: {skill['description'][:100]}...")
                return True
    
    print("  [WARN] No skills found to test detail retrieval")
    return False


def cleanup():
    """Clean up test data."""
    print("\nCleaning up test data...")
    registry = SkillRegistry()
    
    # Delete all skills (for test purposes)
    skills = registry.list_skills()
    for skill in skills:
        registry.delete_skill(skill['name'])
        print(f"  Deleted skill: {skill['name']}")
    
    # Delete all documents
    from scripts.db import get_cursor
    with get_cursor() as cur:
        cur.execute("DELETE FROM documents")
    print("  Deleted all documents")
    
    print("  Cleanup complete")


def main():
    print("=" * 60)
    print("Real Data Indexing Test")
    print("=" * 60)
    print()
    
    results = []
    
    # Index real data
    results.append(("Index Skills", test_index_real_skills()))
    results.append(("Index Documents", test_index_real_documents()))
    results.append(("Query Data", test_query_indexed_data()))
    results.append(("Skill Detail", test_skill_detail()))
    
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
    
    print(f"\nPassed: {passed}/{total}")
    
    # Ask about cleanup
    print("\n[NOTE] Data remains in database for inspection.")
    print("Run cleanup() to remove test data if needed.")
    
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())

