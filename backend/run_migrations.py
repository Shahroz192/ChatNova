"""
Database Migration Runner for AI Chat Pro
This script runs the database migrations to add performance indexes.
"""

import subprocess
import sys
import os


def run_migrations():
    """Run the database migrations to add performance indexes."""
    try:
        # Change to the backend directory
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        os.chdir(backend_dir)

        print("Running database migrations to add performance indexes...")

        # Run the migration
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            print("Database migrations completed successfully!")
            print(result.stdout)
        else:
            print("Error running migrations:")
            print(result.stderr)
            return False

    except Exception as e:
        print(f"Error running migrations: {e}")
        return False

    return True


if __name__ == "__main__":
    run_migrations()
