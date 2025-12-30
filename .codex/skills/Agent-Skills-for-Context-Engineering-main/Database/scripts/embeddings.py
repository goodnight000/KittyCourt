"""Embedding generation utilities."""

import hashlib
from typing import List, Optional
import tiktoken

from openai import OpenAI

from .config import OPENAI_API_KEY, EMBEDDING_MODEL, MAX_TOKENS_PER_CHUNK


def get_embedding_client() -> OpenAI:
    """Get configured OpenAI client for embeddings."""
    if not OPENAI_API_KEY:
        raise ValueError(
            "OPENAI_API_KEY not set. "
            "Set it in environment or .env file."
        )
    return OpenAI(api_key=OPENAI_API_KEY)


def count_tokens(text: str, model: str = "cl100k_base") -> int:
    """Count tokens in text using tiktoken."""
    encoding = tiktoken.get_encoding(model)
    return len(encoding.encode(text))


def chunk_text(
    text: str,
    max_tokens: int = MAX_TOKENS_PER_CHUNK,
    overlap: int = 200
) -> List[str]:
    """
    Split text into chunks that fit within token limits.
    
    For documents longer than max_tokens, we split and embed chunks,
    then average the embeddings. This is a simple but effective approach.
    """
    token_count = count_tokens(text)
    
    if token_count <= max_tokens:
        return [text]
    
    # Split by paragraphs first
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = []
    current_tokens = 0
    
    for para in paragraphs:
        para_tokens = count_tokens(para)
        
        if current_tokens + para_tokens > max_tokens:
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
            current_chunk = [para]
            current_tokens = para_tokens
        else:
            current_chunk.append(para)
            current_tokens += para_tokens
    
    if current_chunk:
        chunks.append("\n\n".join(current_chunk))
    
    return chunks


def generate_embedding(text: str) -> List[float]:
    """
    Generate embedding for text.
    
    For long texts, chunks and averages embeddings.
    """
    client = get_embedding_client()
    chunks = chunk_text(text)
    
    if len(chunks) == 1:
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text
        )
        return response.data[0].embedding
    
    # Multiple chunks: embed each and average
    embeddings = []
    for chunk in chunks:
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=chunk
        )
        embeddings.append(response.data[0].embedding)
    
    # Average the embeddings
    avg_embedding = [
        sum(e[i] for e in embeddings) / len(embeddings)
        for i in range(len(embeddings[0]))
    ]
    
    return avg_embedding


def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for multiple texts in a batch."""
    client = get_embedding_client()
    
    # Process texts that might need chunking
    all_chunks = []
    chunk_indices = []  # Maps chunks back to original texts
    
    for idx, text in enumerate(texts):
        chunks = chunk_text(text)
        for chunk in chunks:
            all_chunks.append(chunk)
            chunk_indices.append(idx)
    
    # Batch embed all chunks (OpenAI supports up to 2048 inputs)
    embeddings = []
    batch_size = 100
    
    for i in range(0, len(all_chunks), batch_size):
        batch = all_chunks[i:i + batch_size]
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=batch
        )
        embeddings.extend([d.embedding for d in response.data])
    
    # Reconstruct: average embeddings for texts with multiple chunks
    result = []
    current_idx = -1
    current_embeddings = []
    
    for emb, idx in zip(embeddings, chunk_indices):
        if idx != current_idx:
            if current_embeddings:
                # Average and append
                avg = [
                    sum(e[i] for e in current_embeddings) / len(current_embeddings)
                    for i in range(len(current_embeddings[0]))
                ]
                result.append(avg)
            current_idx = idx
            current_embeddings = [emb]
        else:
            current_embeddings.append(emb)
    
    # Don't forget the last one
    if current_embeddings:
        if len(current_embeddings) == 1:
            result.append(current_embeddings[0])
        else:
            avg = [
                sum(e[i] for e in current_embeddings) / len(current_embeddings)
                for i in range(len(current_embeddings[0]))
            ]
            result.append(avg)
    
    return result


def content_hash(content: str) -> str:
    """Generate SHA-256 hash of content for change detection."""
    return hashlib.sha256(content.encode()).hexdigest()

