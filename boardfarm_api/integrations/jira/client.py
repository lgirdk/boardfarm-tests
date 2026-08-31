"""Jira REST API client.

Supports both Jira Data Center (direct API, PAT auth) and Jira Cloud
(api.atlassian.com, OAuth). The deployment type determines the base
URL and authentication mechanism.

Usage::

    from boardfarm_api.integrations.jira.client import JiraClient

    client = JiraClient(base_url="https://jira.lgi.nl", token="...")
    me = await client.get_myself()        # verify connection
    tickets = await client.search("project = MVX_Tests AND issuetype = XTest")

The client is instantiated per-request using the user's stored token
and the workspace's Jira configuration. It is NOT a singleton.
"""

from __future__ import annotations

# TODO: implement when Jira integration is built
#
# import httpx
# from boardfarm_api.core.types import JiraDeploymentType
#
# class JiraClient:
#     def __init__(self, base_url: str, token: str, deployment: JiraDeploymentType):
#         self._base = base_url.rstrip("/")
#         self._token = token
#         self._deployment = deployment
#         self._http = httpx.AsyncClient(
#             base_url=self._api_base,
#             headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
#         )
#
#     @property
#     def _api_base(self) -> str:
#         if self._deployment == JiraDeploymentType.CLOUD:
#             return "https://api.atlassian.com"
#         return self._base
#
#     async def get_myself(self) -> dict:
#         """GET /rest/api/2/myself — verify token, return user info."""
#
#     async def search(self, jql: str, max_results: int = 50) -> list[dict]:
#         """POST /rest/api/2/search — run a JQL query."""
#
#     async def get_ticket(self, key: str) -> dict:
#         """GET /rest/api/2/issue/{key} — full ticket with fields."""
#
#     async def get_projects(self) -> list[dict]:
#         """GET /rest/api/2/project — list accessible projects."""
#
#     async def close(self) -> None:
#         await self._http.aclose()
