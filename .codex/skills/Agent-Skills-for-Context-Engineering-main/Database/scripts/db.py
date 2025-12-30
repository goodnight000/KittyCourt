"""Database connection and utilities."""

from contextlib import contextmanager
from typing import Generator, Optional, Any
import psycopg2
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector

from .config import DATABASE_URL


def get_connection():
    """Get a database connection with pgvector support."""
    conn = psycopg2.connect(DATABASE_URL)
    register_vector(conn)
    return conn


@contextmanager
def get_cursor(commit: bool = True) -> Generator[RealDictCursor, None, None]:
    """Context manager for database operations."""
    conn = get_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        yield cursor
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def execute_query(
    query: str,
    params: Optional[tuple] = None,
    fetch: bool = True
) -> list:
    """Execute a query and optionally fetch results."""
    with get_cursor() as cur:
        cur.execute(query, params)
        if fetch:
            return cur.fetchall()
        return []


def execute_many(query: str, params_list: list) -> None:
    """Execute a query with multiple parameter sets."""
    with get_cursor() as cur:
        cur.executemany(query, params_list)

