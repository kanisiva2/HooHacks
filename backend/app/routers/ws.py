from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.ws_manager import manager

router = APIRouter()


@router.websocket("/ws/{incident_id}")
async def incident_ws(websocket: WebSocket, incident_id: str) -> None:
    await manager.connect(incident_id, websocket)
    try:
        while True:
            # Keep-alive/read loop. Client can send pings or heartbeat payloads.
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        manager.disconnect(incident_id)
    except Exception:
        manager.disconnect(incident_id)
    finally:
        manager.disconnect(incident_id)
