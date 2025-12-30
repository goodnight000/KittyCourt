#!/usr/bin/env python3
"""
Index skills and documents into the Semantic Knowledge Registry.

Usage:
    python scripts/index.py --skills     # Index all skills
    python scripts/index.py --docs       # Index all documents
    python scripts/index.py --all        # Index everything
    python scripts/index.py --all --force  # Re-index even if unchanged
"""

import argparse
import sys
from pathlib import Path

from .config import SKILLS_DIR, DOCS_DIR
from .registry import SkillRegistry, parse_skill_frontmatter, extract_title_from_markdown


def index_skills(registry: SkillRegistry, force: bool = False) -> int:
    """
    Index all skills from the skills directory.
    
    Returns number of skills indexed.
    """
    if not SKILLS_DIR.exists():
        print(f"Skills directory not found: {SKILLS_DIR}")
        return 0
    
    count = 0
    skill_dirs = [d for d in SKILLS_DIR.iterdir() if d.is_dir()]
    
    for skill_dir in skill_dirs:
        skill_file = skill_dir / "SKILL.md"
        
        if not skill_file.exists():
            print(f"  Skipping {skill_dir.name}: no SKILL.md")
            continue
        
        content = skill_file.read_text()
        frontmatter = parse_skill_frontmatter(content)
        
        name = frontmatter.get("name", skill_dir.name)
        description = frontmatter.get("description", "")
        version = "1.0.0"  # Could parse from metadata if available
        author = frontmatter.get("author", "Agent Skills Contributors")
        
        # Extract version from content if present
        if "**Version**:" in content:
            import re
            match = re.search(r'\*\*Version\*\*:\s*(\d+\.\d+\.\d+)', content)
            if match:
                version = match.group(1)
        
        print(f"  Indexing skill: {name}")
        
        try:
            skill_id = registry.upsert_skill(
                name=name,
                description=description,
                content=content,
                path=str(skill_file.relative_to(SKILLS_DIR.parent)),
                version=version,
                author=author,
                generate_embedding_flag=True  # Generate embeddings
            )
            count += 1
            
            # Index references within the skill
            refs_dir = skill_dir / "references"
            if refs_dir.exists():
                for ref_file in refs_dir.glob("*.md"):
                    ref_content = ref_file.read_text()
                    ref_title = extract_title_from_markdown(ref_content)
                    
                    doc_id = registry.upsert_document(
                        title=f"{name}: {ref_title}",
                        content=ref_content,
                        path=str(ref_file.relative_to(SKILLS_DIR.parent)),
                        doc_type="reference"
                    )
                    
                    # Link reference to skill
                    registry.link_skill_to_document(skill_id, doc_id, relevance=0.9)
                    
        except Exception as e:
            print(f"  Error indexing {name}: {e}")
    
    return count


def index_documents(registry: SkillRegistry, force: bool = False) -> int:
    """
    Index all documents from the docs directory.
    
    Returns number of documents indexed.
    """
    if not DOCS_DIR.exists():
        print(f"Docs directory not found: {DOCS_DIR}")
        return 0
    
    count = 0
    
    # Index all markdown files in docs
    for doc_file in DOCS_DIR.rglob("*.md"):
        content = doc_file.read_text()
        
        # Parse frontmatter if present
        frontmatter = parse_skill_frontmatter(content)
        
        # Use frontmatter name if available, otherwise use filename
        if frontmatter.get("name"):
            title = frontmatter.get("name")
        else:
            filename_title = doc_file.stem.replace('_', ' ').replace('-', ' ').title()
            title = extract_title_from_markdown(content, fallback=filename_title)
        
        # Use frontmatter description if available
        description = frontmatter.get("description", "")
        
        # Get source_url from frontmatter
        source_url = frontmatter.get("source_url", "No")
        
        # Get doc_type from frontmatter, fallback to inference if not present
        doc_type = frontmatter.get("doc_type")
        if not doc_type:
            # Fallback: infer from path or filename
            doc_type = "research"
            if "blog" in doc_file.name.lower() or "blog" in title.lower():
                doc_type = "blog"
            elif "case" in doc_file.name.lower():
                doc_type = "case_study"
            elif "reference" in doc_file.name.lower() or "reference" in str(doc_file.parent).lower():
                doc_type = "reference"
        
        print(f"  Indexing document: {title}")
        
        try:
            registry.upsert_document(
                title=title,
                content=content,
                path=str(doc_file.relative_to(DOCS_DIR.parent)),
                doc_type=doc_type,
                description=description,
                source_url=source_url
            )
            count += 1
        except Exception as e:
            print(f"  Error indexing {doc_file.name}: {e}")
    
    return count


def main():
    parser = argparse.ArgumentParser(
        description="Index skills and documents into the Semantic Knowledge Registry"
    )
    parser.add_argument(
        "--skills",
        action="store_true",
        help="Index skills from skills/ directory"
    )
    parser.add_argument(
        "--docs",
        action="store_true",
        help="Index documents from docs/ directory"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Index everything"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-indexing even if content unchanged"
    )
    
    args = parser.parse_args()
    
    if not (args.skills or args.docs or args.all):
        parser.print_help()
        sys.exit(1)
    
    print("Connecting to database...")
    registry = SkillRegistry()
    
    total = 0
    
    if args.skills or args.all:
        print("\nIndexing skills...")
        count = index_skills(registry, args.force)
        print(f"  Indexed {count} skills")
        total += count
    
    if args.docs or args.all:
        print("\nIndexing documents...")
        count = index_documents(registry, args.force)
        print(f"  Indexed {count} documents")
        total += count
    
    print(f"\nTotal indexed: {total} items")
    
    # Print stats
    stats = registry.get_stats()
    print(f"\nRegistry stats:")
    print(f"  Skills: {stats['skills']} ({stats['skills_with_embedding']} with embeddings)")
    print(f"  Documents: {stats['documents']} ({stats['documents_with_embedding']} with embeddings)")
    print(f"  Skill-Document links: {stats['skill_document_links']}")


if __name__ == "__main__":
    main()

