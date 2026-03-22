"""
End-to-end tests for the E4 real-time transcript pipeline.

Uses mocked Skribby WebSocket messages to verify:
- Listener receives events and broadcasts correct agent statuses.
- Intelligent reconnection checks bot status via REST before retrying.
- Error-event fallback polls REST for post-meeting transcript.
- Voice pipeline generates answers and sends via Skribby chat-message.
- Chat-message failure falls back to dashboard-only broadcast.

Run with:  pytest backend/tests/test_e2e_transcript_pipeline.py -v
"""

from __future__ import annotations

import asyncio
import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Fixtures & helpers
# ---------------------------------------------------------------------------


class MockWebSocket:
    """Simulates a websockets connection yielding preset JSON messages."""

    def __init__(self, messages: list[dict], close_after: bool = True):
        self._messages = [json.dumps(m) for m in messages]
        self._index = 0
        self.sent: list[str] = []
        self._close_after = close_after

    async def __aenter__(self) -> MockWebSocket:
        return self

    async def __aexit__(self, *args: Any) -> None:
        pass

    def __aiter__(self) -> MockWebSocket:
        return self

    async def __anext__(self) -> str:
        if self._index >= len(self._messages):
            raise StopAsyncIteration
        msg = self._messages[self._index]
        self._index += 1
        return msg

    async def send(self, data: str) -> None:
        self.sent.append(data)


def _make_transcript_event(
    speaker: str = "Alice",
    text: str = "Something happened",
    is_final: bool = True,
) -> dict:
    return {
        "type": "transcript",
        "data": {
            "speaker": speaker,
            "text": text,
            "is_final": is_final,
            "start_ts": 1.0,
            "end_ts": 2.0,
        },
    }


# ---------------------------------------------------------------------------
# Test: start → transcript → stop lifecycle
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_listener_start_transcript_stop_lifecycle():
    """The listener should broadcast 'listening' on start, forward transcript
    chunks, and broadcast 'idle' on stop."""
    messages = [
        {"type": "start"},
        _make_transcript_event(speaker="Bob", text="The auth service is down"),
        {"type": "stop"},
    ]

    ws_mock = MockWebSocket(messages)
    statuses: list[dict] = []

    async def capture_send(incident_id: str, payload: dict) -> None:
        statuses.append(payload)

    with (
        patch("app.services.skribby_listener.websockets.connect", return_value=ws_mock),
        patch("app.services.skribby_listener.manager") as mock_manager,
        patch("app.services.skribby_listener.process_parsed_chunk", new_callable=AsyncMock) as mock_process,
        patch("app.services.skribby_listener._fetch_recording_url", new_callable=AsyncMock, return_value=None),
        patch("app.services.voice.register_skribby_ws"),
    ):
        mock_manager.send = AsyncMock(side_effect=capture_send)

        from app.services.skribby_listener import listen_to_skribby

        await listen_to_skribby(
            websocket_url="wss://fake.skribby.io/ws",
            incident_id="inc-001",
            bot_id="bot-001",
        )

    # Verify transcript chunk was forwarded
    mock_process.assert_called_once()
    call_kwargs = mock_process.call_args.kwargs
    assert call_kwargs["speaker"] == "Bob"
    assert call_kwargs["text"] == "The auth service is down"
    assert call_kwargs["is_final"] is True

    # Verify status flow: joining → listening → idle
    status_types = [s["status"] for s in statuses if s.get("type") == "agent_status"]
    assert "joining" in status_types
    assert "listening" in status_types
    assert "idle" in status_types


# ---------------------------------------------------------------------------
# Test: WebSocket disconnect → REST status check → reconnect or stop
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_listener_reconnects_when_bot_active():
    """When the WebSocket drops but the bot is still active, the listener
    should reconnect (up to MAX_RECONNECT_ATTEMPTS)."""

    call_count = 0

    # First connection drops immediately (empty messages), second has stop
    ws_empty = MockWebSocket([])
    ws_with_stop = MockWebSocket([{"type": "stop"}])

    def fake_connect(url: str) -> MockWebSocket:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return ws_empty
        return ws_with_stop

    with (
        patch("app.services.skribby_listener.websockets.connect", side_effect=fake_connect),
        patch("app.services.skribby_listener.manager") as mock_manager,
        patch("app.services.skribby_listener.process_parsed_chunk", new_callable=AsyncMock),
        patch("app.services.skribby_listener._fetch_recording_url", new_callable=AsyncMock, return_value=None),
        patch("app.services.skribby_listener.get_bot", new_callable=AsyncMock, return_value={"status": "running"}),
        patch("app.services.skribby_listener.sleep", new_callable=AsyncMock),
        patch("app.services.voice.register_skribby_ws"),
    ):
        mock_manager.send = AsyncMock()

        from app.services.skribby_listener import listen_to_skribby

        await listen_to_skribby(
            websocket_url="wss://fake.skribby.io/ws",
            incident_id="inc-002",
            bot_id="bot-002",
        )

    assert call_count == 2, "Listener should have reconnected once"


@pytest.mark.asyncio
async def test_listener_stops_when_bot_finished():
    """When the WebSocket drops and bot status is 'finished', the listener
    should stop immediately without reconnecting."""

    ws_empty = MockWebSocket([])
    connect_count = 0

    def fake_connect(url: str) -> MockWebSocket:
        nonlocal connect_count
        connect_count += 1
        return ws_empty

    with (
        patch("app.services.skribby_listener.websockets.connect", side_effect=fake_connect),
        patch("app.services.skribby_listener.manager") as mock_manager,
        patch("app.services.skribby_listener.process_parsed_chunk", new_callable=AsyncMock),
        patch("app.services.skribby_listener.get_bot", new_callable=AsyncMock, return_value={"status": "finished"}),
        patch("app.services.skribby_listener.sleep", new_callable=AsyncMock),
        patch("app.services.voice.register_skribby_ws"),
    ):
        mock_manager.send = AsyncMock()

        from app.services.skribby_listener import listen_to_skribby

        await listen_to_skribby(
            websocket_url="wss://fake.skribby.io/ws",
            incident_id="inc-003",
            bot_id="bot-003",
        )

    assert connect_count == 1, "Listener should not reconnect when bot is finished"


@pytest.mark.asyncio
async def test_listener_stops_when_bot_not_admitted():
    """When bot status is 'not_admitted', the listener should stop."""

    ws_empty = MockWebSocket([])

    with (
        patch("app.services.skribby_listener.websockets.connect", return_value=ws_empty),
        patch("app.services.skribby_listener.manager") as mock_manager,
        patch("app.services.skribby_listener.process_parsed_chunk", new_callable=AsyncMock),
        patch("app.services.skribby_listener.get_bot", new_callable=AsyncMock, return_value={"status": "not_admitted"}),
        patch("app.services.skribby_listener.sleep", new_callable=AsyncMock),
        patch("app.services.voice.register_skribby_ws"),
    ):
        mock_manager.send = AsyncMock()
        statuses: list[dict] = []
        original_send = mock_manager.send

        async def capture(iid: str, payload: dict) -> None:
            statuses.append(payload)

        mock_manager.send = AsyncMock(side_effect=capture)

        from app.services.skribby_listener import listen_to_skribby

        await listen_to_skribby(
            websocket_url="wss://fake.skribby.io/ws",
            incident_id="inc-004",
            bot_id="bot-004",
        )

    idle_msgs = [s for s in statuses if s.get("status") == "idle"]
    assert len(idle_msgs) >= 1
    assert "not_admitted" in idle_msgs[-1].get("last_message", "")


