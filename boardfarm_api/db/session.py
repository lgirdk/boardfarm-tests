"""Database engine and session factory.

Creates the SQLAlchemy async engine and provides a session dependency
for FastAPI routes.

Usage in api/deps.py::

    from boardfarm_api.db.session import get_session

    async def get_db():
        async with get_session() as session:
            yield session
"""

from __future__ import annotations

# TODO: implement when database is needed
# - create_engine() from settings.DATABASE_URL
# - AsyncSession factory
# - get_session() async context manager
# - init_db() for creating tables (dev only; production uses Alembic)
