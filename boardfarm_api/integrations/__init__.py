"""External system adapters — Jira, Git, boardfarm CLI.

Each integration is a subpackage with a client module that handles
HTTP calls to the external API. Integrations never touch the database
directly — services/ coordinates persistence.

Dependency rule: integrations/ imports only from core/.
Never from api/, services/, db/, or ai_engine/.

Subpackages:
    jira/       Jira REST API client (PAT and OAuth authentication)
    # Future:
    # git/      GitLab / GitHub / Gerrit client (for publishing drafts)
    # boardfarm/  boardfarm3 inventory reader + run executor
"""
