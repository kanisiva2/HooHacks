# AGENTS.md — Sprynt

This file is the single point of entry for any coding agent working on Sprynt. Read this file in full before writing any code. It tells you what the project is, where to find authoritative details, and exactly what every task requires — its goal, constraints, what to inspect, and what to plan before implementing.

---

## 1. Project Summary

Sprynt is an AI incident operator for engineering teams. When a team is on an outage call, Sprynt joins the meeting as a bot participant, transcribes the conversation in real time, extracts action items and syncs them to Jira during the call, runs a deep dive investigation against the team's GitHub repository to surface suspect files and lines, and answers spoken questions aloud using text-to-speech. Everything streams live to a multi-panel web dashboard over WebSocket.

The stack is Python (FastAPI) on the backend, Next.js 14 (TypeScript, App Router) on the frontend, Supabase for authentication and Postgres, AWS S3 for artifact storage, Playwright for meeting bot automation, Deepgram for real-time speech-to-text, ElevenLabs for text-to-speech, and Anthropic/OpenAI for LLM-powered task extraction, code investigation, and question answering.

The system has six major subsystems: (1) the Playwright meeting bot that joins calls and captures audio, (2) the speech-to-text pipeline that produces real-time transcripts with speaker diarization, (3) the task state machine that extracts tasks from speech and syncs them to Jira through a stabilization workflow, (4) the deep dive agent that investigates GitHub repos using LLM-ranked file analysis, (5) the voice interaction pipeline that detects questions and speaks answers back into the meeting, and (6) the real-time WebSocket pipeline that streams all data to the frontend dashboard.

Four engineers work in parallel across five sprints. Work is split by domain to minimize merge conflicts: E1 owns backend core (FastAPI, DB, auth, models, incident lifecycle), E2 owns the entire frontend (Next.js, UI, state management, WebSocket hooks), E3 owns integration services (GitHub, Jira, S3, LLM clients, OAuth flows), and E4 owns the real-time pipeline (bot worker, STT, voice, task machine, deep dive agent, WebSocket infrastructure).

---

## 2. Document Reference

There are three authoritative documents. Always consult the relevant document before implementing. Never guess at a schema, endpoint signature, or configuration value — look it up.

### TECHNICAL_SPEC_Sprynt.md (the FRD)

This is the source of truth for all implementation details. It contains:

- **§1 Project Overview** — what Sprynt does and its architectural decisions.
- **§2 Repository Structure** — the complete file tree with every file's purpose annotated. Use this to understand where any piece of code belongs.
- **§3 Backend (FastAPI)** — app entry point (`main.py`), configuration (`config.py` with Pydantic Settings), and auth dependency (`deps.py`). Contains exact code for the FastAPI app factory, CORS setup, and router registration.
- **§4 Database** — async SQLAlchemy engine setup, all six ORM model files with complete column definitions, relationship declarations, and Alembic migration configuration. The database schema SQL is in §19.
- **§5 Frontend (Next.js)** — bootstrap command, all npm dependencies with versions, root layout, Supabase client setup, Supabase provider, API client with JWT interceptor, Zustand incident store with all actions, WebSocket hook, and Monaco code panel component. Contains exact code for each.
- **§6 Authentication** — Supabase Auth flow. Frontend uses `@supabase/ssr` `createBrowserClient`. Backend verifies JWTs with `python-jose` using `SUPABASE_JWT_SECRET`. Contains login page and protected page wrapper code.
- **§7 Meeting Bot** — Playwright bot runner, audio capture via Web Audio API injection, and platform-specific join logic. Contains exact code for bot launcher and audio capture.
- **§8 Speech-to-Text** — Deepgram streaming setup with Nova-2 model, diarization, interim results. Whisper fallback for batch mode. Contains exact code for both.
- **§9 Task State Machine** — state transitions (proposed → active → synced, with reassigned branch), 15-second stabilization delay, in-memory timer management, Jira sync on activation. Contains exact code for the full state machine service.
- **§10 Deep Dive Agent** — six-step pipeline: get repo tree, get recent commits/diffs, LLM rank suspect files, fetch file content, identify suspect lines, persist and broadcast results. Contains exact code.
- **§11 Voice Interaction** — ElevenLabs TTS synthesis with `eleven_turbo_v2`, audio injection into the meeting via Playwright, wake phrase detection, spoken answer generation. Contains exact code.
- **§12 API Integrations** — GitHub REST API client (tree, content, commits, diffs), Jira REST API v3 client (create issue, update assignee), GitHub OAuth flow, Jira OAuth 2.0 (3LO) flow. Contains exact code and OAuth URL patterns.
- **§13 Real-Time Pipeline** — WebSocket ConnectionManager (per-incident broadcast), dashboard WebSocket endpoint, audio ingest WebSocket endpoint. Contains exact code.
- **§14 AI Layer** — LLM client abstracting over Anthropic and OpenAI, with functions for task extraction, reassignment detection, file ranking, line identification, and spoken answer generation. Contains exact code with all system prompts.
- **§15 Artifact Storage** — S3 upload/download helpers using `aioboto3`, pre-signed URL generation, key naming conventions. Contains exact code.
- **§16 Environment Variables** — complete `.env` and `.env.local` templates with every variable annotated.
- **§17 Dependencies** — exact `requirements.txt` and `package.json` with pinned versions.
- **§18 Endpoint Reference** — every HTTP and WebSocket endpoint with method, path, auth, and description.
- **§19 Database Schema** — complete SQL DDL for all tables with indexes.
- **§20 WebSocket Message Contract** — exact JSON shapes for all four message types (transcript_chunk, action_item_update, deep_dive_update, agent_status).
- **§21 Key Implementation Rules** — 14 backend rules and 9 frontend rules that must never be violated. Read these before writing any code.

