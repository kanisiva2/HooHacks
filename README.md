# Sprynt

Sprynt is an AI incident operator for engineering teams. It joins live outage calls, streams transcripts into a shared dashboard, extracts action items, runs repository-aware deep-dive investigations against GitHub, syncs work into Jira, and persists incident artifacts to AWS S3 for later retrieval.

## Why Sprynt

On-call incidents are usually fragmented across meeting notes, chat threads, ad hoc tickets, and a lot of manual repo digging. Sprynt centralizes that workflow into a single incident room:

- joins a live meeting through the Skribby meeting bot API
- streams transcript updates into the dashboard over WebSocket
- extracts and stabilizes action items before syncing them to Jira
- ranks suspect files and line ranges through a deep-dive GitHub investigation pipeline
- generates fix suggestions and PR-ready review flows for suspected code issues
- stores finalized incident artifacts such as transcript JSON in AWS S3

## Core Features

- Real-time incident dashboard with transcript, task board, and deep-dive panels
- Supabase-backed authentication and workspace access control
- GitHub integration for repo investigation and suggested fixes
- Jira integration for incident task syncing
- Skribby meeting bot integration for live meeting participation and transcription
- AWS S3 artifact storage for persisted incident transcripts
- Fix-review workflow with side-by-side Monaco diff view and PR creation

## Architecture

### Frontend

- Next.js App Router
- TypeScript
- React Query for server state
- Zustand for live incident state
- Monaco Editor for code review and diff views

### Backend

- FastAPI
- Async SQLAlchemy + Alembic
- Supabase Postgres
- WebSocket fanout for real-time incident updates
- aioboto3 for S3 storage

### Integrations

- Supabase Auth
- GitHub REST + OAuth
- Jira REST + OAuth 2.0
- Skribby meeting bot API
- AWS S3
- Anthropic / OpenAI / Gemini-backed LLM workflows

## Repository Layout

```text
.
├── backend/             # FastAPI app, models, routers, services, Alembic
├── frontend/            # Next.js app, dashboard UI, hooks, stores, components
├── docs/                # FRD, work split, and supporting project docs
├── FILE_STRUCTURE.md    # Detailed file map
├── AGENTS.md            # Agent instructions and implementation rules
└── docker-compose.yml   # Local backend container workflow
```

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker Desktop
- Supabase project
- AWS S3 bucket and IAM credentials
- Skribby API key
- GitHub OAuth app
- Jira OAuth app
- At least one LLM provider key

### Environment Files

Backend configuration lives in:

- [backend/.env](/Users/kanisiva/Documents/Code/VSCode/Projects/HooHacks/backend/.env)

Frontend configuration lives in:

- `frontend/.env.local`

Do not commit secrets. The backend expects values for Supabase, S3, Skribby, GitHub, Jira, and your LLM provider.

## Local Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on [http://localhost:3000](http://localhost:3000).

### Backend: Python venv workflow

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend runs on [http://localhost:8000](http://localhost:8000).

### Backend: Docker workflow

```bash
docker compose build backend
docker compose up -d backend
docker compose logs -f backend
docker compose down
```

Use the Docker path when you want to run the backend in a reproducible, deployment-like environment instead of your local Python environment.

## Docker Notes

The project currently Dockerizes the backend only.

- [backend/Dockerfile](/Users/kanisiva/Documents/Code/VSCode/Projects/HooHacks/backend/Dockerfile) defines the FastAPI container image
- [backend/.dockerignore](/Users/kanisiva/Documents/Code/VSCode/Projects/HooHacks/backend/.dockerignore) keeps secrets and local cache files out of the image
- [docker-compose.yml](/Users/kanisiva/Documents/Code/VSCode/Projects/HooHacks/docker-compose.yml) provides a simple local container workflow

This is the same packaging path intended for Railway deployment.

## Transcript Persistence

Sprynt now persists finalized transcripts as JSON artifacts in S3:

- incidents continue using Postgres as the live transcript source
- when an incident is resolved or closed, the backend exports `transcript.json` to S3
- reopening old incidents can fall back to S3 if transcript rows are missing from Postgres
- incident pages can download the persisted transcript artifact directly

## Deployment Plan

The intended production deployment is:

- frontend on Vercel
- backend on Railway
- auth and Postgres on Supabase
- artifact storage on AWS S3

## Contributing

If you are contributing locally:

1. Read [AGENTS.md](/Users/kanisiva/Documents/Code/VSCode/Projects/HooHacks/AGENTS.md) for implementation rules and project context.
2. Review the planning docs in [docs](/Users/kanisiva/Documents/Code/VSCode/Projects/HooHacks/docs).
3. Keep backend code async-safe and frontend code aligned with the App Router conventions already used in the repo.

## Documentation

- [AGENTS.md](/Users/kanisiva/Documents/Code/VSCode/Projects/HooHacks/AGENTS.md)
- [FILE_STRUCTURE.md](/Users/kanisiva/Documents/Code/VSCode/Projects/HooHacks/FILE_STRUCTURE.md)
- [docs/FRD.md](/Users/kanisiva/Documents/Code/VSCode/Projects/HooHacks/docs/FRD.md)
- [docs/WORK_SPLIT.md](/Users/kanisiva/Documents/Code/VSCode/Projects/HooHacks/docs/WORK_SPLIT.md)

## Status

Sprynt is an actively developed project focused on incident response, AI-assisted repository investigation, and production-style full-stack infrastructure.
