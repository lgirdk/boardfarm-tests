"""Application configuration.

Reads from environment variables and TOML files. Provides a single
``AppSettings`` instance that the rest of the application imports.

Usage::

    from boardfarm_api.core.config import settings

    settings.DATABASE_URL   # → "postgresql+asyncpg://..."
    settings.SECRET_KEY     # → loaded from env
    settings.DEBUG          # → False in production

Environment variables take precedence over TOML values.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class AppSettings:
    """Central settings — populated from environment variables.

    Add fields here as the backend grows. Each field reads from
    an env var with BF_ prefix (e.g. BF_DEBUG, BF_SECRET_KEY).

    When pydantic-settings is added as a dependency, this class
    should be migrated to BaseSettings for .env file support and
    automatic type coercion.
    """

    # ── Server ──
    DEBUG: bool = field(default_factory=lambda: os.getenv("BF_DEBUG", "").lower() == "true")
    HOST: str = field(default_factory=lambda: os.getenv("BF_HOST", "0.0.0.0"))
    PORT: int = field(default_factory=lambda: int(os.getenv("BF_PORT", "8080")))

    # ── Database (placeholder — not wired yet) ──
    DATABASE_URL: str = field(
        default_factory=lambda: os.getenv("BF_DATABASE_URL", "sqlite+aiosqlite:///./boardfarm.db")
    )

    # ── Auth ──
    SECRET_KEY: str = field(default_factory=lambda: os.getenv("BF_SECRET_KEY", "change-me-in-production"))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = field(
        default_factory=lambda: int(os.getenv("BF_ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24)))
    )

    # ── AI Engine ──
    APP_CONFIG_PATH: str = field(default_factory=lambda: os.getenv("BF_APP_CONFIG_PATH", "configs/app.toml"))


settings = AppSettings()
