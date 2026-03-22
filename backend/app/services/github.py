"""
GitHub REST API client.
Functions: get_repo_tree, get_file_content, get_recent_commits, get_commit_diff,
           get_user_repos, get_valid_github_token.
All use httpx.AsyncClient with 10s timeout. File content is base64-decoded.
"""

from __future__ import annotations

import base64
import logging
import uuid

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration import Integration

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"
GITHUB_TIMEOUT = 10.0
MAX_DIFF_CHARS = 10_000


def _headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _check_rate_limit(resp: httpx.Response) -> None:
    """Log a warning when GitHub rate limit is nearly or fully exhausted."""
    remaining = resp.headers.get("X-RateLimit-Remaining")
    if remaining is None:
        return
    remaining_int = int(remaining)
    if remaining_int == 0:
        reset = resp.headers.get("X-RateLimit-Reset", "?")
        logger.warning(
            "GitHub rate limit exhausted; resets at epoch %s", reset,
        )
    elif remaining_int < 50:
        logger.info("GitHub rate limit low: %s remaining", remaining_int)


async def _github_request(
    method: str,
    url: str,
    token: str,
    *,
    params: dict | None = None,
    headers_override: dict[str, str] | None = None,
) -> httpx.Response:
    """Central request helper with timeout, rate-limit checks, and error logging."""
    hdrs = headers_override or _headers(token)
    async with httpx.AsyncClient(timeout=GITHUB_TIMEOUT) as client:
        resp = await client.request(method, url, headers=hdrs, params=params)
    _check_rate_limit(resp)
    try:
        resp.raise_for_status()
    except httpx.HTTPStatusError:
        logger.error(
            "GitHub API %s %s → %s", method, url, resp.status_code,
        )
        raise
    return resp


# ---------------------------------------------------------------------------
# Token validation
# ---------------------------------------------------------------------------

async def get_valid_github_token(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    integration: Integration | None = None,
) -> str:
    """Return a valid GitHub token or raise.

    If the stored token is revoked (401 from GitHub), the integration row is
    deleted so the frontend status endpoint reflects the disconnect.
    Pass an already-fetched ``integration`` to avoid a redundant DB query.
    """
    if integration is None:
        result = await db.execute(
            select(Integration).where(
                Integration.workspace_id == workspace_id,
                Integration.provider == "github",
            )
        )
        integration = result.scalars().first()
    if integration is None:
        raise HTTPException(status_code=400, detail="GitHub is not connected")

    try:
        async with httpx.AsyncClient(timeout=GITHUB_TIMEOUT) as client:
            resp = await client.get(
                f"{GITHUB_API}/user",
                headers=_headers(integration.access_token),
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            logger.warning(
                "GitHub token revoked for workspace %s; removing integration",
                workspace_id,
            )
            await db.delete(integration)
            await db.commit()
            raise HTTPException(
                status_code=401,
                detail="GitHub token has been revoked. Please reconnect.",
            )
        raise

    return integration.access_token


# ---------------------------------------------------------------------------
# API functions
# ---------------------------------------------------------------------------

async def get_repo_tree(token: str, repo_full_name: str) -> list[str]:
    """Return a flat list of file paths in the repo (blobs only)."""
    url = f"{GITHUB_API}/repos/{repo_full_name}/git/trees/HEAD"
    resp = await _github_request(
        "GET", url, token, params={"recursive": "1"},
    )
    data = resp.json()
    return [
        item["path"] for item in data.get("tree", []) if item.get("type") == "blob"
    ]


async def get_file_content(
    token: str, repo_full_name: str, file_path: str,
) -> str:
    """Fetch a single file's content, base64-decoded to a UTF-8 string."""
    url = f"{GITHUB_API}/repos/{repo_full_name}/contents/{file_path}"
    resp = await _github_request("GET", url, token)
    data = resp.json()
    raw = base64.b64decode(data["content"])
    return raw.decode("utf-8", errors="replace")


async def get_recent_commits(
    token: str, repo_full_name: str, limit: int = 10,
) -> list[dict]:
    """Return the most recent commits with sha, message, author, and date."""
    url = f"{GITHUB_API}/repos/{repo_full_name}/commits"
    resp = await _github_request(
        "GET", url, token, params={"per_page": limit},
    )
    items = resp.json()
    return [
        {
            "sha": c["sha"],
            "message": c["commit"]["message"],
            "author": c["commit"]["author"]["name"],
            "date": c["commit"]["author"]["date"],
        }
        for c in items
    ]


async def get_user_repos(token: str, per_page: int = 30) -> list[dict]:
    """Return repos the authenticated user has access to, sorted by last update."""
    url = f"{GITHUB_API}/user/repos"
    resp = await _github_request(
        "GET", url, token, params={"sort": "updated", "per_page": per_page},
    )
    return [
        {
            "full_name": r["full_name"],
            "description": r.get("description") or "",
            "default_branch": r.get("default_branch", "main"),
        }
        for r in resp.json()
    ]


async def get_commit_diff(token: str, repo_full_name: str, sha: str) -> str:
    """Return the diff text for a commit, truncated to MAX_DIFF_CHARS."""
    url = f"{GITHUB_API}/repos/{repo_full_name}/commits/{sha}"
    hdrs = _headers(token)
    hdrs["Accept"] = "application/vnd.github.diff"
    resp = await _github_request("GET", url, token, headers_override=hdrs)
    return resp.text[:MAX_DIFF_CHARS]
