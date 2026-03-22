"""
GitHub REST API client.
Functions: get_repo_tree, get_file_content, get_recent_commits, get_commit_diff,
           get_user_repos, get_valid_github_token, github_rate_limit_ok,
           check_github_health.
All use httpx.AsyncClient with 10s timeout. File content is base64-decoded.
"""

from __future__ import annotations

import base64
import logging
import time
import uuid
from typing import Any
from urllib.parse import quote

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.integration import Integration

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"
GITHUB_TIMEOUT = 10.0
MAX_DIFF_CHARS = 10_000

# Module-level rate limit state (updated after every API response)
_rate_limit_remaining: int | None = None
_rate_limit_reset: float | None = None  # Unix epoch timestamp


def _headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _check_rate_limit(resp: httpx.Response) -> None:
    """Store rate limit state and log when nearly or fully exhausted."""
    global _rate_limit_remaining, _rate_limit_reset

    remaining = resp.headers.get("X-RateLimit-Remaining")
    if remaining is None:
        return
    remaining_int = int(remaining)
    _rate_limit_remaining = remaining_int

    reset_header = resp.headers.get("X-RateLimit-Reset")
    if reset_header:
        _rate_limit_reset = float(reset_header)

    if remaining_int == 0:
        logger.warning(
            "GitHub rate limit exhausted; resets at epoch %s",
            reset_header or "?",
        )
    elif remaining_int < 50:
        logger.info("GitHub rate limit low: %s remaining", remaining_int)


def github_rate_limit_ok(min_required: int = 50) -> bool:
    """Return False if the stored rate limit is below *min_required* and the reset
    window hasn't passed yet. Safe to call at any time — returns True when no
    rate limit data has been observed yet."""
    if _rate_limit_remaining is None:
        return True
    if _rate_limit_remaining >= min_required:
        return True
    if _rate_limit_reset is not None and time.time() >= _rate_limit_reset:
        return True
    return False


def get_rate_limit_info() -> dict[str, Any]:
    """Return current rate limit tracking info (for debugging endpoints)."""
    reset_in: float | None = None
    if _rate_limit_reset is not None:
        reset_in = max(0.0, _rate_limit_reset - time.time())
    return {
        "remaining": _rate_limit_remaining,
        "reset_epoch": _rate_limit_reset,
        "reset_in_seconds": round(reset_in, 1) if reset_in is not None else None,
        "ok": github_rate_limit_ok(),
    }


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
    data = await get_file_content_with_metadata(token, repo_full_name, file_path)
    return data["content"]


async def get_file_content_with_metadata(
    token: str, repo_full_name: str, file_path: str,
) -> dict[str, Any]:
    """Fetch a single file's content and metadata from the contents API."""
    url = f"{GITHUB_API}/repos/{repo_full_name}/contents/{quote(file_path, safe='/')}"
    resp = await _github_request("GET", url, token)
    data = resp.json()
    raw = base64.b64decode(data["content"])
    return {
        "content": raw.decode("utf-8", errors="replace"),
        "sha": data["sha"],
        "path": data["path"],
    }


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


async def get_repo_details(token: str, repo_full_name: str) -> dict[str, Any]:
    url = f"{GITHUB_API}/repos/{repo_full_name}"
    resp = await _github_request("GET", url, token)
    return resp.json()


async def get_branch_head_sha(token: str, repo_full_name: str, branch: str) -> str:
    url = f"{GITHUB_API}/repos/{repo_full_name}/git/ref/heads/{quote(branch, safe='')}"
    resp = await _github_request("GET", url, token)
    data = resp.json()
    return data["object"]["sha"]


async def create_branch_ref(
    token: str,
    repo_full_name: str,
    branch_name: str,
    from_sha: str,
) -> dict[str, Any]:
    url = f"{GITHUB_API}/repos/{repo_full_name}/git/refs"
    async with httpx.AsyncClient(timeout=GITHUB_TIMEOUT) as client:
        resp = await client.post(
            url,
            headers=_headers(token),
            json={
                "ref": f"refs/heads/{branch_name}",
                "sha": from_sha,
            },
        )
    _check_rate_limit(resp)
    resp.raise_for_status()
    return resp.json()


async def update_file_on_branch(
    token: str,
    repo_full_name: str,
    file_path: str,
    *,
    branch: str,
    message: str,
    content: str,
    sha: str,
) -> dict[str, Any]:
    url = f"{GITHUB_API}/repos/{repo_full_name}/contents/{quote(file_path, safe='/')}"
    encoded_content = base64.b64encode(content.encode("utf-8")).decode("ascii")
    async with httpx.AsyncClient(timeout=GITHUB_TIMEOUT) as client:
        resp = await client.put(
            url,
            headers=_headers(token),
            json={
                "message": message,
                "content": encoded_content,
                "branch": branch,
                "sha": sha,
            },
        )
    _check_rate_limit(resp)
    resp.raise_for_status()
    return resp.json()


async def create_pull_request(
    token: str,
    repo_full_name: str,
    *,
    title: str,
    head: str,
    base: str,
    body: str,
) -> dict[str, Any]:
    url = f"{GITHUB_API}/repos/{repo_full_name}/pulls"
    async with httpx.AsyncClient(timeout=GITHUB_TIMEOUT) as client:
        resp = await client.post(
            url,
            headers=_headers(token),
            json={
                "title": title,
                "head": head,
                "base": base,
                "body": body,
            },
        )
    _check_rate_limit(resp)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

async def check_github_health(
    db: AsyncSession, workspace_id: uuid.UUID,
) -> dict[str, Any]:
    """Lightweight health check: validate token via GET /user.

    Returns ``{"healthy": True}`` or ``{"healthy": False, "error": "..."}``.
    On 401, the integration is removed by ``get_valid_github_token``.
    """
    try:
        await get_valid_github_token(db, workspace_id)
        return {"healthy": True, "error": None}
    except HTTPException as exc:
        return {"healthy": False, "error": exc.detail}
    except Exception as exc:
        return {"healthy": False, "error": str(exc)}
