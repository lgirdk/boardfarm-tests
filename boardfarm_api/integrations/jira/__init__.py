"""Jira integration — REST API client for Cloud and Data Center.

Handles authentication (PAT for DC, OAuth for Cloud), ticket search,
project listing, and test plan resolution. The workspace admin
configures the deployment type and base URL; users provide their
personal credentials.

Modules:
    client      JiraClient class with search, get_ticket, get_projects, etc.
"""
