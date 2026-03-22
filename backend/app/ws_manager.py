from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Tracks one dashboard WebSocket connection per incident ID."""

    def __init__(self) -> None:
        self._connections: dict[str, WebSocket] = {}

    async def connect(self, incident_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[incident_id] = websocket

    def disconnect(self, incident_id: str) -> None:
        self._connections.pop(incident_id, None)

    async def send(self, incident_id: str, message: dict[str, Any]) -> None:
        websocket = self._connections.get(incident_id)
        if websocket is None:
            return

        try:
            await websocket.send_text(json.dumps(message))
        except Exception:
            logger.exception("ws_send_failed incident_id=%s", incident_id)
            self.disconnect(incident_id)


manager = ConnectionManager()
