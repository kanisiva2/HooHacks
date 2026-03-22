# Sprynt — File Structure

## Root

```
Sprynt/
├── .gitignore
├── docker-compose.yml
├── README.md
├── AGENTS.md
├── FILE_STRUCTURE.md
├── docs/
│   ├── FRD.md
│   ├── SETUP.md
│   └── WORK_SPLIT.md
├── backend/
└── frontend/
```

---

## Backend

```
backend/
├── .env                          # Never committed. See docs/SETUP.md §13.1
├── requirements.txt              # All pinned Python dependencies
├── Dockerfile                    # Production container
├── alembic.ini                   # Alembic configuration
│
├── alembic/
│   ├── env.py                    # Imports all ORM models, overrides DB URL to use direct connection (port 5432)
│   ├── script.py.mako            # Migration file template
│   └── versions/
│       └── <hash>_initial_schema.py   # Auto-generated initial migration
│
└── app/
    ├── __init__.py
    ├── main.py                   # FastAPI app factory. Registers CORS middleware and all routers.
    ├── config.py                 # Pydantic Settings. Loads every env var from backend/.env at startup.
    ├── database.py               # Async SQLAlchemy engine + async_sessionmaker (expire_on_commit=False).
    ├── deps.py                   # FastAPI dependencies: get_db() and get_current_user_id() (JWT verification).
    ├── ws_manager.py             # ConnectionManager singleton. Maintains incident_id → WebSocket map.
    │
    ├── models/                   # SQLAlchemy ORM models (E1 owns all)
    │   ├── __init__.py           # Imports all models so SQLAlchemy registers them with Base.metadata
    │   ├── workspace.py          # Workspace, WorkspaceMember
    │   ├── integration.py        # Integration (stores GitHub/Jira tokens per workspace)
    │   ├── incident.py           # Incident, IncidentEvent
    │   ├── action_item.py        # ActionItem (task state machine records)
    │   ├── transcript.py         # TranscriptChunk (per-chunk transcript storage)
    │   └── deep_dive.py          # DeepDiveResult (ranked suspect files + lines)
    │
    ├── schemas/                  # Pydantic request/response schemas (E3 owns)
    │   ├── __init__.py
    │   ├── workspace.py          # WorkspaceCreate, WorkspaceResponse, MemberAdd
    │   ├── incident.py           # IncidentCreate, IncidentUpdate, IncidentResponse
    │   ├── action_item.py        # ActionItemOut, TaskDecision
    │   ├── deep_dive.py          # DeepDiveResultOut, SuspectFile
    │   └── integration.py        # IntegrationStatus, ConnectRequest
    │
    ├── routers/                  # FastAPI route handlers
    │   ├── __init__.py
    │   ├── workspaces.py         # POST/GET /api/workspaces, POST /api/workspaces/{id}/members (E1)
    │   ├── incidents.py          # POST/GET/PATCH /api/incidents and /api/incidents/{id} (E1)
    │   ├── integrations.py       # GitHub + Jira OAuth connect/callback flows, status, disconnect (E3)
    │   ├── tasks.py              # GET /api/incidents/{id}/tasks (E3)
    │   ├── deep_dive.py          # GET /api/incidents/{id}/deep-dive, POST trigger (E3)
    │   ├── artifacts.py          # GET pre-signed S3 URLs for audio, transcript, report (E1)
    │   └── ws.py                 # WebSocket /ws/{incident_id} — dashboard real-time endpoint (E4)
    │
    └── services/                 # Business logic and external integrations
        ├── __init__.py
        ├── github.py             # get_repo_tree, get_file_content, get_recent_commits, get_commit_diff (E3)
        │                         #   → All use httpx.AsyncClient. File content is base64-decoded.
        ├── jira.py               # create_jira_issue, update_jira_assignee, get_jira_projects, get_jira_users (E3)
        │                         #   → Descriptions must be ADF format (not plain strings).
        ├── s3.py                 # upload_bytes, upload_text, get_presigned_url, key helpers (E3)
        │                         #   → Uses aioboto3 (never boto3 — boto3 blocks the event loop).
        ├── llm.py                # _call_llm, extract_tasks_from_chunk, detect_reassignment,
        │                         #   rank_suspect_files, identify_suspect_lines, generate_spoken_answer (E3)
        │                         #   → Routes to Anthropic (claude-sonnet-4-6) or OpenAI (gpt-4o).
        ├── skribby.py            # create_bot, stop_bot, get_bot, detect_service (E4)
        │                         #   → Calls Skribby REST API to manage meeting bots.
        ├── skribby_listener.py   # listen_to_skribby() — connects to Skribby's WebSocket as a client (E4)
        │                         #   → Parses transcript/status events and forwards to dashboard + parser.
        ├── transcript_parser.py  # parse_chunk() — persists chunks, detects questions, routes to task machine (E4)
        ├── task_machine.py       # TaskMachine class — propose, _activate, reassign, get_active_tasks_summary (E4)
        │                         #   → 15s stabilization timer. Cancels timer on reassignment before rescheduling.
        ├── deep_dive_agent.py    # run_deep_dive() — 6-step pipeline: tree → commits → rank → content → lines → persist (E4)
        └── voice.py              # handle_question(), _send_chat_message(), _synthesize_and_play() (E4)
                                  #   → Generates answer via LLM, sends to Skribby chat + dashboard.
                                  #   → ElevenLabs TTS is stretch (eleven_turbo_v2 only).
```

---

## Frontend

```
frontend/
├── .env.local                    # Never committed. See docs/SETUP.md §13.2
├── package.json                  # All npm dependencies with versions
├── next.config.ts                # Next.js config
├── tsconfig.json                 # TypeScript config with @/* path alias
├── tailwind.config.ts            # Tailwind with Zinc base color + CSS variable tokens
├── postcss.config.mjs
│
├── public/
│   └── favicon.ico
│
├── app/                          # Next.js App Router (E2 owns all)
│   ├── globals.css               # Tailwind directives + CSS variable definitions (light/dark)
│   ├── layout.tsx                # Root layout — wraps app in SupabaseProvider + QueryProvider, loads Inter font
│   ├── page.tsx                  # Root redirect → /dashboard or /login
│   │
│   ├── login/
│   │   └── page.tsx              # Email/password sign-in and sign-up via Supabase Auth
│   │                             #   → Redirects to /dashboard on success, /onboarding for new accounts
│   │
│   ├── onboarding/
│   │   └── page.tsx              # First-run flow: create workspace + connect GitHub/Jira
│   │
│   ├── dashboard/
│   │   └── page.tsx              # Active incidents overview, agent status, recent tasks, quick launch
│   │
│   ├── incidents/
│   │   ├── page.tsx              # Incident list with status badges and timestamps
│   │   └── [id]/
│   │       └── page.tsx          # Live incident room: transcript feed, task board, agent status badge
│   │
│   ├── deep-dive/
│   │   └── [id]/
│   │       └── page.tsx          # Suspect file list, Monaco code panel, evidence cards
│   │
│   ├── integrations/
│   │   └── page.tsx              # GitHub repo connection + Jira project connection cards
│   │
│   └── settings/
│       └── page.tsx              # Voice settings, default repo, default Jira project, workspace metadata
│
├── components/
│   │
│   ├── providers/
│   │   ├── SupabaseProvider.tsx  # Supabase client context. Client created once with useState(() => createClient()).
│   │   └── QueryProvider.tsx     # TanStack QueryClientProvider + ReactQueryDevtools (dev only)
│   │
│   ├── layout/
│   │   ├── Sidebar.tsx           # Desktop nav sidebar: Dashboard, Incidents, Deep Dive, Integrations, Settings
│   │   └── MobileNav.tsx         # Bottom tab bar for mobile viewports
│   │
│   ├── shared/
│   │   ├── ProtectedPage.tsx     # Session check wrapper. Redirects to /login if no Supabase session.
│   │   └── OnboardingGate.tsx    # Redirects to /onboarding if user has no workspace set up
│   │
│   ├── dashboard/
│   │   ├── ActiveIncidentCard.tsx    # Card showing incident title, severity, elapsed time
│   │   ├── RecentTasksList.tsx       # Latest action items across all incidents
│   │   └── StartIncidentModal.tsx    # Modal form: title, severity, meeting link → POST /api/incidents
│   │
│   ├── incidents/
│   │   ├── TranscriptFeed.tsx    # Scrolling live transcript with speaker label + timestamp per chunk
│   │   ├── TaskBoard.tsx         # Action items grouped by status (proposed / active / synced / reassigned)
│   │   ├── AgentStatusBadge.tsx  # Shows bot join status, STT state, voice state from agentStatus store
│   │   └── IncidentHeader.tsx    # Incident title, severity badge, elapsed time, resolve/close controls
│   │
│   ├── deep-dive/
│   │   ├── SuspectFileList.tsx   # Ranked list of suspect files with confidence scores and reasons
│   │   ├── EvidenceCard.tsx      # Evidence text, related commit SHA, confidence badge
│   │   └── CodePanel.tsx         # Monaco Editor — read-only, highlighted suspect line range
│   │                             #   → 'use client' directive required (Monaco is browser-only)
│   │
│   └── integrations/
│       ├── GitHubCard.tsx        # Connect/disconnect GitHub OAuth, select default repo
│       └── JiraCard.tsx          # Connect/disconnect Jira OAuth, select default project
│
├── hooks/
│   ├── useWebSocket.ts           # Connects to /ws/{incident_id}. Routes messages to Zustand store.
│   │                             #   → Exponential backoff reconnection on disconnect.
│   ├── useIncident.ts            # TanStack Query hooks: useIncident, useIncidents, useIncidentTasks, useCreateIncident
│   └── useIntegrations.ts        # TanStack Query hook for GET /api/integrations/status
│
├── stores/
│   ├── incidentStore.ts          # Zustand: transcript[], actionItems[], deepDiveResults[], agentStatus
│   │                             #   → upsertActionItem matches on id (handles proposed→active→synced transitions)
│   └── workspaceStore.ts         # Zustand + persist: currentWorkspace, setWorkspace, clearWorkspace
│
├── lib/
│   ├── supabase.ts               # createClient() using createBrowserClient from @supabase/ssr
│   ├── api.ts                    # Axios instance with JWT request interceptor + 401 redirect interceptor
│   └── utils.ts                  # cn() helper (clsx + tailwind-merge)
│
└── types/
    ├── incident.ts               # Incident, IncidentEvent, IncidentSeverity, IncidentStatus
    ├── task.ts                   # ActionItem, TaskState
    └── deep_dive.ts              # SuspectFile, DeepDiveResult
```

