"""
Semantic Knowledge Registry

Core API for skill and document management with semantic search.
"""

from typing import List, Dict, Optional, Any
from pathlib import Path
import re
import yaml

from .db import get_cursor, execute_query
from .embeddings import generate_embedding, content_hash
from .config import EMBEDDING_DIMENSION


class SkillRegistry:
    """
    Main interface for the Semantic Knowledge Registry.
    
    Handles skill and document CRUD operations with semantic embeddings.
    """
    
    def __init__(self):
        self._verify_connection()
    
    def _verify_connection(self):
        """Verify database connection works."""
        try:
            execute_query("SELECT 1", fetch=True)
        except Exception as e:
            raise ConnectionError(
                f"Could not connect to database. Is it running? Error: {e}"
            )
    
    # -------------------------------------------------------------------------
    # Skills
    # -------------------------------------------------------------------------
    
    def upsert_skill(
        self,
        name: str,
        description: str,
        content: str,
        path: str,
        version: str = "1.0.0",
        author: Optional[str] = None,
        generate_embedding_flag: bool = True
    ) -> str:
        """
        Insert or update a skill.
        
        Returns the skill ID.
        """
        embedding = None
        if generate_embedding_flag:
            # Embed description + first part of content for semantic search
            embed_text = f"{name}: {description}\n\n{content[:4000]}"
            embedding = generate_embedding(embed_text)
        
        query = """
            INSERT INTO skills (name, description, content, path, version, author, embedding)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (name) DO UPDATE SET
                description = EXCLUDED.description,
                content = EXCLUDED.content,
                path = EXCLUDED.path,
                version = EXCLUDED.version,
                author = EXCLUDED.author,
                embedding = EXCLUDED.embedding
            RETURNING id
        """
        
        with get_cursor() as cur:
            cur.execute(query, (name, description, content, path, version, author, embedding))
            result = cur.fetchone()
            return str(result["id"])
    
    def get_skill(self, name: str) -> Optional[Dict]:
        """Get a skill by name."""
        results = execute_query(
            "SELECT id, name, description, content, path, version, author, created_at, updated_at "
            "FROM skills WHERE name = %s",
            (name,)
        )
        return dict(results[0]) if results else None
    
    def get_skill_by_id(self, skill_id: str) -> Optional[Dict]:
        """Get a skill by ID."""
        results = execute_query(
            "SELECT id, name, description, content, path, version, author, created_at, updated_at "
            "FROM skills WHERE id = %s",
            (skill_id,)
        )
        return dict(results[0]) if results else None
    
    def list_skills(self) -> List[Dict]:
        """List all skills with basic info."""
        return execute_query(
            "SELECT id, name, description, version, path, updated_at "
            "FROM skills ORDER BY name"
        )
    
    def delete_skill(self, name: str) -> bool:
        """Delete a skill by name."""
        with get_cursor() as cur:
            cur.execute("DELETE FROM skills WHERE name = %s RETURNING id", (name,))
            return cur.fetchone() is not None
    
    def search_skills(
        self,
        query: str,
        threshold: float = 0.7,
        limit: int = 10
    ) -> List[Dict]:
        """
        Semantic search for skills.
        
        Args:
            query: Natural language search query
            threshold: Minimum similarity score (0-1)
            limit: Maximum number of results
            
        Returns:
            List of skills with similarity scores
        """
        query_embedding = generate_embedding(query)
        
        # Direct query with proper vector casting
        results = execute_query(
            """
            SELECT 
                id,
                name,
                description,
                path,
                1 - (embedding <=> %s::vector) AS similarity
            FROM skills
            WHERE embedding IS NOT NULL
              AND 1 - (embedding <=> %s::vector) > %s
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (query_embedding, query_embedding, threshold, query_embedding, limit)
        )
        
        return [dict(r) for r in results]
    
    def find_related_skills(
        self,
        content: str,
        threshold: float = 0.7
    ) -> List[Dict]:
        """
        Find skills related to given content.
        
        Useful for determining which skills might need updates
        when a new document is added.
        """
        content_embedding = generate_embedding(content[:8000])
        
        # Direct query with proper vector casting
        results = execute_query(
            """
            SELECT 
                id as skill_id,
                name as skill_name,
                1 - (embedding <=> %s::vector) AS similarity
            FROM skills
            WHERE embedding IS NOT NULL
              AND 1 - (embedding <=> %s::vector) > %s
            ORDER BY embedding <=> %s::vector
            """,
            (content_embedding, content_embedding, threshold, content_embedding)
        )
        
        return [dict(r) for r in results]
    
    # -------------------------------------------------------------------------
    # Documents
    # -------------------------------------------------------------------------
    
    def upsert_document(
        self,
        title: str,
        content: str,
        path: str,
        doc_type: str = "reference",
        description: str = "",
        source_url: str = "No",
        generate_embedding_flag: bool = True
    ) -> str:
        """
        Insert or update a document.
        
        Returns the document ID.
        """
        doc_hash = content_hash(content)
        
        # Check if document exists and content unchanged
        existing = execute_query(
            "SELECT id, content_hash FROM documents WHERE path = %s",
            (path,)
        )
        
        if existing and existing[0]["content_hash"] == doc_hash:
            # Content unchanged, skip update
            return str(existing[0]["id"])
        
        embedding = None
        if generate_embedding_flag:
            # Embed title + first part of content
            embed_text = f"{title}\n\n{content[:8000]}"
            embedding = generate_embedding(embed_text)
        
        query = """
            INSERT INTO documents (title, content, path, content_hash, doc_type, description, source_url, embedding)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (path) DO UPDATE SET
                title = EXCLUDED.title,
                content = EXCLUDED.content,
                content_hash = EXCLUDED.content_hash,
                doc_type = EXCLUDED.doc_type,
                description = EXCLUDED.description,
                source_url = EXCLUDED.source_url,
                embedding = EXCLUDED.embedding
            RETURNING id
        """
        
        with get_cursor() as cur:
            cur.execute(query, (title, content, path, doc_hash, doc_type, description, source_url, embedding))
            result = cur.fetchone()
            return str(result["id"])
    
    def get_document(self, path: str) -> Optional[Dict]:
        """Get a document by path."""
        results = execute_query(
            "SELECT id, title, content, path, doc_type, content_hash, created_at, updated_at "
            "FROM documents WHERE path = %s",
            (path,)
        )
        return dict(results[0]) if results else None
    
    def list_documents(self, doc_type: Optional[str] = None) -> List[Dict]:
        """List all documents, optionally filtered by type."""
        if doc_type:
            return execute_query(
                "SELECT id, title, path, doc_type, updated_at "
                "FROM documents WHERE doc_type = %s ORDER BY title",
                (doc_type,)
            )
        return execute_query(
            "SELECT id, title, path, doc_type, updated_at "
            "FROM documents ORDER BY title"
        )
    
    def search_documents(
        self,
        query: str,
        threshold: float = 0.7,
        limit: int = 10
    ) -> List[Dict]:
        """Semantic search for documents."""
        query_embedding = generate_embedding(query)
        
        # Direct query with proper vector casting
        results = execute_query(
            """
            SELECT 
                id,
                title,
                path,
                doc_type,
                1 - (embedding <=> %s::vector) AS similarity
            FROM documents
            WHERE embedding IS NOT NULL
              AND 1 - (embedding <=> %s::vector) > %s
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (query_embedding, query_embedding, threshold, query_embedding, limit)
        )
        
        return [dict(r) for r in results]
    
    # -------------------------------------------------------------------------
    # Skill-Document Links
    # -------------------------------------------------------------------------
    
    def link_skill_to_document(
        self,
        skill_id: str,
        document_id: str,
        relevance: float = 1.0
    ) -> None:
        """Link a skill to a source document."""
        with get_cursor() as cur:
            cur.execute(
                """
                INSERT INTO skill_sources (skill_id, document_id, relevance)
                VALUES (%s, %s, %s)
                ON CONFLICT (skill_id, document_id) DO UPDATE SET
                    relevance = EXCLUDED.relevance
                """,
                (skill_id, document_id, relevance)
            )
    
    def get_skill_sources(self, skill_id: str) -> List[Dict]:
        """Get all source documents for a skill."""
        return execute_query(
            """
            SELECT d.id, d.title, d.path, d.doc_type, ss.relevance
            FROM documents d
            JOIN skill_sources ss ON d.id = ss.document_id
            WHERE ss.skill_id = %s
            ORDER BY ss.relevance DESC
            """,
            (skill_id,)
        )
    
    def get_document_skills(self, document_id: str) -> List[Dict]:
        """Get all skills that use a document as source."""
        return execute_query(
            """
            SELECT s.id, s.name, s.description, ss.relevance
            FROM skills s
            JOIN skill_sources ss ON s.id = ss.skill_id
            WHERE ss.document_id = %s
            ORDER BY ss.relevance DESC
            """,
            (document_id,)
        )
    
    # -------------------------------------------------------------------------
    # Skill Versions
    # -------------------------------------------------------------------------
    
    def create_skill_version(
        self,
        skill_id: str,
        version: str,
        content: str,
        change_summary: Optional[str] = None
    ) -> str:
        """Create a version snapshot for a skill."""
        with get_cursor() as cur:
            cur.execute(
                """
                INSERT INTO skill_versions (skill_id, version, content, change_summary)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (skill_id, version, content, change_summary)
            )
            result = cur.fetchone()
            return str(result["id"])
    
    def get_skill_versions(self, skill_id: str) -> List[Dict]:
        """Get version history for a skill."""
        return execute_query(
            """
            SELECT id, version, change_summary, created_at
            FROM skill_versions
            WHERE skill_id = %s
            ORDER BY created_at DESC
            """,
            (skill_id,)
        )
    
    # -------------------------------------------------------------------------
    # Utilities
    # -------------------------------------------------------------------------
    
    def get_stats(self) -> Dict:
        """Get registry statistics."""
        skills = execute_query("SELECT COUNT(*) as count FROM skills")[0]["count"]
        skills_with_embedding = execute_query(
            "SELECT COUNT(*) as count FROM skills WHERE embedding IS NOT NULL"
        )[0]["count"]
        
        documents = execute_query("SELECT COUNT(*) as count FROM documents")[0]["count"]
        documents_with_embedding = execute_query(
            "SELECT COUNT(*) as count FROM documents WHERE embedding IS NOT NULL"
        )[0]["count"]
        
        links = execute_query("SELECT COUNT(*) as count FROM skill_sources")[0]["count"]
        
        return {
            "skills": skills,
            "skills_with_embedding": skills_with_embedding,
            "documents": documents,
            "documents_with_embedding": documents_with_embedding,
            "skill_document_links": links
        }


def parse_skill_frontmatter(content: str) -> Dict[str, Any]:
    """
    Parse YAML frontmatter from skill content.
    
    Extracts name, description, and other metadata from the --- block.
    """
    match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
    if match:
        try:
            return yaml.safe_load(match.group(1))
        except yaml.YAMLError:
            return {}
    return {}


def extract_title_from_markdown(content: str, fallback: str = "Untitled") -> str:
    """
    Extract title from markdown content.
    
    Tries in order:
    1. First # heading
    2. First non-empty line (for docs without headings)
    3. Fallback value
    """
    # Try # heading first
    match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    
    # Try first non-empty, non-whitespace line
    lines = content.strip().split('\n')
    for line in lines[:5]:  # Check first 5 lines
        line = line.strip()
        if line and not line.startswith('---'):  # Skip frontmatter markers
            # Clean up: remove markdown formatting
            line = re.sub(r'^\(+', '', line)  # Remove leading parentheses
            line = re.sub(r'\)+$', '', line)  # Remove trailing parentheses
            line = line.strip()
            if len(line) > 3 and len(line) < 100:
                return line[:80]  # Truncate long titles
    
    return fallback

