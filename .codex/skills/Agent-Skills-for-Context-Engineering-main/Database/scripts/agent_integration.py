"""
Agent Integration Module

Provides the interface for agents to:
1. Analyze new documents
2. Determine if new skills are needed
3. Find skills that should be updated

This is the entry point for the agent workflow.
"""

from typing import Dict, List, Optional, Tuple
from pathlib import Path

from .registry import (
    SkillRegistry, 
    parse_skill_frontmatter, 
    extract_title_from_markdown
)


class AgentKnowledgeInterface:
    """
    Interface for agents to interact with the Knowledge Registry.
    
    Designed for the workflow:
    1. Agent receives new document
    2. Agent analyzes document and determines action
    3. Agent creates new skill or updates existing skills
    """
    
    def __init__(self):
        self.registry = SkillRegistry()
    
    def analyze_document(
        self, 
        content: str, 
        path: str,
        similarity_threshold: float = 0.7
    ) -> Dict:
        """
        Analyze a new document and determine what action to take.
        
        Returns:
            {
                "action": "create_skill" | "update_skills" | "reference_only",
                "document_id": str,
                "related_skills": [{"skill_id", "skill_name", "similarity"}],
                "recommendation": str  # Human-readable recommendation
            }
        """
        # Extract title
        title = extract_title_from_markdown(content)
        
        # Index the document
        doc_id = self.registry.upsert_document(
            title=title,
            content=content,
            path=path,
            doc_type=self._infer_doc_type(path, content)
        )
        
        # Find related skills
        related_skills = self.registry.find_related_skills(
            content, 
            threshold=similarity_threshold
        )
        
        # Determine action
        if not related_skills:
            action = "create_skill"
            recommendation = (
                f"No existing skills found related to '{title}'. "
                "Consider creating a new skill based on this document."
            )
        elif related_skills[0]["similarity"] > 0.85:
            action = "update_skills"
            top_skill = related_skills[0]["skill_name"]
            recommendation = (
                f"Document is highly similar to '{top_skill}' "
                f"(similarity: {related_skills[0]['similarity']:.2f}). "
                "Consider updating this skill with new information."
            )
        else:
            action = "reference_only"
            skill_names = [s["skill_name"] for s in related_skills[:3]]
            recommendation = (
                f"Document relates to skills: {', '.join(skill_names)}. "
                "Consider adding as a reference to these skills."
            )
        
        return {
            "action": action,
            "document_id": doc_id,
            "related_skills": [dict(s) for s in related_skills],
            "recommendation": recommendation
        }
    
    def create_skill_from_document(
        self,
        name: str,
        description: str,
        content: str,
        document_id: str,
        version: str = "1.0.0"
    ) -> str:
        """
        Create a new skill based on document content.
        
        The agent should generate the skill content based on the document.
        This method handles the registry operations.
        
        Returns the skill ID.
        """
        # Create the skill
        skill_id = self.registry.upsert_skill(
            name=name,
            description=description,
            content=content,
            path=f"skills/{name}/SKILL.md",
            version=version
        )
        
        # Link to source document
        self.registry.link_skill_to_document(
            skill_id, 
            document_id, 
            relevance=1.0
        )
        
        # Create initial version
        self.registry.create_skill_version(
            skill_id,
            version,
            content,
            change_summary="Initial version created from document"
        )
        
        return skill_id
    
    def update_skill_with_document(
        self,
        skill_id: str,
        new_content: str,
        document_id: str,
        new_version: str,
        change_summary: str
    ) -> bool:
        """
        Update an existing skill with information from a new document.
        
        The agent should generate the updated content.
        This method handles version tracking and linking.
        """
        # Get current skill
        skill = self.registry.get_skill_by_id(skill_id)
        if not skill:
            return False
        
        # Update the skill
        self.registry.upsert_skill(
            name=skill["name"],
            description=skill["description"],
            content=new_content,
            path=skill["path"],
            version=new_version,
            author=skill.get("author")
        )
        
        # Create version snapshot
        self.registry.create_skill_version(
            skill_id,
            new_version,
            new_content,
            change_summary=change_summary
        )
        
        # Link to new source document
        self.registry.link_skill_to_document(
            skill_id,
            document_id,
            relevance=0.8
        )
        
        return True
    
    def get_skill_with_sources(self, skill_name: str) -> Optional[Dict]:
        """
        Get a skill with all its source documents.
        
        Useful for agents to understand the full context of a skill.
        """
        skill = self.registry.get_skill(skill_name)
        if not skill:
            return None
        
        sources = self.registry.get_skill_sources(str(skill["id"]))
        versions = self.registry.get_skill_versions(str(skill["id"]))
        
        return {
            **skill,
            "sources": [dict(s) for s in sources],
            "versions": [dict(v) for v in versions]
        }
    
    def search(
        self, 
        query: str, 
        search_type: str = "all",
        limit: int = 10
    ) -> Dict:
        """
        Unified semantic search interface.
        
        Args:
            query: Natural language query
            search_type: "skills", "docs", or "all"
            limit: Maximum results per type
            
        Returns:
            {"skills": [...], "documents": [...]}
        """
        results = {"skills": [], "documents": []}
        
        if search_type in ["skills", "all"]:
            results["skills"] = self.registry.search_skills(query, limit=limit)
        
        if search_type in ["docs", "all"]:
            results["documents"] = self.registry.search_documents(query, limit=limit)
        
        return results
    
    def _infer_doc_type(self, path: str, content: str) -> str:
        """Infer document type from path and content."""
        path_lower = path.lower()
        
        if "blog" in path_lower:
            return "blog"
        elif "research" in path_lower:
            return "research"
        elif "case" in path_lower or "example" in path_lower:
            return "case_study"
        elif "reference" in path_lower:
            return "reference"
        else:
            return "research"


# Convenience function for agent scripts
def process_new_document(content: str, path: str) -> Dict:
    """
    Process a new document through the knowledge registry.
    
    This is the main entry point for agents receiving new documents.
    
    Example:
        result = process_new_document(doc_content, "docs/new_research.md")
        if result["action"] == "create_skill":
            # Agent generates new skill content
            ...
        elif result["action"] == "update_skills":
            # Agent updates related skills
            ...
    """
    interface = AgentKnowledgeInterface()
    return interface.analyze_document(content, path)

