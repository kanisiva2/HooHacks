"""
Voice interaction service — handles questions directed at Sprynt during meetings.

Sprint 2: stub that logs detected questions. Full implementation (LLM answer
generation + Skribby chat-message delivery) is wired in Sprint 3.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def handle_voice_question(
    incident_id: str,
    speaker: str,
    text: str,
) -> None:
    """Placeholder for Sprint 3 voice Q&A pipeline.

    Sprint 3 will:
    1. Set agent status to "speaking".
    2. Call generate_spoken_answer() from llm.py.
    3. Send answer to meeting chat via Skribby chat-message action.
    4. Broadcast answer text to dashboard via WebSocket.
    5. Set agent status back to "listening".
    """
    logger.info(
        "Voice question detected (stub): incident=%s speaker=%s text=%s",
        incident_id, speaker, text[:120],
    )
