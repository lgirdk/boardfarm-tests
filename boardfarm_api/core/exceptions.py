"""Application-wide exception hierarchy.

All custom exceptions inherit from ``BoardfarmError`` so callers can
catch the whole family with a single except clause. The API layer
maps these to HTTP status codes in error handlers.

Hierarchy::

    BoardfarmError
    ├── NotFoundError          → 404
    ├── ForbiddenError         → 403
    ├── ConflictError          → 409
    ├── ValidationError        → 422
    └── IntegrationError       → 502 (Jira, Git, boardfarm CLI)
"""

from __future__ import annotations


class BoardfarmError(Exception):
    """Base for all application errors."""


class NotFoundError(BoardfarmError):
    """The requested resource does not exist."""


class ForbiddenError(BoardfarmError):
    """The current user lacks permission for this action."""


class ConflictError(BoardfarmError):
    """The operation conflicts with existing state (e.g. duplicate name)."""


class InvalidInputError(BoardfarmError):
    """Input failed domain validation (beyond what Pydantic catches)."""


class IntegrationError(BoardfarmError):
    """An external system (Jira, Git, boardfarm CLI) returned an error."""
