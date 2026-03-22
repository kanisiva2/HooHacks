"""
Jira REST API v3 client.
Functions: create_jira_issue, update_jira_assignee, get_jira_projects, get_jira_users.
Descriptions MUST use Atlassian Document Format (ADF) — plain strings are rejected.
"""

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

JIRA_API_TPL = "https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3"


def _base_url(cloud_id: str) -> str:
    return JIRA_API_TPL.format(cloud_id=cloud_id)


def _headers(access_token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def build_adf_description(
    text: str, source_transcript: str | None = None
) -> dict[str, Any]:
    """Convert a plain-text description into Atlassian Document Format (ADF)."""
    content: list[dict] = [
        {"type": "paragraph", "content": [{"type": "text", "text": text}]}
    ]
    if source_transcript:
        content.append(
            {
                "type": "paragraph",
                "content": [
                    {
                        "type": "text",
                        "text": "Source: ",
                        "marks": [{"type": "strong"}],
                    },
                    {"type": "text", "text": source_transcript},
                ],
            }
        )
    return {"type": "doc", "version": 1, "content": content}


async def create_jira_issue(
    access_token: str,
    cloud_id: str,
    project_key: str,
    summary: str,
    description: str,
    issue_type: str = "Task",
    assignee_account_id: str | None = None,
    priority: str = "Medium",
) -> dict:
    """Create a Jira issue. Returns {"key": "PROJ-123", "id": "...", "self": "..."}."""
    url = f"{_base_url(cloud_id)}/issue"
    fields: dict[str, Any] = {
        "project": {"key": project_key},
        "summary": summary,
        "description": build_adf_description(description),
        "issuetype": {"name": issue_type},
        "priority": {"name": priority},
    }
    if assignee_account_id:
        fields["assignee"] = {"accountId": assignee_account_id}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            url, headers=_headers(access_token), json={"fields": fields}
        )
        resp.raise_for_status()
    return resp.json()


async def update_jira_assignee(
    access_token: str,
    cloud_id: str,
    issue_key: str,
    assignee_account_id: str,
) -> None:
    """Reassign an existing Jira issue."""
    url = f"{_base_url(cloud_id)}/issue/{issue_key}"
    body = {"fields": {"assignee": {"accountId": assignee_account_id}}}
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.put(url, headers=_headers(access_token), json=body)
        resp.raise_for_status()


async def get_jira_projects(
    access_token: str, cloud_id: str
) -> list[dict]:
    """Return projects accessible in the connected Jira site."""
    url = f"{_base_url(cloud_id)}/project"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers=_headers(access_token))
        resp.raise_for_status()
    return [{"key": p["key"], "name": p["name"]} for p in resp.json()]


async def get_jira_users(
    access_token: str, cloud_id: str, query: str
) -> list[dict]:
    """Search Jira users by display name for mapping spoken names to account IDs."""
    url = f"{_base_url(cloud_id)}/user/search"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            url,
            headers=_headers(access_token),
            params={"query": query},
        )
        resp.raise_for_status()
    return [
        {
            "accountId": u["accountId"],
            "displayName": u.get("displayName", ""),
            "emailAddress": u.get("emailAddress", ""),
        }
        for u in resp.json()
    ]
