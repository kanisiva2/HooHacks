# Post-Sprint 3 Changes

This document captures changes made after the Sprint 3 sync point but before Sprint 4. These are design improvements and bug fixes discovered during Sprint 3 testing. All changes have been reflected in `WORK_SPLIT.md` and `FRD.md`.

---

## 1. Task State Machine — Approval-Based Flow

**What changed:** The task state machine no longer auto-promotes tasks. Previously, tasks followed `proposed → (15s timer) → active → synced`. Now tasks follow `proposed → (user clicks Approve) → synced`.

**Why:** During testing, the auto-promote flow created excessive Jira tickets from noisy early discussion. Every technical statement was extracted as a task and automatically synced to Jira after 15 seconds, spamming the project board with low-quality tickets. The new flow gives users control over what gets synced.

**Files changed:**

- `backend/app/services/task_machine.py` — Removed `_stabilize_and_sync`, `_pending_timers`, `STABILIZATION_SECONDS`. Tasks are created as `proposed` and stay there. `sync_task_to_jira()` is now a public function called by the approve endpoint. Reassignment detection sets the task back to `proposed` (previously set to `reassigned`).
- `backend/app/routers/tasks.py` — Added two new endpoints:
  - `POST /api/incidents/{id}/tasks/{task_id}/approve` — Moves task to `synced`, triggers Jira sync immediately.
  - `POST /api/incidents/{id}/tasks/{task_id}/dismiss` — Sets task status to `dismissed`, no Jira sync.
- `frontend/components/incident/TaskBoard.tsx` — Reduced from 3 columns (Proposed/Active/Synced) to 2 columns (Proposed/Synced). Proposed tasks show "Approve" and "Dismiss" buttons. Dismissed tasks are filtered out.
- `frontend/hooks/useTasks.ts` — Added `useApproveTask()` and `useDismissTask()` mutation hooks.
- `frontend/types/api.ts` — `TaskStatus` changed from `"proposed" | "active" | "synced" | "reassigned"` to `"proposed" | "synced" | "dismissed" | "closed"`.

**Impact on other engineers:**
- E4 (Real-Time Pipeline): The task machine no longer manages timers. `process_transcript_chunk` still works the same way — it extracts tasks and creates them as `proposed`. No timer-related edge cases to handle in Sprint 4.
- E2 (Frontend): Task board is now 2 columns. Sprint 4 loading skeletons and empty states should target Proposed/Synced columns only.
- E1 (Backend): No impact. The PATCH endpoint still exists for manual field edits.

---

## 2. Auto Deep-Dive Threshold Lowered

**What changed:** `AUTO_DEEP_DIVE_THRESHOLD` in `transcript_parser.py` reduced from `20` to `8`.

**Why:** 20 transcript chunks required ~90 seconds of continuous speech before the deep dive triggered. For hackathon demo purposes, 8 chunks (~30-40 seconds) provides a much faster feedback loop.

**File changed:** `backend/app/services/transcript_parser.py`

---

## 3. Skribby Transcription Model Fix

**What changed:** `DEFAULT_TRANSCRIPTION_MODEL` in `skribby.py` changed from `"deepgram-nova3-realtime"` to `"deepgram-realtime-v3"`.

**Why:** `"deepgram-nova3-realtime"` is not a valid Skribby API transcription model. The Skribby API returned `422 Unprocessable Entity` when creating bots. The correct model name is `"deepgram-realtime-v3"`.

**File changed:** `backend/app/services/skribby.py`

---

## 4. Skribby WebSocket Event Format Fix

**What changed:** The Skribby listener was rewritten to match Skribby's actual WebSocket protocol.

**Why:** The listener expected event type `"transcript"` with `data.text` and `data.speaker`, but Skribby sends:
- `type: "ts"` (not `"transcript"`) with `data.transcript` (not `data.text`), `data.speaker_name`, and `data.start`/`data.end`
- `type: "connected"` on initial connection with historical transcript backfill
- `type: "status-update"` for bot lifecycle transitions

The listener was connected and receiving events but silently ignoring them all because none matched the expected event types.

**File changed:** `backend/app/services/skribby_listener.py`

---

## 5. Datetime Timezone Fix in Incident Resolution

**What changed:** `incident.resolved_at = datetime.now(timezone.utc)` changed to `datetime.utcnow()` in `incidents.py`.

**Why:** The `resolved_at` column is `TIMESTAMP WITHOUT TIME ZONE`. Passing a timezone-aware datetime caused `asyncpg` to raise `"can't subtract offset-naive and offset-aware datetimes"`. This is the same class of bug that was fixed in `task_machine.py` during Sprint 3.

**File changed:** `backend/app/routers/incidents.py`

---

## 6. Backend Logging Configuration

**What changed:** Added `logging.basicConfig(level=logging.INFO)` to `main.py`.

**Why:** Without explicit logging configuration, Python's default log level is WARNING. All `logger.info()` calls from app modules (task machine, skribby listener, transcript parser, etc.) were silently suppressed. Only uvicorn's own logger showed INFO because it configures its own logging independently.

**File changed:** `backend/app/main.py`

---

## 7. LLM Error Handling Improvement

**What changed:** `identify_suspect_lines` in `llm.py` now checks for empty/null LLM responses before attempting JSON parse, and logs the raw response on failure.

**Why:** The LLM sometimes returns prose or empty strings instead of JSON when it cannot identify suspect lines. This caused `JSONDecodeError` tracebacks in the logs. The function already returned `None` on failure (non-fatal), but the improved handling avoids the noisy traceback and provides better debug info.

**File changed:** `backend/app/services/llm.py`
