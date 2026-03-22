import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import workspaces, incidents, integrations, tasks, deep_dive, artifacts, ws

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s: %(message)s")

app = FastAPI(
    title="Sprynt API",
    version="1.0.0",
    description="AI incident operator — FastAPI backend",
)

# ── CORS ──
# allow_credentials=True is required for Supabase cookie-based sessions from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──
app.include_router(workspaces.router, prefix="/api", tags=["workspaces"])
app.include_router(incidents.router, prefix="/api", tags=["incidents"])
app.include_router(integrations.router, prefix="/api", tags=["integrations"])
app.include_router(tasks.router, prefix="/api", tags=["tasks"])
app.include_router(deep_dive.router, prefix="/api", tags=["deep-dive"])
app.include_router(artifacts.router, prefix="/api", tags=["artifacts"])
app.include_router(ws.router, tags=["websocket"])  # no /api prefix — WebSocket path is /ws/{incident_id}


# ── Health check ──
@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok"}
