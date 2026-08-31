"""Shared enums and type aliases used across multiple layers.

Import from here instead of defining enums locally in services or models.
This prevents circular imports and keeps definitions in one place.
"""

from __future__ import annotations

from enum import StrEnum


class UserRole(StrEnum):
    ADMIN = "admin"
    USER = "user"


class RunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    AWAITING_APPROVAL = "awaiting_approval"


class BedStatus(StrEnum):
    FREE = "free"
    IN_USE = "in_use"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"


class ArtifactStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"


class JiraDeploymentType(StrEnum):
    CLOUD = "cloud"
    DATA_CENTER = "data_center"


class JiraAuthMethod(StrEnum):
    PAT = "pat"
    OAUTH = "oauth"
