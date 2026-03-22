# Sprynt — Work Split

**Version:** 2.0
**Engineers:** 4 (E1, E2, E3, E4)
**Structure:** 5 Sprints with sync points after each

---

## Path Overview

| Path | Engineer | Domain | Primary Files |
|------|----------|--------|--------------|
| **Path A** | E1 | Backend Core — FastAPI, DB, Auth, Config | `app/main.py`, `app/config.py`, `app/database.py`, `app/deps.py`, `app/models/*`, `app/routers/workspaces.py`, `app/routers/incidents.py`, `alembic/*` |
| **Path B** | E2 | Frontend — Next.js, UI, State, WebSocket | `frontend/app/*`, `frontend/components/*`, `frontend/hooks/*`, `frontend/stores/*`, `frontend/lib/*`, `frontend/types/*` |
| **Path C** | E3 | Integrations & Services — GitHub, Jira, S3, LLM | `app/services/github.py`, `app/services/jira.py`, `app/services/s3.py`, `app/services/llm.py`, `app/routers/integrations.py`, `app/routers/tasks.py`, `app/routers/deep_dive.py` |
| **Path D** | E4 | Real-Time Pipeline — Skribby Integration, Transcript Processing, Voice, WebSocket, Task Machine, Deep Dive | `app/services/skribby.py`, `app/services/voice.py`, `app/services/task_machine.py`, `app/services/deep_dive_agent.py`, `app/services/transcript_parser.py`, `app/ws_manager.py`, `app/routers/ws.py` |

---

## Sprint 1 — Foundation (Days 1–3)

**Goal:** Every engineer can run the backend and frontend locally. Database exists, auth works, and the skeleton of each subsystem is in place.

---

### E1 — Backend Skeleton, Database, Auth

**Deliverables:** Running FastAPI server, all ORM models, Alembic migrations, Supabase JWT auth dependency.

**Step 1 — App entry point and config** (ref: Technical Spec §3.2, §3.3)

Create `backend/app/main.py` exactly as specified in §3.2. This sets up the FastAPI app with CORS middleware and router registration. All routers will be empty stubs for now — just create the files with empty `APIRouter()` instances so the imports don't fail.

Create `backend/app/config.py` exactly as specified in §3.3. This uses `pydantic_settings.BaseSettings` to load all environment variables from `backend/.env`. Every field is typed and validated at startup. Include all variables listed: Supabase, AWS, LLM, ElevenLabs, STT, GitHub OAuth, and Jira OAuth.

**Step 2 — Database connection** (ref: Technical Spec §4.1)

Create `backend/app/database.py` as specified in §4.1. Key details:
- Use `create_async_engine` with the Supabase pooler URL (port 6543).
- Use `async_sessionmaker` with `expire_on_commit=False` — this is **mandatory** for async SQLAlchemy. Without it, accessing any attribute on a model after `commit()` raises `DetachedInstanceError`.
- The `init_db()` function runs `Base.metadata.create_all` — used for development only. Production uses Alembic.

**Step 3 — Auth dependency** (ref: Technical Spec §3.4)

Create `backend/app/deps.py` as specified in §3.4. This provides two FastAPI dependencies:
- `get_db()` — yields an async SQLAlchemy session.
- `get_current_user_id()` — extracts and verifies the Supabase JWT from the `Authorization: Bearer` header using `python-jose`. Returns the `sub` claim (Supabase user UUID string). Uses `SUPABASE_JWT_SECRET` with HS256 algorithm and `verify_aud=False`.

**Step 4 — All ORM models** (ref: Technical Spec §4.2)

Create every model file exactly as specified:
- `app/models/workspace.py` — `Workspace` and `WorkspaceMember` (§4.2)
- `app/models/integration.py` — `Integration` (§4.2)
- `app/models/incident.py` — `Incident` and `IncidentEvent` (§4.2)
- `app/models/action_item.py` — `ActionItem` (§4.2)
- `app/models/transcript.py` — `TranscriptChunk` (§4.2)
- `app/models/deep_dive.py` — `DeepDiveResult` (§4.2)

Make sure `app/models/__init__.py` imports all models so they're registered with SQLAlchemy's metadata.

**Step 5 — Alembic setup and initial migration** (ref: Technical Spec §4.3)

Configure Alembic:
1. Edit `alembic/env.py` to import all models and set `target_metadata = Base.metadata`.
2. Override the database URL in `env.py` to use the **direct** Supabase connection (port 5432), not the pooler URL. The pooler does not support DDL statements.
3. Generate the initial migration: `alembic revision --autogenerate -m "initial_schema"`
4. Apply: `alembic upgrade head`

Verify by checking the Supabase SQL Editor — all tables should exist.

**Step 6 — Workspace and Incident router stubs** (ref: Technical Spec §18)

Create `app/routers/workspaces.py` with the endpoints listed in §18 (Workspaces table):
- `POST /api/workspaces` — create workspace, also create a `WorkspaceMember` with role `"owner"`.
- `GET /api/workspaces` — list workspaces where user is a member.
- `GET /api/workspaces/{id}` — get workspace detail.
- `POST /api/workspaces/{id}/members` — add a member.

All endpoints use `get_current_user_id` and `get_db` dependencies.

