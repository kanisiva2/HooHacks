import asyncio
import logging
from typing import AsyncGenerator

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, ExpiredSignatureError
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session_maker

logger = logging.getLogger(__name__)

_bearer = HTTPBearer()

_jwks_cache: dict | None = None


async def _get_jwks() -> dict:
    """Fetch and cache the Supabase JWKS (public keys for ES256 verification)."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(jwks_url)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    return _jwks_cache


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yields an async SQLAlchemy session. Retries connection acquisition up to 3 times on OperationalError.

    Uses _session_acquired to distinguish connection errors (retryable) from
    errors raised inside the endpoint after the session was already in use (not retried).
    """
    last_exc: Exception | None = None
    for attempt in range(1, 4):
        _session_acquired = False
        try:
            async with async_session_maker() as session:
                _session_acquired = True
                yield session
                return
        except OperationalError as exc:
            if _session_acquired:
                # Error came from inside the endpoint — not a connection issue, don't retry
                raise
            last_exc = exc
            if attempt < 3:
                logger.warning(
                    "db_connection_failed attempt=%d/3 error=%s — retrying", attempt, exc
                )
                await asyncio.sleep(0.5 * attempt)
    logger.error("db_connection_failed after 3 attempts: %s", last_exc)
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database temporarily unavailable",
    )


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    """
    Verifies the Supabase JWT from the Authorization: Bearer header.
    Returns the Supabase user UUID string (the 'sub' claim).
    Raises HTTP 401 on any auth failure.

    Supports both ES256 (newer Supabase projects, verified via JWKS)
    and HS256 (older projects, verified via JWT secret).
    """
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")

        if alg == "ES256":
            jwks = await _get_jwks()
            payload = jwt.decode(
                token,
                jwks,
                algorithms=["ES256"],
                options={"verify_aud": False},
            )
        else:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )

        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing subject claim",
            )
        return user_id
    except ExpiredSignatureError:
        logger.warning("auth_failed reason=token_expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except JWTError as exc:
        logger.warning("auth_failed reason=invalid_token error=%s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )
