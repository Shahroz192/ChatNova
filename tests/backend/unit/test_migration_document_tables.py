from pathlib import Path


def test_document_tables_migration_includes_message_id():
    repo_root = Path(__file__).resolve().parents[3]
    migration_path = repo_root / "backend" / "alembic" / "versions" / "cbdc66c5ab65_create_document_tables.py"
    migration_text = migration_path.read_text(encoding="utf-8")

    assert "message_id" in migration_text
    assert "messages.id" in migration_text
    assert "SET NULL" in migration_text
