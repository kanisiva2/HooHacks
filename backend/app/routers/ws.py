from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import jwt, JWTError, ExpiredSignatureError
from sqlalchemy import select

from app.config import settings
from app.database import async_session_maker
from app.models.incident import Incident
from app.models.workspace import WorkspaceMember
from app.ws_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter()

# WebSocket close codes (4000–4999 are application-defined)
_WS_UNAUTHORIZED = 4001
_WS_FORBIDDEN = 4003
_WS_NOT_FOUND = 4004


async def _verify_ws_token(token: str) -> str | None:
    """Verify the JWT passed as a WebSocket query param. Returns user_id or None."""
    if not token:
        return None
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
        if alg == "ES256":
            from app.deps import _get_jwks
            jwks = await _get_jwks()
            payload = jwt.decode(
                token, jwks, algorithms=["ES256"], options={"verify_aud": False}
            )
        else:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        return payload.get("sub")
    except (ExpiredSignatureError, JWTError):
        return None


@router.websocket("/ws/{incident_id}")
async def incident_ws(
    websocket: WebSocket,
    incident_id: str,
    token: str = Query(default=""),
) -> None:
    # ── 1. Validate JWT ──
    user_id = await _verify_ws_token(token)
    if not user_id:
        logger.warning("ws_auth_failed incident_id=%s reason=invalid_token", incident_id)
        await websocket.close(code=_WS_UNAUTHORIZED)
        return

    # ── 2. Validate incident exists + workspace membership ──
    try:
        incident_uuid = uuid.UUID(incident_id)
    except ValueError:
        await websocket.close(code=_WS_NOT_FOUND)
        return

    async with async_session_maker() as db:
        result = await db.execute(select(Incident).where(Incident.id == incident_uuid))
        incident = result.scalar_one_or_none()
        if incident is None:
            logger.warning("ws_not_found incident_id=%s user_id=%s", incident_id, user_id)
            await websocket.close(code=_WS_NOT_FOUND)
            return

        result = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == incident.workspace_id,
                WorkspaceMember.user_id == uuid.UUID(user_id),
            )
        )
        if result.scalar_one_or_none() is None:
            logger.warning(
                "ws_forbidden user_id=%s incident_id=%s workspace_id=%s",
                user_id, incident_id, incident.workspace_id,
            )
            await websocket.close(code=_WS_FORBIDDEN)
            return

    # ── 3. Accept and maintain connection ──
    await manager.connect(incident_id, websocket)
    logger.info("ws_connected user_id=%s incident_id=%s", user_id, incident_id)

    try:
        while True:
            # Keep-alive/read loop. Client can send pings or heartbeat payloads.
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        manager.disconnect(incident_id)
        logger.info("ws_disconnected user_id=%s incident_id=%s", user_id, incident_id)
