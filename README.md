# Sprynt

Sprynt is an AI incident operator for engineering teams. It joins live outage calls, listens to the conversation in real time, extracts action items, investigates the connected codebase, and helps teams move from incident triage to remediation inside a single workflow.

## Overview

Production incidents are chaotic. Teams jump between meeting calls, chat, tickets, dashboards, and repositories while trying to reconstruct what happened and decide who owns the next step. Sprynt was built to reduce that operational drag.

During an incident, Sprynt can:

- join a live meeting as an AI participant
- stream transcript updates into a shared incident dashboard
- extract and organize action items from the call
- sync work into Jira
- investigate the connected GitHub repository for likely root-cause files
- generate fix suggestions with side-by-side code review flows
- persist incident artifacts such as transcript and report files to AWS S3

The result is a single incident workspace that combines live collaboration, code investigation, task orchestration, and post-incident artifact storage.

## Key Capabilities

### Live Incident Room

Each incident gets its own dedicated room with:

- a real-time meeting transcript
- a task board that reflects live action item extraction
- a deep-dive panel for repository investigation
- live agent status and incident controls

### AI Task Extraction

Sprynt listens to the meeting transcript and identifies actionable follow-ups discussed during the call. These tasks are stabilized before being promoted and can be synced directly into Jira for downstream execution.

### Deep Dive Investigation

Sprynt analyzes the connected GitHub repository using recent repository context and incident discussion signals to:

- rank suspect files
- highlight likely problem ranges
- surface evidence supporting those findings

### Fix Review Workflow

Once likely code hotspots are identified, Sprynt can generate fix suggestions and present them in a side-by-side diff experience. Teams can review proposed edits in a code-review-style interface and move toward pull-request-ready changes.

### Incident Artifact Storage

Resolved incidents persist important artifacts to AWS S3, including:

- `transcript.json`
- `incident-report.md`

These artifacts can be reopened and downloaded later, making Sprynt useful not only during live incidents, but also after the fact for documentation and review.

## System Architecture

Sprynt is a full-stack application composed of:

- **Frontend:** Next.js, TypeScript, React Query, Zustand, Monaco Editor
- **Backend:** FastAPI, async SQLAlchemy, Alembic
- **Auth & Database:** Supabase Auth and Postgres
- **Artifact Storage:** AWS S3
- **Meeting Bot Layer:** Skribby
- **Integrations:** GitHub, Jira
- **AI Layer:** Anthropic / OpenAI / Gemini-backed workflows
- **Deployment Model:** Dockerized backend, Vercel frontend, Railway backend

## Product Flow

1. A user creates an incident and attaches a meeting link.
2. Sprynt joins the meeting as an AI participant.
3. Live transcript events stream into the dashboard over WebSocket.
4. The system extracts action items and manages ownership updates.
5. A deep-dive investigation ranks likely suspect files in the connected repository.
6. The team reviews proposed fixes through a structured diff workflow.
7. When the incident is resolved, transcript and report artifacts are saved to S3.

## What Makes Sprynt Distinct

- It combines **live meeting context** and **repository investigation** in one system.
- It treats incident response as both a **real-time collaboration problem** and a **code understanding problem**.
- It preserves the outcome of the incident through **persistent downloadable artifacts**.
- It supports a realistic engineering workflow that spans **Zoom-call chaos, Jira coordination, GitHub investigation, and post-incident documentation**.

## Deployment

Sprynt is designed around a production-style deployment architecture:

- **Frontend:** Vercel
- **Backend:** Railway
- **Containerization:** Docker
- **Storage:** AWS S3
- **Auth / Database:** Supabase

## Repository Structure

```text
.
├── backend/             # FastAPI API, routers, models, services, migrations
├── frontend/            # Next.js application and incident dashboard UI
├── docker-compose.yml   # Backend container workflow
└── README.md            # Project overview
```

## Documentation

- [backend/README.md](/Users/kanisiva/Documents/Code/VSCode/Projects/HooHacks/backend/README.md)
- [frontend/README.md](/Users/kanisiva/Documents/Code/VSCode/Projects/HooHacks/frontend/README.md)

## Status

Sprynt is a completed end-to-end project focused on AI-assisted incident response, repository investigation, artifact persistence, and production-style deployment architecture.
