"""Authentication service — login, logout, user management.

Handles credential verification, JWT issuance, and user CRUD.
Does NOT know about HTTP — that's the router's job.

Usage from a router::

    from boardfarm_api.services import auth

    user = await auth.login(db, username="ahazra", password="...")
    token = auth.create_access_token(user)
"""

from __future__ import annotations

# TODO: implement when database + security are wired
#
# async def login(db, username: str, password: str) -> User:
#     """Verify credentials and return the user, or raise ForbiddenError."""
#
# async def create_user(db, username: str, password: str, role: UserRole) -> User:
#     """Create a new user. Raises ConflictError if username taken."""
#
# def create_access_token(user: User) -> str:
#     """Issue a JWT for the given user."""
#
# def decode_access_token(token: str) -> dict:
#     """Decode and validate a JWT. Raises ForbiddenError if invalid/expired."""
