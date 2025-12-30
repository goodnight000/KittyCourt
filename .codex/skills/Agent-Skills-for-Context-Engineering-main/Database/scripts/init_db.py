#!/usr/bin/env python3
"""
Initialize the database schema.

This script is typically run once to set up the database,
but can be safely re-run as all statements use IF NOT EXISTS.

Usage:
    python scripts/init_db.py
"""

from pathlib import Path
import psycopg2
from pgvector.psycopg2 import register_vector

from .config import DATABASE_URL


def init_database():
    """Initialize the database with the schema."""
    schema_path = Path(__file__).parent.parent / "schema" / "init.sql"
    
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema file not found: {schema_path}")
    
    schema_sql = schema_path.read_text()
    
    print(f"Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)
    register_vector(conn)
    
    try:
        cursor = conn.cursor()
        
        print("Executing schema...")
        cursor.execute(schema_sql)
        
        conn.commit()
        print("Schema initialized successfully.")
        
        # Verify tables exist
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        
        tables = [row[0] for row in cursor.fetchall()]
        print(f"\nTables created: {', '.join(tables)}")
        
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


def main():
    try:
        init_database()
    except Exception as e:
        print(f"Error initializing database: {e}")
        raise


if __name__ == "__main__":
    main()

