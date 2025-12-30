#!/usr/bin/env python3
"""
Re-index or delete individual skills/documents.

Usage:
    # Re-index
    python scripts/reindex.py skill tool-design
    python scripts/reindex.py doc docs/hncapsule.md
    
    # Delete
    python scripts/reindex.py delete skill tool-design
    python scripts/reindex.py delete doc docs/hncapsule.md
"""

import sys
import argparse
from pathlib import Path

from .config import SKILLS_DIR, DOCS_DIR
from .registry import SkillRegistry, parse_skill_frontmatter, extract_title_from_markdown
from .db import execute_query


def reindex_skill(skill_name: str):
    """Re-index a single skill."""
    registry = SkillRegistry()
    
    skill_dir = SKILLS_DIR / skill_name
    skill_file = skill_dir / "SKILL.md"
    
    if not skill_file.exists():
        print(f"Error: Skill file not found: {skill_file}")
        return False
    
    content = skill_file.read_text()
    frontmatter = parse_skill_frontmatter(content)
    
    name = frontmatter.get("name", skill_name)
    description = frontmatter.get("description", "")
    
    print(f"Re-indexing skill: {name}")
    
    skill_id = registry.upsert_skill(
        name=name,
        description=description,
        content=content,
        path=str(skill_file.relative_to(SKILLS_DIR.parent)),
        version="1.0.0",
        generate_embedding_flag=True
    )
    
    print(f"✓ Re-indexed: {name} (ID: {skill_id[:8]}...)")
    return True


def reindex_document(doc_path: str):
    """Re-index a single document."""
    registry = SkillRegistry()
    
    # Support both absolute and relative paths
    if doc_path.startswith("docs/"):
        doc_file = DOCS_DIR.parent / doc_path
    else:
        doc_file = DOCS_DIR / doc_path
    
    if not doc_file.exists():
        print(f"Error: Document file not found: {doc_file}")
        return False
    
    content = doc_file.read_text()
    frontmatter = parse_skill_frontmatter(content)
    
    # Get metadata from frontmatter
    name = frontmatter.get("name")
    if not name:
        filename_title = doc_file.stem.replace('_', ' ').replace('-', ' ').title()
        name = extract_title_from_markdown(content, fallback=filename_title)
    
    description = frontmatter.get("description", "")
    doc_type = frontmatter.get("doc_type", "research")
    source_url = frontmatter.get("source_url", "No")
    
    print(f"Re-indexing document: {name}")
    
    doc_id = registry.upsert_document(
        title=name,
        content=content,
        path=str(doc_file.relative_to(DOCS_DIR.parent)),
        doc_type=doc_type,
        description=description,
        source_url=source_url,
        generate_embedding_flag=True
    )
    
    print(f"✓ Re-indexed: {name} (ID: {doc_id[:8]}...)")
    return True


def delete_skill(skill_name: str):
    """Delete a single skill."""
    registry = SkillRegistry()
    
    print(f"Deleting skill: {skill_name}")
    
    if registry.delete_skill(skill_name):
        print(f"✓ Deleted: {skill_name}")
        return True
    else:
        print(f"✗ Not found: {skill_name}")
        return False


def delete_document(doc_path: str):
    """Delete a single document."""
    print(f"Deleting document: {doc_path}")
    
    result = execute_query(
        "DELETE FROM documents WHERE path = %s RETURNING id",
        (doc_path,),
        fetch=True
    )
    
    if result:
        print(f"✓ Deleted: {doc_path}")
        return True
    else:
        print(f"✗ Not found: {doc_path}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Re-index or delete individual skills/documents"
    )
    
    subparsers = parser.add_subparsers(dest="action", help="Action to perform")
    
    # Re-index commands
    reindex_parser = subparsers.add_parser("reindex", help="Re-index a skill or document")
    reindex_parser.add_argument("type", choices=["skill", "doc"], help="Type to re-index")
    reindex_parser.add_argument("identifier", help="Skill name or document path")
    
    # Delete commands
    delete_parser = subparsers.add_parser("delete", help="Delete a skill or document")
    delete_parser.add_argument("type", choices=["skill", "doc"], help="Type to delete")
    delete_parser.add_argument("identifier", help="Skill name or document path")
    
    args = parser.parse_args()
    
    if not args.action:
        parser.print_help()
        return 1
    
    success = False
    
    if args.action == "reindex":
        if args.type == "skill":
            success = reindex_skill(args.identifier)
        else:
            success = reindex_document(args.identifier)
    elif args.action == "delete":
        if args.type == "skill":
            success = delete_skill(args.identifier)
        else:
            success = delete_document(args.identifier)
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())