Create `app/routers/incidents.py` with stubs for:
- `POST /api/incidents` — create incident (don't launch bot yet — that's E4's job).
- `GET /api/incidents` — list incidents for workspace.
- `GET /api/incidents/{id}` — get incident detail.
- `PATCH /api/incidents/{id}` — update status.

---

### E2 — Frontend Scaffold, Auth UI, Layout

**Deliverables:** Running Next.js app with Supabase auth, login page, protected routes, sidebar layout, and basic dashboard page.

**Step 1 — Scaffold Next.js** (ref: Technical Spec §5.1)

Run the `create-next-app` command from §5.1. Install all dependencies listed in §5.2.

**Step 2 — Supabase client and provider** (ref: Technical Spec §5.4, §5.5)

Create `lib/supabase.ts` as specified in §5.4 — uses `createBrowserClient` from `@supabase/ssr` (not from `@supabase/supabase-js`). This is critical for Next.js App Router cookie-based session handling.

Create `components/providers/SupabaseProvider.tsx` as specified in §5.5 — wraps the app in a Supabase client context. The client is created once with `useState(() => createClient())` to avoid re-creation on every render.

**Step 3 — Query provider** (ref: Technical Spec §5.3)

Create `components/providers/QueryProvider.tsx` — wraps children in `QueryClientProvider` from TanStack Query. Create the `QueryClient` at module level or with `useState`, never inline. Include `ReactQueryDevtools` in development.

**Step 4 — Root layout** (ref: Technical Spec §5.3)

Update `app/layout.tsx` as specified in §5.3 — wraps the app in `SupabaseProvider` and `QueryProvider`, loads the Inter font.

**Step 5 — API client** (ref: Technical Spec §5.6)

Create `lib/api.ts` as specified in §5.6 — Axios instance with interceptors that:
- Attach the Supabase JWT to every request.
- Redirect to `/login` on 401 responses.

**Step 6 — Login page** (ref: Technical Spec §6.2)

Create `app/login/page.tsx` as specified in §6.2. Provides email/password sign-in and sign-up via `supabase.auth.signInWithPassword` and `supabase.auth.signUp`. Redirects to `/dashboard` on success or `/onboarding` for new accounts.

**Step 7 — Protected page wrapper** (ref: Technical Spec §6.3)

Create `components/shared/ProtectedPage.tsx` as specified in §6.3. Checks Supabase session client-side; redirects to `/login` if no session. Shows a loading skeleton while checking.

**Step 8 — Layout components** (ref: Technical Spec §2 — `components/layout/`)

Create `components/layout/Sidebar.tsx` — desktop navigation sidebar with links to Dashboard, Incidents, Integrations, Settings. Use shadcn/ui components and Lucide icons.

Create `components/layout/MobileNav.tsx` — bottom tab bar for mobile view.

**Step 9 — Dashboard page stub**

Create `app/dashboard/page.tsx` wrapped in `ProtectedPage`. For now, just show a heading "Sprynt Dashboard" and placeholder cards for "Active Incidents" and "Recent Tasks". This will be populated in later sprints.

**Step 10 — Type definitions** (ref: Technical Spec §5.7 for type shapes)

Create the type files:
- `types/incident.ts` — `Incident`, `IncidentEvent` types matching the backend schemas.
- `types/task.ts` — `ActionItem` type.
- `types/deep_dive.ts` — `SuspectFile`, `DeepDiveResult` types.

---

### E3 — Integration Services (GitHub, Jira, S3, LLM)

**Deliverables:** Working GitHub, Jira, S3, and LLM service modules. Integration router with OAuth flows.

**Step 1 — GitHub service** (ref: Technical Spec §12.1)

Create `app/services/github.py` exactly as specified in §12.1. Implement all four functions:
- `get_repo_tree(token, repo_full_name)` — uses `GET /repos/{owner}/{repo}/git/trees/HEAD?recursive=1`. Returns flat list of file paths.
- `get_file_content(token, repo_full_name, file_path)` — uses `GET /repos/{owner}/{repo}/contents/{file_path}`. **Must base64-decode** the `content` field.
- `get_recent_commits(token, repo_full_name, limit)` — uses `GET /repos/{owner}/{repo}/commits`.
- `get_commit_diff(token, repo_full_name, sha)` — uses `GET /repos/{owner}/{repo}/commits/{sha}` with `Accept: application/vnd.github.diff`. Truncates to 10,000 chars.

All functions use `httpx.AsyncClient` (never `requests`).

**Step 2 — Jira service** (ref: Technical Spec §12.2)

Create `app/services/jira.py`. Implement:
- `create_jira_issue(access_token, cloud_id, project_key, summary, description, issue_type, assignee_account_id, priority)` — `POST /rest/api/3/issue`. **Critical:** Jira v3 requires descriptions in Atlassian Document Format (ADF), not plain strings. Convert the description string to ADF format:
  ```python
  adf_description = {
      "type": "doc", "version": 1,
      "content": [{"type": "paragraph", "content": [{"type": "text", "text": description}]}]
  }
  ```
- `update_jira_assignee(access_token, cloud_id, issue_key, new_owner_name)` — `PUT /rest/api/3/issue/{issue_key}`.
- `get_jira_projects(access_token, cloud_id)` — `GET /rest/api/3/project` — returns list of projects for the connected site.
- `get_jira_users(access_token, cloud_id, query)` — for matching spoken names to Jira account IDs.

Base URL pattern: `https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/...`

**Step 3 — S3 service** (ref: Technical Spec §15.1)

Create `app/services/s3.py` exactly as specified in §15.1. Implement:
- `upload_bytes(key, data, content_type)` — uses `aioboto3` (not `boto3`). All S3 operations must be async.
- `upload_text(key, text)` — convenience wrapper.
- `get_presigned_url(key, expires_in)` — generates temporary download URLs. Default 1-hour expiry.
- Key helper functions: `incident_audio_key()`, `incident_transcript_key()`, `incident_report_key()`.

**Step 4 — LLM service** (ref: Technical Spec §14.1)

Create `app/services/llm.py` as specified in §14.1. Implement:
- `_call_llm(system, user, max_tokens)` — abstraction that routes to Anthropic or OpenAI based on `LLM_PROVIDER` config. Uses `claude-sonnet-4-6` for Anthropic or `gpt-4o` for OpenAI. All calls are async.
- `extract_tasks_from_chunk(text, speaker)` — returns list of task dicts. System prompt instructs JSON-only output.
- `detect_reassignment(text, active_tasks)` — returns `{"task_id": ..., "new_owner": ...}` or `None`.
- `rank_suspect_files(transcript_summary, file_tree, recent_commits, top_n)` — returns ranked suspect files.
- `identify_suspect_lines(file_content, incident_context, commit_context)` — returns `{"start": int, "end": int}` or `None`.
- `generate_spoken_answer(question, incident_summary, deep_dive_results, active_tasks)` — generates concise spoken answers.

All LLM functions must strip markdown code fences from responses before JSON parsing.

**Step 5 — Pydantic schemas** (ref: Technical Spec §2 — `app/schemas/`)

Create request/response schemas:
- `app/schemas/workspace.py` — `WorkspaceCreate(name: str)`, `WorkspaceResponse(id, name, owner_user_id, created_at)`.
- `app/schemas/incident.py` — `IncidentCreate(workspace_id, title, severity, meeting_link)`, `IncidentResponse(...)`.
- `app/schemas/action_item.py` — `ActionItemOut(...)`, `TaskDecision(...)`.
- `app/schemas/deep_dive.py` — `DeepDiveResultOut(...)`, `SuspectFile(...)`.
- `app/schemas/integration.py` — `IntegrationStatus(has_github, has_jira)`, `ConnectRequest(...)`.

**Step 6 — Integrations router** (ref: Technical Spec §12.3, §12.4, §18)

Create `app/routers/integrations.py` with the full OAuth connect and callback flows:
- `GET /api/integrations/github/connect` — redirects to GitHub OAuth authorize URL with `client_id`, `redirect_uri`, `scope=repo read:user`, and `state={workspace_id}:{user_id}`.
- `GET /api/integrations/github/callback` — exchanges code for access token via `POST https://github.com/login/oauth/access_token`. Stores in `integrations` table.
- `GET /api/integrations/jira/connect` — redirects to Atlassian OAuth with audience, scopes (`read:jira-work write:jira-work read:jira-user offline_access`), and `response_type=code`.
- `GET /api/integrations/jira/callback` — exchanges code for tokens, fetches `cloud_id` from accessible-resources endpoint, stores everything.
- `GET /api/integrations/status` — returns `{has_github: bool, has_jira: bool}` for the user's workspace.
- `DELETE /api/integrations/{provider}` — disconnects an integration.

---

### E4 — Real-Time Infrastructure (WebSocket, Skribby Service, Transcript Parser)

**Deliverables:** WebSocket manager, WS endpoint, Skribby API service, transcript parser skeleton.

**Step 1 — WebSocket connection manager** (ref: Technical Spec §13.1)

Create `app/ws_manager.py` exactly as specified in §13.1. The `ConnectionManager` class:
- Maintains a dict of `incident_id → WebSocket`.
- `connect(incident_id, websocket)` — accepts and stores.
- `disconnect(incident_id)` — removes.
- `send(incident_id, message)` — serializes dict to JSON and sends. Catches send errors and disconnects.

Export a module-level `manager = ConnectionManager()` singleton.

**Step 2 — WebSocket endpoint** (ref: Technical Spec §13.2)

Create `app/routers/ws.py` with:
- `@router.websocket("/ws/{incident_id}")` — the dashboard WebSocket. Accepts the connection, registers with the manager, and keeps alive by reading (client pings). On disconnect, removes from manager.

Note: The `/audio/{incident_id}` ingest endpoint from the old spec is **no longer needed**. Skribby handles audio capture and STT internally. Our backend connects to Skribby's WebSocket as a client, not as a server receiving audio.

**Step 3 — Skribby API service**

Create `app/services/skribby.py` — the service that manages Skribby meeting bots:
- `create_bot(meeting_url, bot_name, service, webhook_url)` — `POST https://platform.skribby.io/api/v1/bot` with `transcription_model: "deepgram-nova3-realtime"`, `bot_name`, `meeting_url`, `service` (auto-detect from URL: "zoom", "gmeet", or "teams"), and optional `webhook_url` for status updates. Returns the bot `id`, `websocket_url`, and `websocket_read_only_url`.
- `stop_bot(bot_id)` — `POST https://platform.skribby.io/api/v1/bot/{id}/stop`. Gracefully stops the bot.
- `get_bot(bot_id)` — `GET https://platform.skribby.io/api/v1/bot/{id}`. Returns bot status, recording URL, transcript data.
- `detect_service(meeting_url)` — helper that inspects the URL to determine `"zoom"`, `"gmeet"`, or `"teams"`.

All calls use `httpx.AsyncClient` with `Authorization: Bearer {SKRIBBY_API_KEY}` header.

**Step 4 — Skribby real-time WebSocket listener**

Create `app/services/skribby_listener.py` — connects to Skribby's `websocket_url` and forwards transcript events to the backend pipeline:
- `listen_to_skribby(websocket_url, incident_id, db)` — connects to Skribby's WebSocket using the `websockets` library. Parses incoming JSON messages and handles event types:
  - `"start"` — bot has joined and started recording. Broadcast agent status `"listening"`.
  - `"transcript"` — a transcript chunk with `speaker`, `text`, `timestamp`, `is_final`. Call `process_parsed_chunk()`.
  - `"stop"` — recording ended. Broadcast agent status `"idle"`. Disconnect.
  - `"error"` — transcription error. Log and broadcast agent status with error.
  - `"ping"` — ignore (keepalive).
- This runs as a background `asyncio.Task` created when the incident is started.

**Step 5 — Transcript parser skeleton**

Create `app/services/transcript_parser.py` with:
- `WAKE_PHRASES` list.
- `is_direct_address(text)` — detects if the bot is being spoken to.
- `process_parsed_chunk(incident_id, speaker, text, is_final, start_ts, end_ts)` — stub that persists transcript chunks to the database and broadcasts via WebSocket. Full logic (task machine integration, voice question detection) comes in Sprint 3.

---

### Sprint 1 Sync Point

**All engineers meet to verify:**
1. Backend starts and serves `/docs` with all router stubs registered.
2. Frontend starts, login works (create account → sign in → redirect to dashboard).
3. Supabase database has all tables (verify in SQL Editor).
4. `GET /api/workspaces` and `POST /api/workspaces` work from the Swagger UI with a valid Supabase JWT.
5. `POST /api/incidents` creates a row in the `incidents` table.
6. WebSocket at `ws://localhost:8000/ws/test-id` accepts a connection (test with a WebSocket client like `wscat`).
7. GitHub and Jira OAuth redirect flows work (redirect to provider login pages).
8. Skribby API service can create a bot (test with a real meeting URL or verify the HTTP call structure with a mock).
9. Merge all branches to `main`.

---

## Sprint 2 — Core Features (Days 4–7)

**Goal:** Incidents can be created with live WebSocket streaming. Task extraction works. Deep dive produces results. Frontend displays all panels.

---

### E1 — Incident Lifecycle, Task & Deep Dive Routers

**Deliverables:** Complete incident CRUD with artifacts, task router, deep dive router, transcript endpoint.

**Step 1 — Complete incident router** (ref: Technical Spec §18 — Incidents table)

Flesh out `app/routers/incidents.py`:
- `POST /api/incidents` — accepts `IncidentCreate` schema (workspace_id, title, severity, meeting_link). Creates the incident row. If `meeting_link` is provided, signal E4's bot launcher (for now, just set `bot_session_id` to a placeholder; actual bot launch comes in Sprint 3 integration).
- `GET /api/incidents` — filter by workspace_id (query param). Return list sorted by `created_at` descending.
- `GET /api/incidents/{id}` — return full incident with current status.
- `PATCH /api/incidents/{id}` — accept `status` field. If status changes to `"resolved"`, set `resolved_at`. If `"closed"`, also close all open action items.
- `GET /api/incidents/{id}/transcript` — query `TranscriptChunk` for the incident, ordered by `start_ts`. Return as JSON list.
- `GET /api/incidents/{id}/artifacts` — check S3 keys on the incident (audio_s3_key, transcript_s3_key, report_s3_key). For each non-null key, generate a pre-signed URL via `app/services/s3.get_presigned_url()`. Return dict of URLs.

**Step 2 — Tasks router** (ref: Technical Spec §18 — Tasks table)

Create `app/routers/tasks.py`:
- `GET /api/incidents/{id}/tasks` — list all `ActionItem` rows for the incident, ordered by `proposed_at`.
- `PATCH /api/incidents/{id}/tasks/{task_id}` — accept partial update (owner, priority, status). This allows manual override from the dashboard UI.

**Step 3 — Deep dive router** (ref: Technical Spec §18 — Deep Dive table)

Create `app/routers/deep_dive.py`:
- `GET /api/incidents/{id}/deep-dive` — list all `DeepDiveResult` rows ordered by `rank`.
- `POST /api/incidents/{id}/deep-dive/trigger` — manually trigger the deep dive agent. Requires the incident's workspace to have a GitHub integration. Fetch the integration, get the repo name from `metadata_json`, build a transcript summary from recent chunks, and call `run_deep_dive()` from E4's deep dive agent service.
- `GET /api/incidents/{id}/deep-dive/{result_id}/file` — fetch full file content from GitHub for the code panel. Use the stored `suspect_file` path, get the workspace's GitHub token, and call `get_file_content()`.

---

### E2 — Incident Room UI, Transcript Feed, Task Board

**Deliverables:** Live incident room page with transcript, task board, agent status. Start Incident modal.

**Step 1 — Zustand stores** (ref: Technical Spec §5.7)

Create `stores/incidentStore.ts` exactly as specified in §5.7. Key behaviors:
- `addTranscriptLine` — appends to transcript array.
- `upsertActionItem` — finds by `id` and updates in-place, or appends if new. This is critical because the task state machine sends multiple updates for the same task as it transitions through states.
- `setSuspectFiles` — replaces the entire array (deep dive sends a full ranked list each time).
- `setAgentStatus` — replaces the agent status object.
- `reset()` — clears everything when leaving an incident room.

Create `stores/uiStore.ts` — tracks sidebar open/closed state, active panel (transcript/tasks/deep-dive), mobile vs desktop breakpoint.

**Step 2 — WebSocket hook** (ref: Technical Spec §5.8)

Create `hooks/useIncidentSocket.ts` exactly as specified in §5.8. Connects to `ws://localhost:8000/ws/{incidentId}`. Parses incoming messages and dispatches to the correct store action based on `msg.type`: `transcript_chunk`, `action_item_update`, `deep_dive_update`, `agent_status`.

**Step 3 — TanStack Query hooks**

Create `hooks/useIncident.ts`:
- `useIncident(incidentId)` — `useQuery` that fetches `GET /api/incidents/{id}`.
- `useIncidents(workspaceId)` — `useQuery` that fetches `GET /api/incidents?workspace_id={id}`.

Create `hooks/useTasks.ts`:
- `useTasks(incidentId)` — `useQuery` that fetches `GET /api/incidents/{id}/tasks`.
- `useUpdateTask()` — `useMutation` that `PATCH`es a task with optimistic update.

**Step 4 — Start Incident modal** (ref: Technical Spec §2 — `StartIncidentModal.tsx`)

Create `components/incident/StartIncidentModal.tsx`:
- Form fields: Title (required), Severity (select: P1/P2/P3/P4), Meeting Link (optional URL).
- Uses `react-hook-form` with `zod` validation.
- On submit, `POST /api/incidents` and redirect to `/incidents/{id}`.
- Use shadcn/ui `Dialog`, `Input`, `Select`, `Button`.

**Step 5 — Incidents list page** (ref: Technical Spec §2 — `incidents/page.tsx`)

Create `app/incidents/page.tsx`:
- Wrapped in `ProtectedPage`.
- Displays a list of incidents (title, severity badge, status, created_at) fetched from `useIncidents`.
- "Start Incident" button opens the `StartIncidentModal`.
- Clicking an incident navigates to `/incidents/{id}`.

**Step 6 — Live incident room page** (ref: Technical Spec §2 — `incidents/[incidentId]/page.tsx`)

Create `app/incidents/[incidentId]/page.tsx`:
- Wrapped in `ProtectedPage`.
- Calls `useIncidentSocket(incidentId)` to establish WebSocket.
- Three-panel layout (responsive):
  - **Left panel:** `TranscriptFeed` — auto-scrolling list of transcript lines from Zustand store.
  - **Center panel:** `TaskBoard` — kanban columns: Proposed, Active, Synced.
  - **Right panel:** Deep dive preview — shows top 3 suspect files with confidence badges.
- Top bar: Incident title, severity badge, `AgentStatusBadge`, "Resolve Incident" button.

**Step 7 — TranscriptFeed component** (ref: Technical Spec §2)

Create `components/incident/TranscriptFeed.tsx`:
- Renders `transcript` array from Zustand store.
- Each line shows speaker label (bold) and text.
- Partial lines (is_final=false) shown in gray/italic.
- Auto-scrolls to bottom on new lines. Use a `useEffect` with a ref on a sentinel div.

**Step 8 — TaskBoard component** (ref: Technical Spec §2)

Create `components/incident/TaskBoard.tsx`:
- Two columns: **Proposed** (yellow) and **Synced** (green). The Active column has been removed — tasks move directly from Proposed to Synced on user approval.
- Each card shows: `normalized_task`, `owner`, `priority` badge, `confidence` badge.
- Proposed cards show an **Approve** button (triggers Jira sync and moves to Synced) and a **Dismiss** button (removes the task from the board).
- Synced cards show Jira issue key as a link.
- Dismissed tasks are filtered out of the board.
- Uses `actionItems` from Zustand store, filtered by status.

**Step 9 — AgentStatusBadge** (ref: Technical Spec §2)

Create `components/incident/AgentStatusBadge.tsx`:
- Displays current agent state with an animated indicator.
- States: `idle` (gray), `joining` (yellow pulse), `listening` (green pulse), `speaking` (blue pulse), `investigating` (purple pulse).
- Shows `last_message` as tooltip or subtitle text.

---

### E3 — Integration UI, OAuth Completion, Onboarding

**Deliverables:** Working GitHub and Jira connect flows end-to-end. Onboarding page. Integration management page. Jira project and GitHub repo selection.

**Step 1 — Integrations page** (ref: Technical Spec §2 — `integrations/page.tsx`)

Create `app/integrations/page.tsx`:
- Wrapped in `ProtectedPage`.
- Two cards: **GitHub** and **Jira**.
- Each card shows connection status (connected/disconnected) fetched from `GET /api/integrations/status`.
- "Connect" button redirects to the backend OAuth connect endpoint (`/api/integrations/github/connect` or `/api/integrations/jira/connect`).
- "Disconnect" button calls `DELETE /api/integrations/{provider}`.
- After OAuth callback redirect, check URL params (`?github=connected` or `?jira=connected`) and show a success toast.

**Step 2 — Onboarding page** (ref: Technical Spec §2 — `onboarding/page.tsx`)

Create `app/onboarding/page.tsx`:
- Step 1: Create workspace (name input → `POST /api/workspaces`).
- Step 2: Connect GitHub (redirect to OAuth flow).
- Step 3: Connect Jira (redirect to OAuth flow).
- Step 4: Select default repo and Jira project.
- Each step shows completion status. User can skip optional steps.

**Step 3 — OnboardingGate component** (ref: Technical Spec §2 — `OnboardingGate.tsx`)

Create `components/shared/OnboardingGate.tsx`:
- Checks if user has at least one workspace and both integrations connected.
- If not, redirects to `/onboarding`.
- Used on dashboard and incident pages.

**Step 4 — GitHub repos endpoint**

Add to `app/routers/integrations.py`:
- `GET /api/integrations/github/repos` — uses the stored GitHub access token to call `GET https://api.github.com/user/repos?sort=updated&per_page=30`. Returns list of `{full_name, description, default_branch}`.

**Step 5 — Jira projects endpoint**

Add to `app/routers/integrations.py`:
- `GET /api/integrations/jira/projects` — uses the stored Jira access token and cloud_id to call `GET /rest/api/3/project`. Returns list of `{key, name}`.

**Step 6 — Settings page** (ref: Technical Spec §2 — `settings/page.tsx`)

Create `app/settings/page.tsx`:
- Default repository selection (dropdown populated from GitHub repos endpoint).
- Default Jira project selection (dropdown populated from Jira projects endpoint).
- Voice preferences (placeholder for Sprint 3).
- Save settings to workspace metadata or a new settings table.

---

### E4 — Task Machine, Deep Dive Agent, Skribby Transcript Pipeline

**Deliverables:** Working task state machine. Working deep dive agent. Skribby real-time WebSocket listener processes transcript events into the pipeline.

**Step 1 — Task state machine** (ref: Technical Spec §9.1, §9.2)

Create `app/services/task_machine.py`. This is a critical subsystem. Key implementation details:

- `process_transcript_chunk(incident_id, speaker, text, db, jira_access_token, jira_cloud_id, jira_project_key)`:
  1. First checks for **reassignments** — queries active/synced/proposed tasks, calls `detect_reassignment()` from E3's LLM service. If found, updates the task owner and sets status back to `"proposed"` so the user can re-approve.
  2. Then checks for **new task proposals** — calls `extract_tasks_from_chunk()`. For each extracted task, creates an `ActionItem` with status `"proposed"`. Tasks remain in `"proposed"` until the user explicitly approves them from the dashboard.

- **No automatic promotion or stabilization timer.** Tasks do not auto-advance. The user must click "Approve" on the dashboard to trigger Jira sync. This prevents noisy auto-creation of Jira tickets.

- `_sync_to_jira(task, ...)` — calls `create_jira_issue()` or `update_jira_assignee()` from E3's Jira service. Sets `jira_issue_key` and transitions to `"synced"`. On failure, reverts to `"proposed"` for retry. Called from the `/approve` endpoint in `tasks.py`.

- `_push_task_update(incident_id, task)` — broadcasts the task state to the dashboard WebSocket.

- **Approval and dismissal** are handled via dedicated endpoints in `app/routers/tasks.py`:
  - `POST /api/incidents/{id}/tasks/{task_id}/approve` — moves task from `proposed` to `synced`, triggers Jira sync immediately.
  - `POST /api/incidents/{id}/tasks/{task_id}/dismiss` — sets task status to `dismissed`, no Jira sync.

**Step 2 — Deep dive agent** (ref: Technical Spec §10.1)

Create `app/services/deep_dive_agent.py` exactly as specified in §10.1. Pipeline:
1. Notify UI: agent status → `"investigating"`.
2. `get_repo_tree()` — get all file paths from the repo.
3. `get_recent_commits()` + `get_commit_diff()` for top 5 commits.
4. `rank_suspect_files()` — LLM ranks files by likelihood (from E3's LLM service).
5. For each top suspect: `get_file_content()` + `identify_suspect_lines()`.
6. Persist `DeepDiveResult` rows to database.
7. Push results via WebSocket (`deep_dive_update` message).
8. Notify UI: agent status → `"listening"`.

**Step 3 — Complete Skribby real-time listener**

Flesh out `app/services/skribby_listener.py`:
- Connect to Skribby's `websocket_url` (returned when the bot was created).
- Parse incoming JSON messages. Handle the `"transcript"` event type by extracting `speaker`, `text`, `is_final`, `start_ts`, `end_ts` fields.
- For each transcript event, call `process_parsed_chunk()`.
- Handle `"start"` event by broadcasting agent status `"listening"`.
- Handle `"stop"` event by broadcasting agent status `"idle"` and fetching the final recording URL from Skribby's REST API.
- Handle `"error"` event by logging the error and broadcasting agent status with the error message.

**Step 4 — Complete transcript parser** (ref: Technical Spec §11.2)

Flesh out `app/services/transcript_parser.py`:
- `process_parsed_chunk(incident_id, speaker, text, is_final, start_ts, end_ts)`:
  1. Persist the chunk to `TranscriptChunk` table.
  2. Broadcast via WebSocket (`transcript_chunk` message).
  3. If `is_final` is True:
     - Call `process_transcript_chunk()` from the task machine (requires fetching Jira credentials from the workspace's integration).
     - Check `is_direct_address(text)` — if True, queue for voice response handling (stub for now; implemented in Sprint 3).

---

### Sprint 2 Sync Point

**All engineers meet to verify:**
1. Create an incident via the UI modal → see it listed → navigate to incident room.
2. WebSocket connects when entering the incident room.
3. Manually insert a transcript chunk via the backend (or test endpoint) → see it appear in the TranscriptFeed.
4. Manually trigger task extraction → see a task appear in the TaskBoard as "proposed" → click "Approve" to sync it to Jira and see it move to the "Synced" column.
5. GitHub and Jira OAuth flows complete end-to-end (tokens stored in DB).
6. Manually trigger deep dive → see suspect files appear in the incident room.
7. Skribby service can create a bot and the listener receives transcript events from the WebSocket (test with a real short meeting).
8. Merge all branches to `main`.

---

## Sprint 3 — Integration & Voice (Days 8–11)

**Goal:** The meeting bot joins calls. Voice Q&A works. Jira sync is live. Deep dive results display in Monaco. Mobile layout works.

---

### E1 — Bot Launch from Incident Creation, Artifact Storage

**Step 1 — Bot launch integration**

Update `POST /api/incidents` in `app/routers/incidents.py`:
- When `meeting_link` is provided, call E4's Skribby service to create a meeting bot:
  ```python
  from app.services.skribby import create_bot, detect_service
  
  service = detect_service(meeting_link)
  bot_result = await create_bot(
      meeting_url=meeting_link,
      bot_name="Sprynt AI",
      service=service,
  )
  ```
- Store `bot_result["id"]` as `bot_session_id` on the incident.
- Store `bot_result["websocket_url"]` in the incident metadata for the Skribby listener to use.
- Launch the Skribby WebSocket listener as a background task:
  ```python
  asyncio.create_task(
      listen_to_skribby(bot_result["websocket_url"], str(incident.id), db)
  )
  ```

**Step 2 — Incident close → stop bot**

Update `PATCH /api/incidents/{id}`:
- When status changes to `"resolved"` or `"closed"`, call `stop_bot(bot_session_id)` via the Skribby service.
- The Skribby listener will receive the `"stop"` event and clean up.

**Step 3 — Artifact export on incident close**

When an incident is resolved:
1. Compile all `TranscriptChunk` rows into a single text document. Upload to S3 via `upload_text(incident_transcript_key(id), full_transcript)`. Update `transcript_s3_key` on the incident.
2. Fetch the recording from Skribby: call `get_bot(bot_session_id)` to get `recording_url`, download the audio file via `httpx`, and upload to S3 via `upload_bytes(incident_audio_key(id), audio_data, "audio/webm")`. Update `audio_s3_key`.
3. Generate a markdown incident report (summary, timeline of events, tasks created, deep dive findings). Upload via `upload_text(incident_report_key(id), report_md)`. Update `report_s3_key`.

**Step 4 — IncidentEvent logging**

Throughout the incident lifecycle, log events to `incident_events`:
- `"bot_joined"` — when bot successfully enters the meeting.
- `"task_created"` — when an action item is created.
- `"deep_dive_started"` / `"deep_dive_completed"` — deep dive lifecycle.
- `"incident_resolved"` / `"incident_closed"` — status changes.
- `"voice_question"` / `"voice_answer"` — voice interactions.

Create a helper: `async def log_event(db, incident_id, event_type, payload=None)`.

---

### E2 — Deep Dive UI, Monaco Code Panel, Mobile Layout

**Step 1 — Deep dive page** (ref: Technical Spec §2 — `deep-dive/page.tsx`)

Create `app/incidents/[incidentId]/deep-dive/page.tsx`:
- Wrapped in `ProtectedPage`.
- Two-panel layout:
  - **Left:** `SuspectFileList` — ranked list of suspect files.
  - **Right:** `CodePanel` — Monaco editor showing the selected file.

**Step 2 — SuspectFileList component** (ref: Technical Spec §2)

Create `components/deep_dive/SuspectFileList.tsx`:
- Renders `suspectFiles` from Zustand store.
- Each item shows: file path, confidence score (as percentage), rank badge.
- Clicking a file selects it and populates the code panel.
- Use color-coded confidence: >80% red, >50% orange, <50% yellow.

**Step 3 — CodePanel with Monaco** (ref: Technical Spec §5.9)

Create `components/deep_dive/CodePanel.tsx` exactly as specified in §5.9:
- Uses `@monaco-editor/react` with `vs-dark` theme.
- Read-only mode.
- When `suspectLineRange` is set, apply a red background decoration to those lines and scroll to them.
- Detect language from file extension for syntax highlighting.
- **Must have `'use client'` directive** — Monaco is client-only.

**Step 4 — EvidenceCard component** (ref: Technical Spec §2)

Create `components/deep_dive/EvidenceCard.tsx`:
- Displays the evidence for a selected suspect file.
- Shows: reasoning text, commit SHA (linked to GitHub), commit message, confidence score.
- Rendered below the code panel or as a sidebar.

**Step 5 — Mobile responsive layout**

Update the incident room page and layout:
- On mobile (< 768px), switch to a single-column layout with tabs: Transcript | Tasks | Deep Dive.
- Use the `uiStore` to track `activePanel` and render only the selected panel.
- `MobileNav.tsx` should show the bottom tab bar only on mobile.
- Test at 375px width (iPhone SE) and 390px width (iPhone 14).

**Step 6 — Dashboard data population**

Update `app/dashboard/page.tsx`:
- Fetch active incidents count and recent tasks from the API.
- Show cards: "Active Incidents" (count + list), "Recent Tasks" (last 5 synced tasks with Jira links), "Quick Launch" (start incident button).

---

### E3 — Jira ADF, Token Refresh, Integration Hardening

**Step 1 — Jira ADF description builder**

The Jira REST API v3 rejects plain-string descriptions. Create a helper in `app/services/jira.py`:

```python
def build_adf_description(text: str, source_transcript: str = None) -> dict:
    content = [{"type": "paragraph", "content": [{"type": "text", "text": text}]}]
    if source_transcript:
        content.append({
            "type": "paragraph",
            "content": [
                {"type": "text", "text": "Source: ", "marks": [{"type": "strong"}]},
                {"type": "text", "text": source_transcript}
            ]
        })
    return {"type": "doc", "version": 1, "content": content}
```

Update `create_jira_issue` to use this for the description field.

**Step 2 — Jira token refresh**

Jira OAuth tokens expire after 1 hour. Implement token refresh:
- Before any Jira API call, check if `expires_at` is within 5 minutes of now.
- If so, `POST https://auth.atlassian.com/oauth/token` with `grant_type=refresh_token`.
- Update the stored `access_token`, `refresh_token`, and `expires_at` in the database.
- Create a helper: `async def get_valid_jira_token(db, workspace_id) -> str`.

**Step 3 — GitHub token validation**

GitHub OAuth tokens don't expire but can be revoked. Add error handling:
- On 401 from GitHub API, mark the integration as disconnected and notify the frontend.
- Create a helper: `async def get_valid_github_token(db, workspace_id) -> str | None`.

**Step 4 — Jira user matching**

The task machine produces owner names from speech (e.g., "Sarah"). Implement name-to-Jira-account matching:
- `get_jira_users(access_token, cloud_id, query)` — search Jira users by display name.
- In the task machine's `_sync_to_jira` (called when the user clicks "Approve" on the dashboard), attempt to match the spoken owner name to a Jira account ID. If no match, leave unassigned but include the spoken name in the description.

**Step 5 — Integration error handling**

Add comprehensive error handling to all integration services:
- HTTP timeouts (10s for GitHub, 15s for Jira).
- Rate limit handling (GitHub: check `X-RateLimit-Remaining` header; Jira: check 429 responses).
- Log all integration errors with `incident_id` for debugging.

---

### E4 — Voice Pipeline (Chat-Based), Auto Deep Dive Trigger

**Step 1 — Voice service (chat-based response)**

Create `app/services/voice.py`:
- `send_chat_response(text, incident_id, skribby_websocket_url)` — connects to or reuses the Skribby WebSocket and sends a chat-message action:
  ```python
  import websockets, json
  
  async def send_chat_response(text: str, skribby_ws_url: str):
      async with websockets.connect(skribby_ws_url) as ws:
          await ws.send(json.dumps({
              "action": "chat-message",
              "data": {"content": text}
          }))
  ```
- Note: ElevenLabs TTS synthesis is deferred to stretch scope. For MVP, the bot responds via meeting chat text and dashboard display.

**Step 2 — Voice question handling**

Complete `handle_voice_question()` in `app/services/transcript_parser.py`:
- Detects wake phrases.
- Sets agent status to `"speaking"`.
- Calls `generate_spoken_answer()` from E3's LLM service with full incident context.
- Calls `send_chat_response()` to send the answer to the meeting chat via Skribby.
- Broadcasts the answer text via WebSocket to the dashboard.
- Sets agent status back to `"listening"`.

**Step 3 — Wire voice into transcript parser**

Update `process_parsed_chunk()`:
- After persisting and broadcasting the chunk, check `is_direct_address(text)`.
- If True, spawn `handle_voice_question()` as a background task. This requires the Skribby `websocket_url` — store it in a module-level dict keyed by `incident_id` when the Skribby listener starts.

**Step 4 — Auto deep dive trigger**

Implement automatic deep dive triggering in `process_parsed_chunk()`:
- Track a counter of final transcript chunks per incident (in-memory dict).
- After 8 final chunks (approximately 30–40 seconds of conversation), automatically trigger `run_deep_dive()` if:
  - The incident's workspace has a GitHub integration.
  - No deep dive has been run yet for this incident.
- Build the transcript summary from the last 30 chunks.
- Log a `"deep_dive_started"` event.

---

### Sprint 3 Sync Point

**All engineers meet to verify:**
1. Creating an incident with a meeting link creates a Skribby bot and the bot joins the meeting.
2. Transcript chunks from Skribby's real-time WebSocket flow through the backend and appear in the TranscriptFeed UI.
3. Tasks extracted from transcript appear in the task board as "Proposed". User clicks "Approve" to sync to Jira with proper ADF descriptions. User clicks "Dismiss" to remove unwanted tasks.
4. Addressing Sprynt by name triggers a response in the meeting chat (via Skribby chat-message action) and in the dashboard.
5. Deep dive triggers automatically after ~8 transcript chunks and results display in the Monaco code panel.
6. Resolving an incident stops the Skribby bot, downloads the recording, and exports artifacts to S3.
7. Mobile layout works on a phone-sized viewport.
8. Merge all branches to `main`.

---

## Sprint 4 — Polish & Edge Cases (Days 12–14)

**Goal:** Error states, reconnection logic, loading states, production hardening.

---

### E1 — Backend Error Handling, Logging, Validation

- Add structured logging throughout the backend (use Python's `logging` with JSON formatter). Log every incident event, every LLM call (latency + token count), every integration error.
- Add request validation middleware — validate `workspace_id` ownership on all incident/task/deep-dive endpoints (user must be a member of the workspace).
- Handle database connection failures gracefully — retry logic for transient Supabase connection errors.
- Add rate limiting to public-facing endpoints (simple in-memory token bucket or FastAPI middleware).
- Audit all endpoints against the endpoint reference table (§18) to ensure completeness.

---

### E2 — Frontend Error States, Loading, Reconnection

- Add error boundaries around each panel (transcript, tasks, deep dive) so one failure doesn't crash the entire incident room.
- Add WebSocket reconnection logic in `useIncidentSocket` — exponential backoff with max 5 retries. Show a "Reconnecting..." banner when disconnected.
- Add loading skeletons for all data-fetching states (incidents list, task board with Proposed/Synced columns, deep dive results).
- Add empty states — "No incidents yet", "No tasks extracted", "Deep dive not started".
- Add toast notifications for key events: task synced to Jira, deep dive complete, bot joined meeting, errors.
- Test keyboard navigation and basic accessibility (focus management in modals, ARIA labels on badges).

---

### E3 — Integration Resilience, Retry Logic

- Implement retry logic for Jira issue creation failures — queue failed syncs and retry up to 3 times with exponential backoff.
- Handle GitHub API rate limits (5,000/hour for authenticated requests). Track usage and pause deep dive if approaching the limit.
- Add integration health checks — a background task that periodically validates stored tokens are still valid.
- Implement graceful degradation: if Jira is disconnected mid-incident, tasks should still be extracted and displayed but with a "Not synced — Jira disconnected" badge.
- Add S3 upload retry with `aioboto3` — S3 puts can fail transiently.

---

### E4 — Skribby Listener Resilience, Voice Fallback

- Handle Skribby bot disconnection — if the Skribby WebSocket closes unexpectedly, poll the Skribby REST API for bot status. If status is `"finished"` or `"not_admitted"`, broadcast agent status `"idle"` and log an event.
- Add Skribby WebSocket reconnection — if the WebSocket connection drops but the bot is still active (check via REST API), reconnect to the `websocket_url`.
- Handle Skribby transcript errors — if the `"error"` event fires, log the error, broadcast agent status, and fall back to polling the Skribby REST API for post-meeting transcript when the bot finishes.
- Handle chat-message failures — if the Skribby chat-message action fails, fall back to a text-only response displayed in the dashboard WebSocket (no meeting chat).
- Test the full transcript pipeline end-to-end with a real meeting (Zoom, Google Meet, or Teams).

---

### Sprint 4 Sync Point

**All engineers meet to verify:**
1. Error scenarios handled gracefully (disconnect WiFi → reconnect; revoke a GitHub token → see error in UI; Skribby bot fails to join → incident room shows error state).
2. Loading and empty states render correctly throughout the app.
3. Jira sync retries work when Jira API returns transient errors.
4. WebSocket reconnects after brief network interruptions.
5. Full end-to-end test: create incident → Skribby bot joins meeting → transcript streams → tasks extracted → deep dive runs → chat Q&A works → resolve incident → recording downloaded → artifacts in S3.
6. Merge all branches to `main`.

---

## Sprint 5 — Final Integration & Deploy Prep (Days 15–17)

**Goal:** Docker containerization, environment configuration for deployment, documentation, final end-to-end testing.

---

### E1 — Docker, Deployment Config

- Create `Dockerfile` for the backend (Python 3.11 base, install deps, expose port 8000). Note: Playwright and Chromium are **no longer required** since Skribby handles the meeting bot externally.
- Update `docker-compose.yml` with the backend service, environment variables from `.env`, and network configuration. The separate `bot_worker` container is **no longer needed**.
- Set up CORS for production (replace `localhost:3000` with the production frontend URL).
- Configure WebSocket URLs for production (`wss://` instead of `ws://`).
- Document the Alembic migration workflow for production deploys.

---

### E2 — Frontend Build, Production Config

- Configure `next.config.ts` for production: image domains, environment variable validation, strict mode.
- Set up production environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_API_URL` with production URLs).
- Run `npm run build` and fix any TypeScript errors or build warnings.
- Test production build locally with `npm start`.
- Add `<head>` metadata, favicon, and Open Graph tags.
- Final responsive testing across breakpoints.

---

### E3 — Security Audit, Encryption

- Audit all API endpoints for authorization (every endpoint checks workspace membership).
- Verify that `SUPABASE_SERVICE_ROLE_KEY` is never exposed to the frontend.
- Verify S3 bucket policy — no public access.
- Add input sanitization for all user-provided strings (incident titles, task descriptions).
- Document the OAuth token storage security model (note: production should use a secrets manager or at-rest encryption for tokens in the `integrations` table).
- Review all LLM prompts for prompt injection vulnerabilities (user-provided transcript text is passed to LLMs).

---

### E4 — End-to-End Testing, Documentation

- Write a comprehensive end-to-end test script that exercises every feature path.
- Test with Zoom, Google Meet, and Teams meetings via Skribby (document which platforms work reliably and any Skribby-specific quirks like bot detection or authentication requirements).
- Document the Skribby integration (API key setup, supported transcription models, webhook configuration, real-time WebSocket event format).
- Write the project `README.md` with: architecture overview, setup instructions (link to SETUP.md), running in dev, running in production, and troubleshooting common issues.
- Document the WebSocket message contract for future frontend/backend development.

---

### Sprint 5 Sync Point (Final)

**All engineers meet for final verification:**
1. `docker compose up` starts the backend successfully (no separate bot worker container needed).
2. Frontend production build works (`npm run build && npm start`).
3. Full end-to-end test passes on at least one meeting platform via Skribby.
4. All API endpoints return appropriate error codes for unauthorized access.
5. README is complete and a new developer could set up the project from scratch following the documentation.
6. All code is merged to `main`, tagged as `v2.0.0`.

---

## File Ownership Summary

This table shows which engineer owns each file to minimize merge conflicts. If you need to modify a file outside your ownership, coordinate with the owner.

| File / Directory | Primary Owner | Secondary |
|-----------------|--------------|-----------|
| `app/main.py` | E1 | — |
| `app/config.py` | E1 | — |
| `app/database.py` | E1 | — |
| `app/deps.py` | E1 | — |
| `app/models/*` | E1 | — |
| `app/schemas/*` | E3 | E1 |
| `app/routers/workspaces.py` | E1 | — |
| `app/routers/incidents.py` | E1 | E4 (bot launch) |
| `app/routers/integrations.py` | E3 | — |
| `app/routers/tasks.py` | E1 | E4 |
| `app/routers/deep_dive.py` | E1 | E4 |
| `app/routers/ws.py` | E4 | — |
| `app/ws_manager.py` | E4 | — |
| `app/services/github.py` | E3 | — |
| `app/services/jira.py` | E3 | — |
| `app/services/s3.py` | E3 | E1 |
| `app/services/llm.py` | E3 | — |
| `app/services/skribby.py` | E4 | — |
| `app/services/skribby_listener.py` | E4 | — |
| `app/services/voice.py` | E4 | — |
| `app/services/task_machine.py` | E4 | E3 (Jira calls) |
| `app/services/deep_dive_agent.py` | E4 | E3 (GitHub/LLM calls) |
| `app/services/transcript_parser.py` | E4 | — |
| `docker-compose.yml` | E1 | — |
| `alembic/*` | E1 | — |
| `frontend/app/layout.tsx` | E2 | — |
| `frontend/app/login/*` | E2 | — |
| `frontend/app/onboarding/*` | E2 | E3 |
| `frontend/app/dashboard/*` | E2 | — |
| `frontend/app/incidents/*` | E2 | — |
| `frontend/app/integrations/*` | E2 | E3 |
| `frontend/app/settings/*` | E2 | E3 |
| `frontend/components/*` | E2 | — |
| `frontend/hooks/*` | E2 | — |
| `frontend/stores/*` | E2 | — |
| `frontend/lib/*` | E2 | — |
| `frontend/types/*` | E2 | — |
| `README.md` | E4 | All |

---

## Dependency Graph Between Paths

Understanding who depends on whom prevents blocking:

**Sprint 1:** All paths are independent. Everyone builds their skeleton.

**Sprint 2:**
- E2 (Frontend) depends on E1 (Backend) for API endpoints to call.
- E4 (Task Machine) depends on E3 (LLM service) for `extract_tasks_from_chunk` and `detect_reassignment`.
- E4 (Deep Dive) depends on E3 (GitHub service) for `get_repo_tree`, `get_file_content`, etc.
- E1 (Deep Dive router) depends on E4 (Deep Dive agent) for `run_deep_dive`.
- E4 (Skribby listener) is mostly independent — depends only on E4's own `process_parsed_chunk`.

**Sprint 3:**
- E1 (Bot launch) depends on E4 (Skribby service) for `create_bot` and `listen_to_skribby`.
- E4 (Voice) depends on E3 (LLM) for `generate_spoken_answer`.
- E4 (Task machine Jira sync) depends on E3 (Jira service) for `create_jira_issue`.
- E2 (Monaco panel) is independent.

**Sprint 4:** All paths are independent (each engineer hardens their own domain).

**Sprint 5:** All paths converge for final integration.

**Mitigation strategy:** In Sprints 1–2, when a dependency isn't ready yet, use mocks or stubs. For example, E4 can stub `extract_tasks_from_chunk` to return a hardcoded task list until E3's LLM service is ready.