### SETUP.md

This document walks through full environment setup for every external service and local tool. It covers:

- **Prerequisites** — required system tools (Git, Node.js 20 via nvm, Python 3.11 via pyenv, Docker) with version requirements and verification commands.
- **Repository Setup** — cloning, directory skeleton creation, git branch naming strategy.
- **Supabase** — account creation at supabase.com, project creation, collecting connection details (Project URL, anon key, service role key, JWT secret, pooler URL on port 6543, direct URL on port 5432), enabling email/password auth, optional local CLI setup.
- **Backend Python Setup** — virtual environment, pip install from requirements.txt, Playwright chromium install, Alembic initialization.
- **Frontend Next.js Setup** — create-next-app scaffold, npm dependency installation, shadcn/ui initialization with Zinc base color.
- **AWS S3** — AWS account creation, bucket creation (Sprynt-artifacts, block public access), IAM user creation with S3FullAccess, access key generation.
- **GitHub OAuth App** — creation at github.com/settings/developers, callback URL configuration, client ID and secret collection, required scopes (repo, read:user).
- **Jira OAuth 2.0 (3LO)** — Atlassian developer account, free Jira Cloud site creation, OAuth 2.0 integration creation, scope configuration (read:jira-work, write:jira-work, read:jira-user), callback URL, client ID and secret.
- **Deepgram** — account creation, API key generation, $200 free credits, Nova-2 model usage.
- **ElevenLabs** — account creation, API key from profile, voice selection and Voice ID from dashboard, eleven_turbo_v2 model requirement.
- **LLM Providers** — Anthropic console key creation (primary, claude-sonnet-4-6), OpenAI key creation (required for Whisper even if Anthropic is primary LLM).
- **Playwright** — chromium binary install, Linux system dependencies, verification test.
- **Docker** — verification, compose usage note.
- **Environment Files** — complete `.env` and `.env.local` templates with security rules (never commit, never expose service role key to frontend).
- **Verification Checklist** — 11-point checklist to confirm everything works before starting sprint work.

### WORK_SPLIT.md

This document divides the project across four engineers and five sprints. It contains:

