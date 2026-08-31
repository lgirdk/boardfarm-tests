"""Database layer — SQLModel tables, session factory, migrations.

Dependency rule: db/ imports only from core/. Never from api/,
services/, or integrations/.

Modules:
    session     Engine creation, async session factory, get_session dependency.
    base        Shared base model class with common columns (id, timestamps).
    models/     One file per database table.
"""
