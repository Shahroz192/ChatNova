"""
Database Migration Runner for AI Chat Pro
This script runs the database migrations to add performance indexes.
"""

import subprocess
import sys
import os
import logging


# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def run_migrations():
    """Run the database migrations to add performance indexes."""
    try:
        # Change to the backend directory
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        os.chdir(backend_dir)

        logger.info("Running database migrations to add performance indexes...")

        # Run the migration
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            logger.info("Database migrations completed successfully!")
            logger.info(result.stdout)
        else:
            logger.error("Error running migrations:")
            logger.error(result.stderr)
            return False

    except Exception as e:
        logger.error(f"Error running migrations: {e}")
        return False

    return True


if __name__ == "__main__":
    run_migrations()
