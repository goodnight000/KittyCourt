#!/usr/bin/env python3
"""
Semantic search CLI for the Knowledge Registry.

Usage:
    python scripts/search.py "how to design agent tools"
    python scripts/search.py "context optimization" --type skills --limit 5
    python scripts/search.py "memory systems" --type docs --threshold 0.6
"""

import argparse
import sys
import json

from .registry import SkillRegistry


def format_skill_result(skill: dict) -> str:
    """Format a skill search result for display."""
    return (
        f"\n  [{skill['similarity']:.3f}] {skill['name']}\n"
        f"           {skill['description'][:80]}...\n"
        f"           Path: {skill['path']}"
    )


def format_document_result(doc: dict) -> str:
    """Format a document search result for display."""
    return (
        f"\n  [{doc['similarity']:.3f}] {doc['title']}\n"
        f"           Type: {doc['doc_type']}\n"
        f"           Path: {doc['path']}"
    )


def main():
    parser = argparse.ArgumentParser(
        description="Semantic search for skills and documents"
    )
    parser.add_argument(
        "query",
        help="Natural language search query"
    )
    parser.add_argument(
        "--type",
        choices=["skills", "docs", "all"],
        default="all",
        help="Type of content to search"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Maximum number of results"
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.7,
        help="Minimum similarity threshold (0-1)"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON"
    )
    
    args = parser.parse_args()
    
    registry = SkillRegistry()
    
    results = {"skills": [], "documents": []}
    
    if args.type in ["skills", "all"]:
        skills = registry.search_skills(
            args.query,
            threshold=args.threshold,
            limit=args.limit
        )
        results["skills"] = skills
    
    if args.type in ["docs", "all"]:
        docs = registry.search_documents(
            args.query,
            threshold=args.threshold,
            limit=args.limit
        )
        results["documents"] = docs
    
    if args.json:
        # Convert UUIDs to strings for JSON serialization
        for skill in results["skills"]:
            skill["id"] = str(skill["id"])
        for doc in results["documents"]:
            doc["id"] = str(doc["id"])
        print(json.dumps(results, indent=2, default=str))
        return
    
    # Human-readable output
    print(f"\nSearch: \"{args.query}\"")
    print(f"Threshold: {args.threshold}, Limit: {args.limit}")
    
    if results["skills"]:
        print(f"\n{'='*60}")
        print(f"SKILLS ({len(results['skills'])} results)")
        print(f"{'='*60}")
        for skill in results["skills"]:
            print(format_skill_result(skill))
    
    if results["documents"]:
        print(f"\n{'='*60}")
        print(f"DOCUMENTS ({len(results['documents'])} results)")
        print(f"{'='*60}")
        for doc in results["documents"]:
            print(format_document_result(doc))
    
    if not results["skills"] and not results["documents"]:
        print("\nNo results found. Try lowering the threshold with --threshold 0.5")


if __name__ == "__main__":
    main()