# ---------------------------------------------------------------------------
# Test: error event → fallback transcript polling
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_error_event_triggers_transcript_fallback():
    """When an 'error' event fires and then 'stop' fires, the listener should
    poll the REST API for post-meeting transcript."""

    messages = [
        {"type": "error", "data": {"message": "Transcription engine failure"}},
        {"type": "stop"},
    ]

    fallback_transcript = [
        {"speaker": "Alice", "text": "Recovered chunk 1", "start_ts": 1.0, "end_ts": 2.0},
        {"speaker": "Bob", "text": "Recovered chunk 2", "start_ts": 3.0, "end_ts": 4.0},
    ]

    ws_mock = MockWebSocket(messages)

    with (
        patch("app.services.skribby_listener.websockets.connect", return_value=ws_mock),
        patch("app.services.skribby_listener.manager") as mock_manager,
        patch("app.services.skribby_listener.process_parsed_chunk", new_callable=AsyncMock) as mock_process,
        patch("app.services.skribby_listener._fetch_recording_url", new_callable=AsyncMock, return_value=None),
        patch(
            "app.services.skribby_listener.get_bot",
            new_callable=AsyncMock,
            return_value={"status": "finished", "transcript": fallback_transcript},
        ),
        patch("app.services.skribby_listener.sleep", new_callable=AsyncMock),
        patch("app.services.voice.register_skribby_ws"),
    ):
        mock_manager.send = AsyncMock()

        # Clear module-level state
        from app.services import skribby_listener
        skribby_listener._error_received.clear()

        await skribby_listener.listen_to_skribby(
            websocket_url="wss://fake.skribby.io/ws",
            incident_id="inc-005",
            bot_id="bot-005",
        )

    # process_parsed_chunk should have been called for each recovered entry
    assert mock_process.call_count == 2
    recovered_texts = {c.kwargs["text"] for c in mock_process.call_args_list}
    assert "Recovered chunk 1" in recovered_texts
    assert "Recovered chunk 2" in recovered_texts


# ---------------------------------------------------------------------------
# Test: voice pipeline — happy path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_voice_question_happy_path():
    """handle_voice_question should generate an answer, send to chat, and
    broadcast to the dashboard."""

    statuses: list[dict] = []
    dashboard_msgs: list[dict] = []

    async def capture_send(iid: str, payload: dict) -> None:
        if payload.get("type") == "agent_status":
            statuses.append(payload)
        else:
            dashboard_msgs.append(payload)

    with (
        patch("app.services.voice.manager") as mock_manager,
        patch("app.services.voice.generate_spoken_answer", new_callable=AsyncMock, return_value="The auth-service pod is crash-looping."),
        patch("app.services.voice.get_active_tasks_summary", new_callable=AsyncMock, return_value=[]),
        patch("app.services.voice._get_deep_dive_summary", new_callable=AsyncMock, return_value=[]),
        patch("app.services.voice.send_chat_response", new_callable=AsyncMock) as mock_chat,
        patch("app.services.voice.async_session_maker") as mock_session_maker,
    ):
        mock_manager.send = AsyncMock(side_effect=capture_send)

        mock_session = AsyncMock()
        mock_session_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_maker.return_value.__aexit__ = AsyncMock(return_value=False)

        from app.services.voice import handle_voice_question, _skribby_ws_urls
        _skribby_ws_urls["inc-voice-001"] = "wss://fake.skribby.io/ws"

        await handle_voice_question(
            incident_id="inc-voice-001",
            speaker="Carol",
            text="Sprynt, what files are suspicious?",
        )

    # Chat message was sent
    mock_chat.assert_called_once_with(
        "The auth-service pod is crash-looping.",
        "wss://fake.skribby.io/ws",
    )

    # Dashboard broadcast contains the answer
    voice_answers = [m for m in dashboard_msgs if m.get("type") == "voice_answer"]
    assert len(voice_answers) == 1
    assert voice_answers[0]["answer"] == "The auth-service pod is crash-looping."
    assert voice_answers[0]["question_by"] == "Carol"

    # Status transitions: speaking → listening
    status_sequence = [s["status"] for s in statuses]
    assert "speaking" in status_sequence
    assert "listening" in status_sequence
    assert status_sequence.index("speaking") < status_sequence.index("listening")