- **Path Overview** — E1 (Backend Core), E2 (Frontend), E3 (Integrations & Services), E4 (Real-Time Pipeline), each with their primary file ownership.
- **Sprint 1 (Days 1–3)** — Foundation. All paths independent. E1 builds FastAPI skeleton, all ORM models, Alembic migrations, auth dependency, workspace/incident router stubs. E2 scaffolds Next.js, creates Supabase provider, login page, protected routes, sidebar layout, dashboard stub. E3 builds GitHub/Jira/S3/LLM service modules, Pydantic schemas, integration router with OAuth flows. E4 builds WebSocket manager, WS endpoints, STT service, bot worker skeleton, transcript parser stub.
- **Sprint 2 (Days 4–7)** — Core Features. E1 completes incident CRUD with artifacts/transcript/deep-dive routers. E2 builds Zustand stores, WebSocket hook, incident room page with TranscriptFeed/TaskBoard/AgentStatusBadge, StartIncidentModal, incidents list. E3 builds integrations UI, onboarding page, OnboardingGate, GitHub repos and Jira projects endpoints, settings page. E4 implements the full task state machine with stabilization timers and Jira sync, deep dive agent pipeline, audio ingest WebSocket with STT integration, transcript parser with task machine wiring.
- **Sprint 3 (Days 8–11)** — Integration & Voice. E1 wires bot launch into incident creation, implements artifact export on close, adds IncidentEvent logging. E2 builds deep dive page with Monaco code panel, SuspectFileList, EvidenceCard, mobile responsive layout, populates dashboard. E3 implements Jira ADF description builder, token refresh, GitHub token validation, Jira user name matching, integration error handling with timeouts and rate limits. E4 implements voice synthesis and meeting injection, voice question handling, wires voice into transcript parser, implements auto deep dive trigger, completes audio injector.
- **Sprint 4 (Days 12–14)** — Polish & Edge Cases. All paths independent. E1 adds structured logging, request validation, workspace ownership checks, DB retry logic. E2 adds error boundaries, WebSocket reconnection with exponential backoff, loading skeletons, empty states, toast notifications. E3 adds Jira retry queuing, GitHub rate limit tracking, integration health checks, graceful degradation, S3 retry. E4 adds bot disconnect handling, Deepgram reconnection, Whisper fallback on repeated failures, ElevenLabs failure fallback.
- **Sprint 5 (Days 15–17)** — Final Integration & Deploy. E1 creates Dockerfiles and docker-compose, production CORS and WS config. E2 runs production build, fixes errors, adds metadata. E3 audits security (auth on all endpoints, key exposure, S3 policy, input sanitization, prompt injection review). E4 writes E2E test script, tests across meeting platforms, documents limitations, writes README.
- **File Ownership Summary** — table mapping every file to its primary and secondary owner.
- **Dependency Graph** — which engineer blocks whom in each sprint, with mitigation strategy (use mocks/stubs until dependencies are ready).

---

## 3. Mandatory Rules

Before implementing anything, internalize these rules. Violations cause runtime failures, security vulnerabilities, or data corruption.

### Backend Rules (from Technical Spec §21)

1. All route handlers must be `async def`. Never call synchronous blocking code inside them.
2. Supabase JWT verification uses `SUPABASE_JWT_SECRET` (from Supabase Settings → API → JWT Secret), not the anon key.
3. Use the Supabase pooler URL (port 6543) for the app's `DATABASE_URL`. Use the direct URL (port 5432) only for Alembic migrations. Mixing these causes connection failures.
4. `expire_on_commit=False` on `async_sessionmaker` is mandatory. Without it, async SQLAlchemy raises `DetachedInstanceError` on any attribute access after commit.
5. Run `playwright install chromium` after installing the Python package. The browser binary is not included in pip install.
6. The bot worker runs as a separate process. Never run Playwright inside a FastAPI request handler. Launch via `asyncio.create_task` or subprocess.
7. ElevenLabs uses the `eleven_turbo_v2` model, not `eleven_monolingual_v1`. Turbo has the lowest latency required for live meeting use.
8. Deepgram diarization requires `diarize=True` in `LiveOptions`. Without it, speaker labels are not returned.
9. Cancel the task stabilization timer on reassignment before creating a new one. Use `_pending_timers[task_id].cancel()`.
10. Jira REST API v3 requires descriptions in Atlassian Document Format (ADF). Plain strings are rejected.
11. All S3 operations use `aioboto3`, never `boto3`. boto3 is synchronous and blocks the event loop.
12. Use `httpx.AsyncClient` for all external HTTP calls. Never use `requests` inside async handlers.
13. GitHub file content from the API is base64-encoded. Always `base64.b64decode(data["content"])` before use.
14. The `/audio/{incident_id}` WebSocket endpoint is internal only. Do not expose it to the public internet.

### Frontend Rules (from Technical Spec §21)

