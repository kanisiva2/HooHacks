"""
Integrations router — GitHub + Jira OAuth connect/callback flows, status, disconnect.
"""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.config import settings
from app.deps import get_current_user_id, get_db
from app.models.integration import Integration
from app.models.workspace import WorkspaceMember
from app.services.github import get_user_repos
from app.services.jira import get_jira_projects

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["integrations"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class IntegrationSettingsUpdate(BaseModel):
    default_repo: Optional[str] = None
    default_project_key: Optional[str] = None


class IntegrationStatusFull(BaseModel):
    has_github: bool
    has_jira: bool
    github_default_repo: Optional[str] = None
    jira_default_project_key: Optional[str] = None


class IntegrationDefaultsRequest(BaseModel):
    default_repo: str | None = None
    default_jira_project_key: str | None = None


class IntegrationDefaultsResponse(BaseModel):
    default_repo: str | None = None
    default_jira_project_key: str | None = None
    jira_site_url: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_user_workspace_id(
    user_id: str, db: AsyncSession
) -> uuid.UUID:
    """Return the first workspace the user belongs to."""
    result = await db.execute(
        select(WorkspaceMember.workspace_id).where(
            WorkspaceMember.user_id == uuid.UUID(user_id)
        )
    )
    row = result.scalars().first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User has no workspace",
        )
    return row


async def _assert_workspace_member(
    db: AsyncSession, workspace_id: uuid.UUID, user_id: str
) -> None:
    """Raise 403 if the user is not a member of the given workspace."""
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == uuid.UUID(user_id),
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of the specified workspace",
        )


async def _upsert_integration(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    provider: str,
    access_token: str,
    refresh_token: str | None = None,
    expires_at: datetime | None = None,
    metadata_json: dict | None = None,
) -> Integration:
    """Create or update an integration row for the given provider."""
    result = await db.execute(
        select(Integration).where(
            Integration.workspace_id == workspace_id,
            Integration.provider == provider,
        )
    )
    integration = result.scalars().first()

    if integration:
        integration.access_token = access_token
        integration.refresh_token = refresh_token
        integration.expires_at = expires_at
        integration.metadata_json = metadata_json or integration.metadata_json
        integration.updated_at = datetime.utcnow()
    else:
        integration = Integration(
            workspace_id=workspace_id,
            provider=provider,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            metadata_json=metadata_json,
        )
        db.add(integration)

    await db.commit()
    return integration


async def _get_integration(
    db: AsyncSession, workspace_id: uuid.UUID, provider: str
) -> Integration:
    """Fetch an integration row or raise 404."""
    result = await db.execute(
        select(Integration).where(
            Integration.workspace_id == workspace_id,
            Integration.provider == provider,
        )
    )
    integration = result.scalars().first()
    if integration is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{provider.title()} is not connected",
        )
    return integration


# ---------------------------------------------------------------------------
# GitHub OAuth
# ---------------------------------------------------------------------------

