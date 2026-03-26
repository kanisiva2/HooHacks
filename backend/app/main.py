import json
import logging
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import workspaces, incidents, integrations, tasks, deep_dive, ws
# S3 artifacts router — disabled until AWS credentials are configured.
# from app.routers import artifacts


# ── Structured JSON logging ──

class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_record: dict = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            log_record["exc"] = self.formatException(record.exc_info)
        return json.dumps(log_record)


# Replace any existing handlers (including basicConfig's) with the JSON handler
for _h in logging.root.handlers[:]:
    logging.root.removeHandler(_h)
_handler = logging.StreamHandler()
_handler.setFormatter(_JsonFormatter())
logging.root.setLevel(logging.INFO)
logging.root.addHandler(_handler)

logger = logging.getLogger(__name__)


# ── In-memory rate limiter (100 req/min per IP) ──

_RATE_LIMIT = 100
_RATE_WINDOW = 60  # seconds
_rate_store: dict[str, deque] = defaultdict(deque)


def _check_rate_limit(client_ip: str) -> bool:
    """Return True if the request is within the rate limit, False if exceeded."""
    now = time.monotonic()
    window = _rate_store[client_ip]
    while window and now - window[0] > _RATE_WINDOW:
        window.popleft()
    if len(window) >= _RATE_LIMIT:
        return False
    window.append(now)
    return True


app = FastAPI(
    title="Sprynt API",
    version="1.0.0",
    description="AI incident operator — FastAPI backend",
)


# ── Request logging + rate limiting middleware ──

@app.middleware("http")
async def request_middleware(request: Request, call_next):
    start = time.perf_counter()
    client_ip = request.client.host if request.client else "unknown"

    # Skip rate limiting for WebSocket upgrades (handled separately)
    if request.headers.get("upgrade", "").lower() != "websocket":
        if not _check_rate_limit(client_ip):
            logger.warning(
                "rate_limit_exceeded ip=%s path=%s", client_ip, request.url.path
            )
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
            )

    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "request method=%s path=%s status=%d duration_ms=%.1f ip=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        client_ip,
    )
    return response


# ── Global exception handler (catches unhandled non-HTTP exceptions) ──

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        raise exc  # let FastAPI's built-in handler deal with HTTPExceptions
    logger.exception(
        "unhandled_exception method=%s path=%s", request.method, request.url.path
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ── CORS ──
# allow_credentials=True is required for Supabase cookie-based sessions from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
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
# app.include_router(artifacts.router, prefix="/api", tags=["artifacts"])  # S3 disabled
app.include_router(ws.router, tags=["websocket"])  # no /api prefix — WebSocket path is /ws/{incident_id}


# ── Health check ──
@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok"}