1. Use `createBrowserClient` from `@supabase/ssr`, not from `@supabase/supabase-js`. The SSR package handles Next.js App Router cookie-based sessions correctly.
2. Create the Supabase client once with `useState(() => createClient())`. Creating it inline in render breaks auth state.
3. Only `NEXT_PUBLIC_SUPABASE_ANON_KEY` goes in `.env.local`. Never put `SUPABASE_SERVICE_ROLE_KEY` in the frontend — it bypasses Row Level Security.
4. Create `QueryClient` at module level or with `useState`, never inline in JSX. Recreating it breaks TanStack Query caching.
5. WebSocket URL uses `NEXT_PUBLIC_WS_URL` — `ws://` in dev, `wss://` in production.
6. Monaco Editor is client-only. Add `'use client'` directive to any component using `@monaco-editor/react`.
7. `upsertActionItem` in the Zustand store must handle both insert and update by matching on `id`. The task state machine sends multiple updates for the same task ID as it transitions states.
8. `ProtectedPage` component wraps every authenticated page. It checks the Supabase session client-side and redirects to `/login` if missing.
9. All pages in `app/` that use React hooks need the `'use client'` directive. Next.js App Router pages are server components by default.

---

## 4. Agent Operating Protocol

Follow this protocol for every task, without exception.

### Step 1 — Read Before You Write

Before touching any code, read the relevant sections of the technical spec. The section references are provided in every task below and in WORK_SPLIT.md. If a task says "ref: Technical Spec §9.2", open TECHNICAL_SPEC_Sprynt.md and read section 9.2 in full. The spec contains exact code, exact schemas, and exact configuration — do not improvise when the spec provides an answer.

### Step 2 — Plan Before You Implement

For every task, answer these questions before writing code:

1. **What files will I create or modify?** List them. Check the file ownership table in WORK_SPLIT.md — if you are modifying a file owned by another engineer, coordinate first.
2. **What are the inputs and outputs?** For a service function: what arguments does it take, what does it return, what side effects does it have? For an endpoint: what is the request schema, response schema, and status codes? For a component: what props does it take, what store does it read from, what actions does it dispatch?
3. **What are the dependencies?** Does this code call a service from another engineer's path? If that service is not yet implemented, create a stub or mock that matches the expected interface.
4. **What are the failure modes?** What happens if the external API returns an error? What happens if the database is unreachable? What happens if the LLM returns malformed JSON? Handle every failure mode explicitly.
5. **What must I verify after implementing?** Define your own acceptance test before you start.

### Step 3 — Implement Incrementally

Write code in small, testable increments. After each increment, verify it works before moving on. Do not write 500 lines and then debug.

### Step 4 — Inspect Before Committing

Before considering a task complete, inspect all of the following:

- The code matches the spec (function signatures, schemas, column types, endpoint paths).
- No mandatory rule from §3 above is violated.
- Async code is truly async (no blocking calls, no `requests`, no `boto3`).
- Error handling exists for all external calls (HTTP, WebSocket, database, LLM).
- Secrets are not exposed (no service role key in frontend, no JWT secret in client code).
- Types are correct (UUID types match between Python and Postgres, TypeScript types match API responses).

---

## 5. Task Reference

Every task from WORK_SPLIT.md is listed below with its goal, constraints, inspection requirements, and planning guidance. Tasks are organized by sprint and engineer path.

---

## 6. Quick Navigation

| I need to... | Read... |
|---|---|
| Understand what Sprynt does | §1 above, Technical Spec §1 |
| Find where a file goes | Technical Spec §2 (repo structure) |
| Look up an endpoint signature | Technical Spec §18 |
| Look up a database column | Technical Spec §4.2 (ORM) or §19 (SQL) |
| Look up a WebSocket message shape | Technical Spec §20 |
| Check an implementation rule | §3 above, Technical Spec §21 |
| Find who owns a file | WORK_SPLIT.md File Ownership Summary |
| Check what blocks what | WORK_SPLIT.md Dependency Graph |
| Set up a service account | SETUP.md (full walkthroughs) |
| Find an environment variable name | Technical Spec §16 |
| Find a dependency version | Technical Spec §17 |
| Find an external API doc link | Technical Spec §21 (External Documentation Links table) |
