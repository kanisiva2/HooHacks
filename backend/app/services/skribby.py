from __future__ import annotations

from urllib.parse import urlparse

import httpx

from app.config import settings

SKRIBBY_BASE_URL = "https://platform.skribby.io/api/v1"
DEFAULT_TRANSCRIPTION_MODEL = "deepgram-realtime-v3"
DEFAULT_TIMEOUT_SECONDS = 20.0


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

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_SECONDS) as client:
        response = await client.post(f"{SKRIBBY_BASE_URL}/bot", headers=_headers(), json=payload)
        if response.status_code >= 400:
            import logging
            logging.getLogger(__name__).error(
                "Skribby create_bot returned %s: %s", response.status_code, response.text,
            )
        response.raise_for_status()
        return response.json()


async def stop_bot(bot_id: str) -> dict:
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_SECONDS) as client:
        response = await client.post(f"{SKRIBBY_BASE_URL}/bot/{bot_id}/stop", headers=_headers())
        response.raise_for_status()
        return response.json()


async def get_bot(bot_id: str) -> dict:
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_SECONDS) as client:
        response = await client.get(f"{SKRIBBY_BASE_URL}/bot/{bot_id}", headers=_headers())
        response.raise_for_status()
        return response.json()
