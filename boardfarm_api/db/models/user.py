"""User table — authentication and role management.

Fields:
    id              UUID primary key (auto-generated)
    username        Unique login name
    display_name    Human-readable name shown in the UI
    email           Optional, used for notifications
    password_hash   bcrypt hash — never exposed in API responses
    role            "admin" or "user" (from core.types.UserRole)
    is_active       Soft-delete flag
    created_at      Timestamp
    last_login_at   Timestamp, nullable
"""

from __future__ import annotations

# TODO: implement with SQLModel when database is wired
#
# from datetime import datetime
# from uuid import UUID, uuid4
# from sqlmodel import Field, SQLModel
# from boardfarm_api.core.types import UserRole
#
# class User(SQLModel, table=True):
#     id: UUID = Field(default_factory=uuid4, primary_key=True)
#     username: str = Field(unique=True, index=True)
#     display_name: str = ""
#     email: str | None = None
#     password_hash: str
#     role: UserRole = UserRole.USER
#     is_active: bool = True
#     created_at: datetime = Field(default_factory=datetime.utcnow)
#     last_login_at: datetime | None = None


class User:
    """Placeholder until SQLModel is wired."""

    pass