@router.get("/github/connect")
async def github_connect(
    workspace_id: str = Query(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the GitHub OAuth authorization URL (frontend navigates to it)."""
    await _assert_workspace_member(db, uuid.UUID(workspace_id), user_id)

    state = f"{workspace_id}:{user_id}"
    params = urlencode(
        {
            "client_id": settings.github_client_id,
            "redirect_uri": settings.github_redirect_uri,
            "scope": "repo read:user",
            "state": state,
        }
    )
    url = f"https://github.com/login/oauth/authorize?{params}"
    return {"url": url}


@router.get("/github/callback")
async def github_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    error_description: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Exchange the GitHub OAuth code for an access token and store it."""
    if error:
        return RedirectResponse(
            url=f"{settings.frontend_url}/integrations?error={error_description or error}",
            status_code=302,
        )
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    parts = state.split(":", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    workspace_id_str, _user_id = parts

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()

    access_token = data.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=400,
            detail=f"GitHub OAuth error: {data.get('error_description', 'unknown')}",
        )

    await _upsert_integration(
        db=db,
        workspace_id=uuid.UUID(workspace_id_str),
        provider="github",
        access_token=access_token,
    )

    return RedirectResponse(
        url=f"{settings.frontend_url}/integrations?github=connected",
        status_code=302,
    )


# ---------------------------------------------------------------------------
# Jira OAuth 2.0 (3LO)
# ---------------------------------------------------------------------------

@router.get("/jira/connect")
async def jira_connect(
    workspace_id: str = Query(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the Jira OAuth authorization URL (frontend navigates to it)."""
    await _assert_workspace_member(db, uuid.UUID(workspace_id), user_id)

    state = f"{workspace_id}:{user_id}"
    params = urlencode(
        {
            "audience": "api.atlassian.com",
            "client_id": settings.jira_client_id,
            "scope": "read:jira-work write:jira-work read:jira-user offline_access",
            "redirect_uri": settings.jira_redirect_uri,
            "state": state,
            "response_type": "code",
            "prompt": "consent",
        }
    )
    url = f"https://auth.atlassian.com/authorize?{params}"
    return {"url": url}


@router.get("/jira/callback")
async def jira_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    error_description: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Exchange the Jira OAuth code for tokens, fetch cloud_id, and store."""
    if error:
        return RedirectResponse(
            url=f"{settings.frontend_url}/integrations?error={error_description or error}",
            status_code=302,
        )
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    parts = state.split(":", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    workspace_id_str, _user_id = parts

    async with httpx.AsyncClient(timeout=15.0) as client:
        token_resp = await client.post(
            "https://auth.atlassian.com/oauth/token",
            json={
                "grant_type": "authorization_code",
                "client_id": settings.jira_client_id,
                "client_secret": settings.jira_client_secret,
                "code": code,
                "redirect_uri": settings.jira_redirect_uri,
            },
            headers={"Content-Type": "application/json"},
        )
        token_resp.raise_for_status()
        token_data = token_resp.json()

    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in", 3600)

    if not access_token:
        raise HTTPException(status_code=400, detail="Jira OAuth token exchange failed")

    token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resources_resp = await client.get(
            "https://api.atlassian.com/oauth/token/accessible-resources",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resources_resp.raise_for_status()
        resources = resources_resp.json()

    if not resources:
        raise HTTPException(
            status_code=400,
            detail="No accessible Jira sites found for this account",
        )
    cloud_id = resources[0]["id"]
    site_url = resources[0].get("url")

    await _upsert_integration(
        db=db,
        workspace_id=uuid.UUID(workspace_id_str),
        provider="jira",
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=token_expires_at,
        metadata_json={"cloud_id": cloud_id, "site_url": site_url},
    )

    return RedirectResponse(
        url=f"{settings.frontend_url}/integrations?jira=connected",
        status_code=302,
    )


# ---------------------------------------------------------------------------
# Status & disconnect
# ---------------------------------------------------------------------------

@router.get("/status", response_model=IntegrationStatusFull)
async def integration_status(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return which integrations are connected and their saved defaults."""
    workspace_id = await _get_user_workspace_id(user_id, db)

    result = await db.execute(
        select(Integration).where(Integration.workspace_id == workspace_id)
    )
    integrations = result.scalars().all()

    has_github = False
    has_jira = False
    github_default_repo = None
    jira_default_project_key = None

    for integ in integrations:
        meta = integ.metadata_json or {}
        if integ.provider == "github":
            has_github = True
            github_default_repo = meta.get("default_repo")
        elif integ.provider == "jira":
            has_jira = True
            jira_default_project_key = meta.get("default_project_key")

    return IntegrationStatusFull(
        has_github=has_github,
        has_jira=has_jira,
        github_default_repo=github_default_repo,
        jira_default_project_key=jira_default_project_key,
    )


@router.delete("/{provider}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_integration(
    provider: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove an integration for the user's workspace."""
    if provider not in ("github", "jira"):
        raise HTTPException(status_code=400, detail="Unknown provider")

    workspace_id = await _get_user_workspace_id(user_id, db)

    result = await db.execute(
        select(Integration).where(
            Integration.workspace_id == workspace_id,
            Integration.provider == provider,
        )
    )
    integration = result.scalars().first()
    if integration:
        await db.delete(integration)
        await db.commit()


# ---------------------------------------------------------------------------
# GitHub repos & Jira projects
# ---------------------------------------------------------------------------

@router.get("/github/repos")
async def github_repos(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List GitHub repos accessible to the connected account."""
    workspace_id = await _get_user_workspace_id(user_id, db)
    integration = await _get_integration(db, workspace_id, "github")
    try:
        repos = await get_user_repos(integration.access_token)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            raise HTTPException(status_code=401, detail="GitHub token is invalid or revoked")
        raise HTTPException(status_code=502, detail="GitHub API error")
    return repos


@router.get("/jira/projects")
async def jira_projects_list(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List Jira projects accessible to the connected account."""
    workspace_id = await _get_user_workspace_id(user_id, db)
    integration = await _get_integration(db, workspace_id, "jira")
    cloud_id = (integration.metadata_json or {}).get("cloud_id")
    if not cloud_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Jira integration is missing cloud_id",
        )
    try:
        projects = await get_jira_projects(integration.access_token, cloud_id)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Jira token is invalid or expired")
        raise HTTPException(status_code=502, detail="Jira API error")
    return projects


# ---------------------------------------------------------------------------
# Defaults (E2 — frontend workspace defaults)
# ---------------------------------------------------------------------------

@router.get("/defaults", response_model=IntegrationDefaultsResponse)
async def get_integration_defaults(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    workspace_id = await _get_user_workspace_id(user_id, db)

    github = await db.execute(
        select(Integration).where(
            Integration.workspace_id == workspace_id, Integration.provider == "github"
        )
    )
    jira = await db.execute(
        select(Integration).where(
            Integration.workspace_id == workspace_id, Integration.provider == "jira"
        )
    )
    github_integration = github.scalars().first()
    jira_integration = jira.scalars().first()

    return IntegrationDefaultsResponse(
        default_repo=(github_integration.metadata_json or {}).get("default_repo")
        if github_integration
        else None,
        default_jira_project_key=(jira_integration.metadata_json or {}).get(
            "default_project_key"
        )
        if jira_integration
        else None,
        jira_site_url=(jira_integration.metadata_json or {}).get("site_url")
        if jira_integration
        else None,
    )


@router.patch("/defaults", response_model=IntegrationDefaultsResponse)
async def update_integration_defaults(
    payload: IntegrationDefaultsRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    workspace_id = await _get_user_workspace_id(user_id, db)

    github_result = await db.execute(
        select(Integration).where(
            Integration.workspace_id == workspace_id, Integration.provider == "github"
        )
    )
    jira_result = await db.execute(
        select(Integration).where(
            Integration.workspace_id == workspace_id, Integration.provider == "jira"
        )
    )
    github_integration = github_result.scalars().first()
    jira_integration = jira_result.scalars().first()

    if payload.default_repo is not None and github_integration is not None:
        github_meta = dict(github_integration.metadata_json or {})
        github_meta["default_repo"] = payload.default_repo
        github_integration.metadata_json = github_meta
        github_integration.updated_at = datetime.utcnow()

    if payload.default_jira_project_key is not None and jira_integration is not None:
        jira_meta = dict(jira_integration.metadata_json or {})
        jira_meta["default_project_key"] = payload.default_jira_project_key
        jira_integration.metadata_json = jira_meta
        jira_integration.updated_at = datetime.utcnow()

    await db.commit()

    return IntegrationDefaultsResponse(
        default_repo=(github_integration.metadata_json or {}).get("default_repo")
        if github_integration
        else None,
        default_jira_project_key=(jira_integration.metadata_json or {}).get(
            "default_project_key"
        )
        if jira_integration
        else None,
        jira_site_url=(jira_integration.metadata_json or {}).get("site_url")
        if jira_integration
        else None,
    )


# ---------------------------------------------------------------------------
# Settings (E3 — per-provider metadata update)
# ---------------------------------------------------------------------------

@router.patch("/{provider}/settings", status_code=status.HTTP_200_OK)
async def update_integration_settings(
    provider: str,
    body: IntegrationSettingsUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update default repo/project in the integration's metadata_json."""
    if provider not in ("github", "jira"):
        raise HTTPException(status_code=400, detail="Unknown provider")

    workspace_id = await _get_user_workspace_id(user_id, db)
    integration = await _get_integration(db, workspace_id, provider)

    meta = dict(integration.metadata_json or {})
    if provider == "github" and body.default_repo is not None:
        meta["default_repo"] = body.default_repo
    if provider == "jira" and body.default_project_key is not None:
        meta["default_project_key"] = body.default_project_key

    integration.metadata_json = meta
    flag_modified(integration, "metadata_json")
    integration.updated_at = datetime.utcnow()
    await db.commit()

    return {"status": "ok", "metadata": meta}
