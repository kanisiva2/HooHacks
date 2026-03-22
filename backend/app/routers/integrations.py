"""
Integrations router — GitHub + Jira OAuth connect/callback flows, status, disconnect.
"""

import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.deps import get_current_user_id, get_db
from app.models.integration import Integration
from app.models.workspace import WorkspaceMember
from app.schemas.integration import IntegrationStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_user_workspace_id(
    user_id: str, db: AsyncSession
) -> str:
    """Return the first workspace the user belongs to."""
    result = await db.execute(
        select(WorkspaceMember.workspace_id).where(
            WorkspaceMember.user_id == user_id
        )
    )
    row = result.scalars().first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User has no workspace",
        )
    return str(row)


async def _upsert_integration(
    db: AsyncSession,
    workspace_id: str,
    provider: str,
    access_token: str,
    refresh_token: str | None = None,
    token_expires_at: datetime | None = None,
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
        integration.token_expires_at = token_expires_at
        integration.metadata_json = metadata_json or integration.metadata_json
        integration.updated_at = datetime.now(timezone.utc)
    else:
        integration = Integration(
            workspace_id=workspace_id,
            provider=provider,
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=token_expires_at,
            metadata_json=metadata_json,
        )
        db.add(integration)

    await db.commit()
    return integration


# ---------------------------------------------------------------------------
# GitHub OAuth
# ---------------------------------------------------------------------------

@router.get("/github/connect")
async def github_connect(
    workspace_id: str = Query(...),
    user_id: str = Depends(get_current_user_id),
):
    """Redirect the user to GitHub's OAuth authorization page."""
    settings = get_settings()
    state = f"{workspace_id}:{user_id}"
    params = urlencode(
        {
            "client_id": settings.GITHUB_CLIENT_ID,
            "redirect_uri": settings.GITHUB_REDIRECT_URI,
            "scope": "repo read:user",
            "state": state,
        }
    )
    return RedirectResponse(
        url=f"https://github.com/login/oauth/authorize?{params}",
        status_code=302,
    )


@router.get("/github/callback")
async def github_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Exchange the GitHub OAuth code for an access token and store it."""
    settings = get_settings()

    parts = state.split(":", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    workspace_id, _user_id = parts

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.GITHUB_REDIRECT_URI,
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
        workspace_id=workspace_id,
        provider="github",
        access_token=access_token,
    )

    return RedirectResponse(
        url=f"{get_settings().FRONTEND_URL}/integrations?github=connected",
        status_code=302,
    )


# ---------------------------------------------------------------------------
# Jira OAuth 2.0 (3LO)
# ---------------------------------------------------------------------------

@router.get("/jira/connect")
async def jira_connect(
    workspace_id: str = Query(...),
    user_id: str = Depends(get_current_user_id),
):
    """Redirect the user to Atlassian's OAuth authorization page."""
    settings = get_settings()
    state = f"{workspace_id}:{user_id}"
    params = urlencode(
        {
            "audience": "api.atlassian.com",
            "client_id": settings.JIRA_CLIENT_ID,
            "scope": "read:jira-work write:jira-work read:jira-user offline_access",
            "redirect_uri": settings.JIRA_REDIRECT_URI,
            "state": state,
            "response_type": "code",
            "prompt": "consent",
        }
    )
    return RedirectResponse(
        url=f"https://auth.atlassian.com/authorize?{params}",
        status_code=302,
    )


@router.get("/jira/callback")
async def jira_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Exchange the Jira OAuth code for tokens, fetch cloud_id, and store."""
    settings = get_settings()

    parts = state.split(":", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    workspace_id, _user_id = parts

    # Exchange code for tokens
    async with httpx.AsyncClient(timeout=15.0) as client:
        token_resp = await client.post(
            "https://auth.atlassian.com/oauth/token",
            json={
                "grant_type": "authorization_code",
                "client_id": settings.JIRA_CLIENT_ID,
                "client_secret": settings.JIRA_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.JIRA_REDIRECT_URI,
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

    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    # Fetch accessible resources to get cloud_id
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

    await _upsert_integration(
        db=db,
        workspace_id=workspace_id,
        provider="jira",
        access_token=access_token,
        refresh_token=refresh_token,
        token_expires_at=token_expires_at,
        metadata_json={"cloud_id": cloud_id},
    )

    return RedirectResponse(
        url=f"{get_settings().FRONTEND_URL}/integrations?jira=connected",
        status_code=302,
    )


# ---------------------------------------------------------------------------
# Status & disconnect
# ---------------------------------------------------------------------------

@router.get("/status", response_model=IntegrationStatus)
async def integration_status(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return which integrations are connected for the user's workspace."""
    workspace_id = await _get_user_workspace_id(user_id, db)

    result = await db.execute(
        select(Integration.provider).where(
            Integration.workspace_id == workspace_id
        )
    )
    providers = {row for row in result.scalars().all()}
    return IntegrationStatus(
        has_github="github" in providers,
        has_jira="jira" in providers,
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
        db.delete(integration)
        await db.commit()
