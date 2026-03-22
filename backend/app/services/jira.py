"""
Jira REST API v3 client.
Functions: create_jira_issue, update_jira_assignee, get_jira_projects,
           get_jira_users, get_valid_jira_token, build_adf_description,
           check_jira_health.
Descriptions MUST use Atlassian Document Format (ADF) — plain strings are rejected.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.integration import Integration

logger = logging.getLogger(__name__)

JIRA_API_TPL = "https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3"
JIRA_TIMEOUT = 15.0
TOKEN_REFRESH_BUFFER_SECONDS = 300  # refresh if expires within 5 minutes
JIRA_MAX_RETRIES = 3
JIRA_RETRY_STATUSES = {429, 500, 502, 503}


def _base_url(cloud_id: str) -> str:
    return JIRA_API_TPL.format(cloud_id=cloud_id)


def _headers(access_token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


async def _jira_request(
    method: str,
    url: str,
    access_token: str,
    *,
    json: dict | None = None,
    params: dict | None = None,
) -> httpx.Response:
    """Central request helper with timeout, retry on transient errors, and error logging.

    Retries up to JIRA_MAX_RETRIES times on 429/500/502/503 with exponential backoff.
    On 429, honors the Retry-After header if present.
    """
    last_exc: Exception | None = None
    for attempt in range(JIRA_MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=JIRA_TIMEOUT) as client:
                resp = await client.request(
                    method, url, headers=_headers(access_token),
                    json=json, params=params,
                )
            if resp.status_code not in JIRA_RETRY_STATUSES:
                resp.raise_for_status()
                return resp

            retry_after = resp.headers.get("Retry-After")
            if attempt < JIRA_MAX_RETRIES:
                delay = float(retry_after) if retry_after and retry_after.isdigit() else (2 ** attempt)
                logger.warning(
                    "Jira %s %s → %s (attempt %d/%d), retrying in %.1fs",
                    method, url, resp.status_code, attempt + 1, JIRA_MAX_RETRIES + 1, delay,
                )
                await asyncio.sleep(delay)
                continue
            resp.raise_for_status()

        except httpx.TimeoutException:
            last_exc = httpx.TimeoutException(f"Jira request timed out: {method} {url}")
            if attempt < JIRA_MAX_RETRIES:
                delay = 2 ** attempt
                logger.warning("Jira timeout on %s %s (attempt %d/%d), retrying in %.1fs",
                               method, url, attempt + 1, JIRA_MAX_RETRIES + 1, delay)
                await asyncio.sleep(delay)
                continue
            raise last_exc

        except httpx.HTTPStatusError:
            logger.error("Jira API %s %s → %s", method, url, resp.status_code)
            raise

    raise last_exc or Exception("Jira request failed after retries")


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

async def _refresh_jira_token(
    db: AsyncSession, integration: Integration,
) -> str:
    """Refresh the Jira OAuth token and persist new credentials."""
    async with httpx.AsyncClient(timeout=JIRA_TIMEOUT) as client:
        resp = await client.post(
            "https://auth.atlassian.com/oauth/token",
            json={
                "grant_type": "refresh_token",
                "client_id": settings.jira_client_id,
                "client_secret": settings.jira_client_secret,
                "refresh_token": integration.refresh_token,
            },
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()

    integration.access_token = data["access_token"]
    integration.refresh_token = data.get("refresh_token", integration.refresh_token)
    integration.expires_at = datetime.utcnow() + timedelta(
        seconds=data.get("expires_in", 3600)
    )
    integration.updated_at = datetime.utcnow()
    await db.commit()

    logger.info(
        "Jira token refreshed for workspace %s", integration.workspace_id,
    )
    return integration.access_token


async def get_valid_jira_token(
    db: AsyncSession, workspace_id: uuid.UUID,
) -> tuple[str, str]:
    """Return ``(access_token, cloud_id)`` for the workspace's Jira integration.

    Transparently refreshes the token when it expires within 5 minutes.
    Raises HTTPException if no integration exists or refresh fails.
    """
    result = await db.execute(
        select(Integration).where(
            Integration.workspace_id == workspace_id,
            Integration.provider == "jira",
        )
    )
    integration = result.scalars().first()
    if integration is None:
        raise HTTPException(status_code=400, detail="Jira is not connected")

    cloud_id = (integration.metadata_json or {}).get("cloud_id")
    if not cloud_id:
        raise HTTPException(status_code=400, detail="Jira integration is missing cloud_id")

    if (
        integration.expires_at is not None
        and integration.refresh_token
        and integration.expires_at
        < datetime.utcnow() + timedelta(seconds=TOKEN_REFRESH_BUFFER_SECONDS)
    ):
        try:
            token = await _refresh_jira_token(db, integration)
        except Exception:
            logger.exception("Jira token refresh failed for workspace %s", workspace_id)
            raise HTTPException(
                status_code=401,
                detail="Jira token expired and refresh failed. Please reconnect.",
            )
    else:
        token = integration.access_token

    return token, cloud_id


# ---------------------------------------------------------------------------
# ADF builder
# ---------------------------------------------------------------------------

def build_adf_description(
    text: str, source_transcript: str | None = None,
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


# ---------------------------------------------------------------------------
# Issue CRUD
# ---------------------------------------------------------------------------

async def create_jira_issue(
    access_token: str,
    cloud_id: str,
    project_key: str,
    summary: str,
    description: str,
    issue_type: str = "Task",
    assignee_account_id: str | None = None,
    priority: str = "Medium",
    source_transcript: str | None = None,
) -> dict:
    """Create a Jira issue. Returns ``{"key": "PROJ-123", ...}``."""
    url = f"{_base_url(cloud_id)}/issue"
    fields: dict[str, Any] = {
        "project": {"key": project_key},
        "summary": summary,
        "description": build_adf_description(description, source_transcript),
        "issuetype": {"name": issue_type},
        "priority": {"name": priority},
    }
    if assignee_account_id:
        fields["assignee"] = {"accountId": assignee_account_id}

    resp = await _jira_request("POST", url, access_token, json={"fields": fields})
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
    await _jira_request("PUT", url, access_token, json=body)


async def get_jira_projects(
    access_token: str, cloud_id: str,
) -> list[dict]:
    """Return projects accessible in the connected Jira site."""
    url = f"{_base_url(cloud_id)}/project"
    resp = await _jira_request("GET", url, access_token)
    return [{"key": p["key"], "name": p["name"]} for p in resp.json()]


async def get_jira_users(
    access_token: str, cloud_id: str, query: str,
) -> list[dict]:
    """Search Jira users by display name for mapping spoken names to account IDs."""
    url = f"{_base_url(cloud_id)}/user/search"
    resp = await _jira_request("GET", url, access_token, params={"query": query})
    return [
        {
            "accountId": u["accountId"],
            "displayName": u.get("displayName", ""),
            "emailAddress": u.get("emailAddress", ""),
        }
        for u in resp.json()
    ]


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

async def check_jira_health(
    db: AsyncSession, workspace_id: uuid.UUID,
) -> dict[str, Any]:
    """Lightweight health check: validate token and call GET /myself.

    Returns ``{"healthy": True}`` or ``{"healthy": False, "error": "..."}``."""
    try:
        token, cloud_id = await get_valid_jira_token(db, workspace_id)
    except HTTPException as exc:
        return {"healthy": False, "error": exc.detail}

    try:
        url = f"{_base_url(cloud_id)}/myself"
        await _jira_request("GET", url, token)
        return {"healthy": True, "error": None}
    except Exception as exc:
        return {"healthy": False, "error": str(exc)}
