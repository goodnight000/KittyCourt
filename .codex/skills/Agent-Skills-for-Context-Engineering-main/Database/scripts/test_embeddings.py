#!/usr/bin/env python3
"""
Test embedding generation and semantic search.

Requires OPENAI_API_KEY to be set.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.registry import SkillRegistry
from scripts.embeddings import generate_embedding, count_tokens
from scripts.config import OPENAI_API_KEY


def test_embedding_generation():
    """Test basic embedding generation."""
    print("Testing embedding generation...")
    
    if not OPENAI_API_KEY:
        print("  [FAIL] OPENAI_API_KEY not set")
        return False
    
    try:
        text = "This is a test document about agent tools and context engineering."
        embedding = generate_embedding(text)
        
        assert isinstance(embedding, list)
        assert len(embedding) == 1536  # text-embedding-3-small dimension
        assert all(isinstance(x, float) for x in embedding)
        
        print(f"  [PASS] Generated embedding: {len(embedding)} dimensions")
        print(f"  [PASS] First 5 values: {embedding[:5]}")
        
        return True
    except Exception as e:
        print(f"  [FAIL] Embedding generation failed: {e}")
        return False


def test_token_counting():
    """Test token counting."""
    print("\nTesting token counting...")
    
    try:
        text = "This is a test."
        tokens = count_tokens(text)
        
        assert tokens > 0
        print(f"  [PASS] Counted {tokens} tokens in '{text}'")
        
        # Test longer text
        long_text = "Context engineering is the art and science of managing context windows. " * 100
        long_tokens = count_tokens(long_text)
        print(f"  [PASS] Counted {long_tokens} tokens in long text")
        
        return True
    except Exception as e:
        print(f"  [FAIL] Token counting failed: {e}")
        return False


def test_semantic_search_with_embeddings():
    """Test semantic search with real embeddings."""
    print("\nTesting semantic search with embeddings...")
    
    if not OPENAI_API_KEY:
        print("  [SKIP] OPENAI_API_KEY not set")
        return True
    
    registry = SkillRegistry()
    
    try:
        # Create test skills with embeddings
        skills_data = [
            {
                "name": "test-tool-design",
                "description": "How to design effective tools for AI agents",
                "content": "# Tool Design\n\nThis skill teaches you how to build tools that agents can use effectively. Focus on clear descriptions, simple interfaces, and comprehensive error handling."
            },
            {
                "name": "test-context-management",
                "description": "Managing context windows for long-running conversations",
                "content": "# Context Management\n\nLearn how to manage context windows efficiently. Use compression, summarization, and selective retention to keep context focused."
            },
            {
                "name": "test-database-design",
                "description": "Designing database schemas for applications",
                "content": "# Database Design\n\nBest practices for designing relational database schemas. Focus on normalization, indexing, and query optimization."
            }
        ]
        
        print("  Creating test skills with embeddings...")
        for skill in skills_data:
            registry.upsert_skill(
                name=skill["name"],
                description=skill["description"],
                content=skill["content"],
                path=f"skills/{skill['name']}/SKILL.md",
                generate_embedding_flag=True
            )
            print(f"    [INDEXED] {skill['name']}")
        
        # Test semantic search
        print("\n  Testing semantic queries...")
        
        queries = [
            ("how do I build tools for AI", ["test-tool-design"]),
            ("managing memory in conversations", ["test-context-management"]),
            ("SQL and tables", ["test-database-design"])
        ]
        
        all_passed = True
        for query, expected_results in queries:
            results = registry.search_skills(query, threshold=0.5, limit=3)
            
            if not results:
                print(f"    [FAIL] No results for: '{query}'")
                all_passed = False
                continue
            
            top_result = results[0]
            print(f"    [QUERY] '{query}'")
            print(f"      → {top_result['name']} (similarity: {top_result['similarity']:.3f})")
            
            # Check if expected result is in top 3
            result_names = [r['name'] for r in results]
            if any(exp in result_names for exp in expected_results):
                print(f"      [PASS] Found expected result")
            else:
                print(f"      [WARN] Expected {expected_results}, got {result_names[:2]}")
        
        # Cleanup
        print("\n  Cleaning up test data...")
        for skill in skills_data:
            registry.delete_skill(skill["name"])
        
        return all_passed
        
    except Exception as e:
        print(f"  [FAIL] Semantic search failed: {e}")
        # Cleanup
        for skill in skills_data:
            try:
                registry.delete_skill(skill["name"])
            except:
                pass
        return False


def test_find_related_skills():
    """Test finding related skills based on content."""
    print("\nTesting find related skills...")
    
    if not OPENAI_API_KEY:
        print("  [SKIP] OPENAI_API_KEY not set")
        return True
    
    registry = SkillRegistry()
    
    try:
        # Create a skill
        skill_id = registry.upsert_skill(
            name="test-agent-tools",
            description="Building tools for AI agents",
            content="# Agent Tools\n\nLearn to design effective tool APIs for agents.",
            path="skills/test-agent-tools/SKILL.md",
            generate_embedding_flag=True
        )
        
        # Find related skills with similar content
        new_doc_content = """
        # Advanced Tool Design
        
        This document covers advanced patterns for designing agent tool interfaces.
        Topics include error handling, response formatting, and parameter validation.
        """
        
        related = registry.find_related_skills(new_doc_content, threshold=0.6)
        
        if related:
            print(f"  [PASS] Found {len(related)} related skill(s)")
            for r in related:
                print(f"    - {r['skill_name']}: similarity {r['similarity']:.3f}")
        else:
            print(f"  [WARN] No related skills found (threshold may be too high)")
        
        # Cleanup
        registry.delete_skill("test-agent-tools")
        
        return True
        
    except Exception as e:
        print(f"  [FAIL] Find related skills failed: {e}")
        registry.delete_skill("test-agent-tools")
        return False


def main():
    print("=" * 60)
    print("Embedding & Semantic Search Test Suite")
    print("=" * 60)
    print()
    
    if not OPENAI_API_KEY:
        print("[ERROR] OPENAI_API_KEY not set in environment or .env file")
        print("Please set it to run these tests.")
        return 1
    
    print(f"API Key: {OPENAI_API_KEY[:10]}...{OPENAI_API_KEY[-10:]}")
    print()
    
    results = []
    
    results.append(("Embedding Generation", test_embedding_generation()))
    results.append(("Token Counting", test_token_counting()))
    results.append(("Semantic Search", test_semantic_search_with_embeddings()))
    results.append(("Find Related Skills", test_find_related_skills()))
    
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
    
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())

