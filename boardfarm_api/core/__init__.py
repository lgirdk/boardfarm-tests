"""Core — shared infrastructure used across all layers.

This package provides foundational utilities that every other package
in boardfarm_api may import. Nothing in core/ imports from api/,
services/, integrations/, or db/. It is the leaf of the dependency graph.

Modules:
    config      Application configuration (env vars + TOML).
    security    JWT encoding/decoding, password hashing, token encryption.
    exceptions  Application-wide exception hierarchy.
    types       Shared enums and type aliases (UserRole, RunStatus, …).
"""
