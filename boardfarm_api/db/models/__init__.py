"""Database table models — one file per entity.

Each model inherits from SQLModel and defines a database table.
Import all models here so Alembic can discover them for migrations.

Models:
    User            User accounts (id, username, role, password_hash, …)
    # Future:
    # Run           Test execution records
    # TestAsset     Git-backed test catalog (synced)
    # Artifact      Generated drafts and code
    # Environment   Provisioning descriptors
    # Schedule      Cron-based run schedules
    # JiraToken     Encrypted per-user Jira credentials
    # WorkspaceConfig  Admin-level settings (Jira deployment, Git URL, …)
"""

from boardfarm_api.db.models.user import User  # noqa: F401
