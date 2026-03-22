"""
GitHub REST API client.
Functions: get_repo_tree, get_file_content, get_recent_commits, get_commit_diff.
All use httpx.AsyncClient. File content is base64-decoded.
"""

import base64
import logging

import httpx

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"
MAX_DIFF_CHARS = 10_000


def _headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def get_repo_tree(token: str, repo_full_name: str) -> list[str]:
    """Return a flat list of file paths in the repo (blobs only)."""
    url = f"{GITHUB_API}/repos/{repo_full_name}/git/trees/HEAD"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            url, headers=_headers(token), params={"recursive": "1"}
        )
        resp.raise_for_status()
        data = resp.json()
    return [
        item["path"] for item in data.get("tree", []) if item.get("type") == "blob"
    ]


async def get_file_content(
    token: str, repo_full_name: str, file_path: str
) -> str:
    """Fetch a single file's content, base64-decoded to a UTF-8 string."""
    url = f"{GITHUB_API}/repos/{repo_full_name}/contents/{file_path}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers=_headers(token))
        resp.raise_for_status()
        data = resp.json()
    raw = base64.b64decode(data["content"])
    return raw.decode("utf-8", errors="replace")


async def get_recent_commits(
    token: str, repo_full_name: str, limit: int = 10
) -> list[dict]:
    """Return the most recent commits with sha, message, author, and date."""
    url = f"{GITHUB_API}/repos/{repo_full_name}/commits"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            url, headers=_headers(token), params={"per_page": limit}
        )
        resp.raise_for_status()
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


async def get_commit_diff(token: str, repo_full_name: str, sha: str) -> str:
    """Return the diff text for a commit, truncated to MAX_DIFF_CHARS."""
    url = f"{GITHUB_API}/repos/{repo_full_name}/commits/{sha}"
    headers = _headers(token)
    headers["Accept"] = "application/vnd.github.diff"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
    return resp.text[:MAX_DIFF_CHARS]
