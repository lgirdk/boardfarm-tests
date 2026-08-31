"""Security utilities — JWT, password hashing, token encryption.

Provides helpers that api/ and services/ use for authentication.
Nothing in this module touches the database directly.

Usage::

    from boardfarm_api.core.security import hash_password, verify_password, create_jwt, decode_jwt

    hashed = hash_password("hunter2")
    assert verify_password("hunter2", hashed)

    token = create_jwt({"sub": "ahazra", "role": "admin"})
    payload = decode_jwt(token)
"""

from __future__ import annotations

# TODO: implement when auth service is built
# - hash_password(plain: str) -> str
# - verify_password(plain: str, hashed: str) -> bool
# - create_jwt(payload: dict, expires_minutes: int | None = None) -> str
# - decode_jwt(token: str) -> dict
# - encrypt_token(token: str) -> str   (for storing Jira PATs)
# - decrypt_token(encrypted: str) -> str