# ---------------------------------------------------------------------------
# Test: chat-message failure → dashboard-only fallback
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_voice_chat_message_fallback():
    """When send_chat_response fails, the answer should still be broadcast
    to the dashboard (FRD §23)."""

    dashboard_msgs: list[dict] = []

    async def capture_send(iid: str, payload: dict) -> None:
        if payload.get("type") != "agent_status":
            dashboard_msgs.append(payload)

    with (
        patch("app.services.voice.manager") as mock_manager,
        patch("app.services.voice.generate_spoken_answer", new_callable=AsyncMock, return_value="Check the payment-service logs."),
        patch("app.services.voice.get_active_tasks_summary", new_callable=AsyncMock, return_value=[]),
        patch("app.services.voice._get_deep_dive_summary", new_callable=AsyncMock, return_value=[]),
        patch("app.services.voice.send_chat_response", new_callable=AsyncMock, side_effect=ConnectionError("WS closed")),
        patch("app.services.voice.async_session_maker") as mock_session_maker,
    ):
        mock_manager.send = AsyncMock(side_effect=capture_send)

        mock_session = AsyncMock()
        mock_session_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_maker.return_value.__aexit__ = AsyncMock(return_value=False)

        from app.services.voice import handle_voice_question, _skribby_ws_urls
        _skribby_ws_urls["inc-voice-002"] = "wss://fake.skribby.io/ws"

        await handle_voice_question(
            incident_id="inc-voice-002",
            speaker="Dave",
            text="Sprynt, what's the latest?",
        )

    # Despite chat failure, dashboard still got the answer
    voice_answers = [m for m in dashboard_msgs if m.get("type") == "voice_answer"]
    assert len(voice_answers) == 1
    assert voice_answers[0]["answer"] == "Check the payment-service logs."


# ---------------------------------------------------------------------------
# Test: Skribby REST retry on transient errors
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_skribby_get_bot_retries_on_timeout():
    """get_bot should retry on timeout and succeed on the second attempt."""

    import httpx

    call_count = 0

    async def mock_get(url: str, **kwargs: Any) -> Any:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise httpx.TimeoutException("connection timed out")
        resp = MagicMock()
        resp.status_code = 200
        resp.raise_for_status = MagicMock()
        resp.json.return_value = {"status": "running", "id": "bot-retry"}
        return resp

    with (
        patch("app.services.skribby.httpx.AsyncClient") as MockClient,
        patch("app.services.skribby.asyncio.sleep", new_callable=AsyncMock),
    ):
        instance = AsyncMock()
        instance.get = AsyncMock(side_effect=mock_get)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=instance)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        from app.services.skribby import get_bot

        result = await get_bot("bot-retry")

    assert result["status"] == "running"
    assert call_count == 2


@pytest.mark.asyncio
async def test_skribby_get_bot_raises_after_max_retries():
    """get_bot should raise after exhausting retries."""

    import httpx

    with (
        patch("app.services.skribby.httpx.AsyncClient") as MockClient,
        patch("app.services.skribby.asyncio.sleep", new_callable=AsyncMock),
    ):
        instance = AsyncMock()
        instance.get = AsyncMock(side_effect=httpx.TimeoutException("timed out"))
        MockClient.return_value.__aenter__ = AsyncMock(return_value=instance)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        from app.services.skribby import get_bot

        with pytest.raises(httpx.TimeoutException):
            await get_bot("bot-fail")


# ---------------------------------------------------------------------------
# Test: ping events are silently ignored
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_listener_ignores_ping_events():
    """Ping events should be silently dropped without processing."""

    messages = [
        {"type": "ping"},
        {"type": "ping"},
        {"type": "stop"},
    ]

    ws_mock = MockWebSocket(messages)

    with (
        patch("app.services.skribby_listener.websockets.connect", return_value=ws_mock),
        patch("app.services.skribby_listener.manager") as mock_manager,
        patch("app.services.skribby_listener.process_parsed_chunk", new_callable=AsyncMock) as mock_process,
        patch("app.services.skribby_listener._fetch_recording_url", new_callable=AsyncMock, return_value=None),
        patch("app.services.voice.register_skribby_ws"),
    ):
        mock_manager.send = AsyncMock()

        from app.services.skribby_listener import listen_to_skribby

        await listen_to_skribby(
            websocket_url="wss://fake.skribby.io/ws",
            incident_id="inc-ping",
            bot_id="bot-ping",
        )

    mock_process.assert_not_called()
