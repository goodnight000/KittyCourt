#!/usr/bin/env python3
"""
Setup script for Supabase database.

This script initializes the Supabase database with our schema.

Steps:
1. Get your Supabase PostgreSQL connection string from:
   Project Settings > Database > Connection string > URI
   
2. Set DATABASE_URL environment variable to your Supabase connection
   
3. Run this script to initialize the schema
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
from pgvector.psycopg2 import register_vector


def setup_supabase(database_url: str):
    """Initialize Supabase database with our schema."""
    
    print("Connecting to Supabase...")
    print(f"URL: {database_url[:50]}...")
    
    try:
        conn = psycopg2.connect(database_url)
        register_vector(conn)
        print("[CONNECTED] Successfully connected to Supabase")
    except Exception as e:
        print(f"[FAILED] Could not connect: {e}")
        return False
    
    # Read schema
    schema_path = Path(__file__).parent.parent / "schema" / "init.sql"
    if not schema_path.exists():
        print(f"[ERROR] Schema file not found: {schema_path}")
        return False
    
    schema_sql = schema_path.read_text()
    
    try:
        cursor = conn.cursor()
        
        print("\nExecuting schema...")
        cursor.execute(schema_sql)
        
        conn.commit()
        print("[SUCCESS] Schema initialized")
        
        # Verify tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        
        tables = [row[0] for row in cursor.fetchall()]
        print(f"\nTables created: {len(tables)}")
        for table in tables:
            print(f"  - {table}")
        
        # Verify pgvector
        cursor.execute("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'")
        result = cursor.fetchone()
        if result:
            print(f"\n[SUCCESS] pgvector v{result[1]} installed")
        else:
            print("\n[WARNING] pgvector extension not found")
            print("You may need to enable it in Supabase dashboard:")
            print("Database > Extensions > search for 'vector' > Enable")
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"\n[ERROR] Schema execution failed: {e}")
        conn.rollback()
        conn.close()
        return False


def main():
    print("=" * 60)
    print("Supabase Setup")
    print("=" * 60)
    print()
    
    # Check for DATABASE_URL
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("[ERROR] DATABASE_URL not set")
        print()
        print("To get your Supabase connection string:")
        print("1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT")
        print("2. Click Settings > Database")
        print("3. Copy 'Connection string' under 'URI'")
        print("4. Set DATABASE_URL environment variable")
        print()
        print("Example:")
        print('  export DATABASE_URL="postgresql://postgres.[ref]:[password]@[host]:6543/postgres"')
        print()
        return 1
    
    # Check if it's a Supabase URL
    if "supabase" not in database_url:
        print("[WARNING] DATABASE_URL doesn't appear to be a Supabase URL")
        print(f"URL: {database_url[:50]}...")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            return 1
    
    success = setup_supabase(database_url)
    
    if success:
        print("\n" + "=" * 60)
        print("Supabase is ready!")
        print("=" * 60)
        print()
        print("Next steps:")
        print("1. Index your skills:")
        print("   python -m scripts.index --all")
        print()
        print("2. Test semantic search:")
        print('   python -m scripts.search "how to design tools"')
        return 0
    else:
        print("\nSetup failed. Please check the errors above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())

