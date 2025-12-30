#!/usr/bin/env python3
"""
Interactive Supabase configuration.

This script securely prompts for your Supabase password and updates .env
"""

import os
import getpass
from pathlib import Path


def configure_supabase():
    """Configure Supabase connection interactively."""
    
    print("=" * 60)
    print("Supabase Configuration")
    print("=" * 60)
    print()
    
    # Supabase connection details
    project_ref = "cppdscqtkzuiwqdiumdq"
    host = f"db.{project_ref}.supabase.co"
    port = "5432"
    database = "postgres"
    user = "postgres"
    
    print(f"Project: {project_ref}")
    print(f"Host: {host}")
    print()
    
    # Get password securely
    password = getpass.getpass("Enter your Supabase database password: ")
    
    if not password:
        print("\n[ERROR] Password cannot be empty")
        return False
    
    # Build connection string
    connection_string = f"postgresql://{user}:{password}@{host}:{port}/{database}"
    
    # Update .env file
    env_file = Path(__file__).parent.parent / ".env"
    
    # Read existing .env
    env_lines = []
    if env_file.exists():
        with open(env_file, 'r') as f:
            env_lines = [line for line in f.readlines() if not line.startswith('DATABASE_URL=')]
    
    # Add new DATABASE_URL
    env_lines.append(f"DATABASE_URL={connection_string}\n")
    
    # Write back
    with open(env_file, 'w') as f:
        f.writelines(env_lines)
    
    print("\n[SUCCESS] Configuration saved to .env")
    print(f"\nConnection string: postgresql://{user}:****@{host}:{port}/{database}")
    
    return True


def main():
    success = configure_supabase()
    
    if success:
        print("\n" + "=" * 60)
        print("Next Steps")
        print("=" * 60)
        print()
        print("1. Enable pgvector extension in Supabase:")
        print("   https://supabase.com/dashboard/project/cppdscqtkzuiwqdiumdq/database/extensions")
        print("   Search for 'vector' and click Enable")
        print()
        print("2. Initialize the database:")
        print("   python -m scripts.setup_supabase")
        print()
        print("3. Index your skills:")
        print("   python -m scripts.index --all")
        print()
        return 0
    else:
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(main())

