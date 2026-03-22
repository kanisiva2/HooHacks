"""
Skribby API service — manages meeting bots via the Skribby platform REST API.

All calls use httpx.AsyncClient with Bearer token auth. Transient failures
(timeouts, 5xx) are retried with linear backoff.
"""

from __future__ import annotations

import asyncio
import logging
from urllib.parse import urlparse

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

SKRIBBY_BASE_URL = "https://platform.skribby.io/api/v1"
DEFAULT_TRANSCRIPTION_MODEL = "deepgram-nova3-realtime"
DEFAULT_TIMEOUT_SECONDS = 20.0
DEFAULT_MAX_RETRIES = 2


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.skribby_api_key}",
        "Content-Type": "application/json",
    }


def detect_service(meeting_url: str) -> str:
    host = urlparse(meeting_url).netloc.lower()
    if "zoom.us" in host:
        return "zoom"
    if "meet.google.com" in host:
        return "gmeet"
    if "teams.microsoft.com" in host or "teams.live.com" in host:
        return "teams"
    raise ValueError(f"Unsupported meeting URL host: {host or '<empty>'}")


def _is_retryable(exc: Exception) -> bool:
    if isinstance(exc, httpx.TimeoutException):
        return True
    if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code >= 500:
        return True
    return False


async def _request_with_retry(
    method: str,
    url: str,
    max_retries: int = DEFAULT_MAX_RETRIES,
    **kwargs: object,
) -> dict:
    """Execute an HTTP request with retry on transient failures (timeouts, 5xx)."""
    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_SECONDS) as client:
                response = await getattr(client, method)(url, headers=_headers(), **kwargs)
                response.raise_for_status()
                return response.json()
        except Exception as exc:
            if attempt < max_retries and _is_retryable(exc):
                delay = (attempt + 1) * 1.0
                logger.warning(
                    "Skribby %s %s attempt %d failed (%s), retrying in %.1fs",
                    method.upper(), url, attempt + 1, exc, delay,
                )
                await asyncio.sleep(delay)
                continue
            raise


async def create_bot(
    meeting_url: str,
    bot_name: str = "Sprynt AI",
    service: str | None = None,
    webhook_url: str | None = None,
) -> dict:
    resolved_service = service or detect_service(meeting_url)
    payload: dict[str, object] = {
        "transcription_model": DEFAULT_TRANSCRIPTION_MODEL,
        "meeting_url": meeting_url,
        "service": resolved_service,
        "bot_name": bot_name,
    }
    if webhook_url:
        payload["webhook_url"] = webhook_url

    return await _request_with_retry(
        "post", f"{SKRIBBY_BASE_URL}/bot", json=payload,
    )


async def stop_bot(bot_id: str) -> dict:
    return await _request_with_retry(
        "post", f"{SKRIBBY_BASE_URL}/bot/{bot_id}/stop",
    )


async def get_bot(bot_id: str) -> dict:
    return await _request_with_retry(
        "get", f"{SKRIBBY_BASE_URL}/bot/{bot_id}",
    )