---

## Key Rules (Quick Reference)

| Rule | Detail |
|------|--------|
| Supabase client | Use `createBrowserClient` from `@supabase/ssr` — not from `@supabase/supabase-js` |
| DB URL (app) | Pooler URL — port **6543** — in `config.py` / `DATABASE_URL` |
| DB URL (Alembic) | Direct URL — port **5432** — in `alembic/env.py` / `DATABASE_DIRECT_URL` |
| `expire_on_commit` | Must be `False` on `async_sessionmaker` — prevents `DetachedInstanceError` |
| S3 | Always `aioboto3` — never `boto3` (blocks the event loop) |
| HTTP calls | Always `httpx.AsyncClient` — never `requests` inside async handlers |
| GitHub file content | Always `base64.b64decode(data["content"])` before use |
| Jira descriptions | Must be Atlassian Document Format (ADF) — plain strings are rejected |
| ElevenLabs model | `eleven_turbo_v2` only — lowest latency for live meetings |
| Monaco Editor | `'use client'` directive required on any component that imports it |
| Service role key | Backend only — never in `.env.local` or any frontend file |
| Task stabilization | Cancel `_pending_timers[task_id]` before rescheduling on reassignment |

---

## Engineer Ownership Summary

| Path | Engineer | Primary Files |
|------|----------|---------------|
| Backend Core | E1 | `app/main.py`, `app/config.py`, `app/database.py`, `app/deps.py`, `app/models/*`, `app/routers/workspaces.py`, `app/routers/incidents.py`, `app/routers/artifacts.py`, `alembic/*` |
| Frontend | E2 | `frontend/app/*`, `frontend/components/*`, `frontend/hooks/*`, `frontend/stores/*`, `frontend/lib/*`, `frontend/types/*` |
| Integrations & Services | E3 | `app/services/github.py`, `app/services/jira.py`, `app/services/s3.py`, `app/services/llm.py`, `app/routers/integrations.py`, `app/routers/tasks.py`, `app/routers/deep_dive.py`, `app/schemas/*` |
| Real-Time Pipeline | E4 | `app/ws_manager.py`, `app/routers/ws.py`, `app/services/skribby.py`, `app/services/skribby_listener.py`, `app/services/transcript_parser.py`, `app/services/task_machine.py`, `app/services/deep_dive_agent.py`, `app/services/voice.py` |
