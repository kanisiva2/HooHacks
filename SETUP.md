# PagerPilot — Setup Guide

**Version:** 2.0
**Last Updated:** March 21, 2026

This document walks every engineer through the full environment setup required to develop PagerPilot. Complete **all sections** before starting any sprint work.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Repository Setup](#2-repository-setup)
3. [Supabase (Auth + Postgres)](#3-supabase-auth--postgres)
4. [Backend — Python + FastAPI](#4-backend--python--fastapi)
5. [Frontend — Next.js + TypeScript](#5-frontend--nextjs--typescript)
6. [AWS S3 (Artifact Storage)](#6-aws-s3-artifact-storage)
7. [GitHub OAuth App](#7-github-oauth-app)
8. [Jira OAuth 2.0 (3LO)](#8-jira-oauth-20-3lo)
9. [Deepgram (Speech-to-Text)](#9-deepgram-speech-to-text)
10. [ElevenLabs (Text-to-Speech)](#10-elevenlabs-text-to-speech)
11. [LLM Provider (Anthropic / OpenAI)](#11-llm-provider-anthropic--openai)
12. [Playwright (Meeting Bot)](#12-playwright-meeting-bot)
13. [Docker](#13-docker)
14. [Environment Files](#14-environment-files)
15. [Verification Checklist](#15-verification-checklist)

---

## 1. Prerequisites

Install these tools on your local machine before proceeding. All engineers need the same base tooling.

### System Requirements

- **OS:** macOS 12+, Ubuntu 22.04+, or Windows 11 with WSL2
- **RAM:** 8 GB minimum (16 GB recommended — Playwright + Next.js dev server are memory-hungry)
- **Disk:** 5 GB free for dependencies, browser binaries, and Docker images

### Core Tools

| Tool | Minimum Version | Install |
|------|----------------|---------|
| Git | 2.40+ | `brew install git` (macOS) / `sudo apt install git` (Ubuntu) |
| Node.js | 20 LTS | Install via [nvm](https://github.com/nvm-sh/nvm): `nvm install 20 && nvm use 20` |
| npm | 10+ | Bundled with Node.js 20 |
| Python | 3.11+ | Install via [pyenv](https://github.com/pyenv/pyenv): `pyenv install 3.11.9 && pyenv local 3.11.9` |
| pip | 23+ | Bundled with Python 3.11 |
| Docker | 24+ | [Docker Desktop](https://www.docker.com/products/docker-desktop/) (macOS/Windows) or `sudo apt install docker.io` (Ubuntu) |
| Docker Compose | 2.20+ | Bundled with Docker Desktop; Linux: `sudo apt install docker-compose-plugin` |

### Verify installations

```bash
git --version          # git version 2.40+
node --version         # v20.x.x
npm --version          # 10.x.x
python3 --version      # Python 3.11.x
pip3 --version         # pip 23.x+
docker --version       # Docker version 24.x+
docker compose version # Docker Compose version v2.20+
```

---

## 2. Repository Setup

### 2.1 Clone the Repository

```bash
git clone <your-repo-url> pagerpilot
cd pagerpilot
```

### 2.2 Create the Directory Structure

If the repo is freshly initialized, create the folder skeleton:

```bash
# Backend
mkdir -p backend/app/{models,schemas,routers,services}
mkdir -p backend/bot_worker
mkdir -p backend/alembic/versions
touch backend/app/__init__.py
touch backend/app/models/__init__.py
touch backend/app/schemas/__init__.py
touch backend/app/routers/__init__.py
touch backend/app/services/__init__.py
touch backend/bot_worker/__init__.py

# Frontend will be scaffolded by create-next-app (see Section 5)
```

### 2.3 Git Branch Strategy

Each engineer works on their own feature branch. Naming convention:

```
eng1/sprint-N-description
eng2/sprint-N-description
eng3/sprint-N-description
eng4/sprint-N-description
```

Merge to `main` only at sprint sync points after review.

---

## 3. Supabase (Auth + Postgres)

Supabase provides managed Postgres, authentication, and connection pooling. The team shares **one Supabase project** for development.

### 3.1 Create a Supabase Account and Project

1. Go to [https://supabase.com](https://supabase.com) and click **Start your project**.
2. Sign up with GitHub (recommended — simplifies future GitHub integrations).
3. Once logged in, click **New Project**.
4. Fill in:
   - **Name:** `pagerpilot-dev`
   - **Database Password:** Generate a strong password and **save it in your password manager** — you'll need it for `DATABASE_URL`.
   - **Region:** Choose the region closest to your team (e.g., `us-east-1` for US East).
5. Click **Create new project**. Wait 1–2 minutes for provisioning.

### 3.2 Collect Connection Details

After the project is created, go to **Project Settings** (gear icon in left sidebar):

**Settings → API:**
- `Project URL` → This is your `SUPABASE_URL` (e.g., `https://abcdefg.supabase.co`)
- `anon / public` key → This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe for frontend)
- `service_role` key → This is your `SUPABASE_SERVICE_ROLE_KEY` (backend only — **never expose to client**)
- `JWT Secret` → This is your `SUPABASE_JWT_SECRET` (backend only — used to verify JWTs)

**Settings → Database:**
- Under **Connection string**, switch to **URI** tab.
- **Connection pooling (port 6543):** This is your `DATABASE_URL` for the FastAPI app. Format:
  ```
  postgresql+asyncpg://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
  ```
  Replace `[password]` with the database password you set during project creation. **Important:** Prefix the scheme with `postgresql+asyncpg://` (not `postgres://`).
- **Direct connection (port 5432):** Used only for Alembic migrations. Same format but with port `5432` and the direct host (not pooler).

### 3.3 Enable Email/Password Auth

1. In the Supabase dashboard, go to **Authentication → Providers**.
2. Ensure **Email** is enabled (it is by default).
3. For development, go to **Authentication → Settings** and disable **Confirm email** so you don't need real email addresses during testing.

### 3.4 (Optional) Local Supabase via CLI

For fully offline development:

```bash
# Install Supabase CLI
brew install supabase/tap/supabase    # macOS
# or: npm install -g supabase         # Any platform

# Start local Supabase (requires Docker running)
cd pagerpilot
supabase init
supabase start
```

This prints local URLs and keys. Use these in your `.env` files instead of cloud values. Local Supabase runs Postgres on `localhost:54322` and Auth on `localhost:54321`.

---

## 4. Backend — Python + FastAPI

### 4.1 Create a Virtual Environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate    # macOS/Linux
# venv\Scripts\activate     # Windows
```

**Always activate the venv before working on the backend.** Your terminal prompt should show `(venv)`.

### 4.2 Install Dependencies

Create `backend/requirements.txt` with the contents from Technical Spec Section 17, then:

```bash
pip install -r requirements.txt
```

This installs FastAPI, SQLAlchemy (async), httpx, anthropic, openai, deepgram-sdk, elevenlabs, playwright, aioboto3, and all other dependencies.

### 4.3 Install Playwright Browser

Playwright needs a Chromium binary to drive the meeting bot:

```bash
playwright install chromium
```

This downloads ~150 MB. The binary is stored in `~/.cache/ms-playwright/`.

### 4.4 Initialize Alembic

```bash
cd backend
alembic init alembic
```

Then edit `alembic/env.py` to:
- Import all ORM models (see Technical Spec Section 4.3)
- Set `target_metadata = Base.metadata`
- Override the database URL to use the **direct connection** (port 5432), NOT the pooler URL

### 4.5 Run the Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Verify: Open `http://localhost:8000/docs` — you should see the FastAPI Swagger UI.

---

## 5. Frontend — Next.js + TypeScript

### 5.1 Scaffold the Project

From the repo root:

```bash
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --app \
  --src-dir=false \
  --import-alias "@/*"
```

Answer prompts:
- **ESLint:** Yes
- **Turbopack:** No (not needed)

### 5.2 Install Dependencies

```bash
cd frontend

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Server state management
npm install @tanstack/react-query @tanstack/react-query-devtools

# Client state management
npm install zustand

# HTTP client
npm install axios

# Monaco Editor for code display
npm install @monaco-editor/react

# Forms + validation
npm install react-hook-form zod @hookform/resolvers

# Types
npm install -D @types/node
```

### 5.3 Initialize shadcn/ui

shadcn/ui provides pre-built, customizable UI components on top of Radix UI:

```bash
cd frontend
npx shadcn@latest init
```

When prompted:
- **Style:** Default
- **Base color:** Zinc (matches the dark theme in the spec)
- **CSS variables:** Yes

Then add the components you'll need:

```bash
npx shadcn@latest add button input card dialog tabs badge select textarea
```

This installs Radix UI primitives, `class-variance-authority`, `clsx`, `tailwind-merge`, and `lucide-react` automatically.

### 5.4 Run the Frontend

```bash
cd frontend
npm run dev
```

Verify: Open `http://localhost:3000` — you should see the Next.js welcome page.

---

## 6. AWS S3 (Artifact Storage)

S3 stores meeting audio recordings, transcript exports, and generated reports.

### 6.1 Create an AWS Account

1. Go to [https://aws.amazon.com](https://aws.amazon.com) and click **Create an AWS Account**.
2. Follow the sign-up wizard. You'll need a credit card, but S3 free tier includes 5 GB storage and 20,000 GET requests/month for 12 months.
3. After account creation, sign in to the [AWS Management Console](https://console.aws.amazon.com).

### 6.2 Create an S3 Bucket

1. In the AWS Console, search for **S3** and open the S3 service.
2. Click **Create bucket**.
3. Configure:
   - **Bucket name:** `pagerpilot-artifacts` (must be globally unique — append your team name if taken, e.g., `pagerpilot-artifacts-teamname`)
   - **Region:** `us-east-1` (or match your Supabase region)
   - **Block all public access:** Keep **enabled** (artifacts are served via pre-signed URLs, not public access)
   - Leave all other settings as defaults.
4. Click **Create bucket**.

### 6.3 Create an IAM User for Programmatic Access

1. In the AWS Console, search for **IAM** and open it.
2. Go to **Users → Create user**.
3. **User name:** `pagerpilot-backend`
4. Click **Next**. On the permissions page, click **Attach policies directly**.
5. Search for and select **AmazonS3FullAccess** (for development; scope down to specific bucket in production).
6. Click **Next → Create user**.
7. Click on the new user → **Security credentials** tab → **Create access key**.
8. Select **Application running outside AWS** → **Next** → **Create access key**.
9. **Save both values immediately:**
   - `Access key ID` → This is `AWS_ACCESS_KEY_ID`
   - `Secret access key` → This is `AWS_SECRET_ACCESS_KEY`

   **You cannot retrieve the secret key again after leaving this page.**

---

## 7. GitHub OAuth App

The GitHub OAuth App allows PagerPilot to access users' repositories for the Deep Dive investigation.

### 7.1 Create a GitHub OAuth App

1. Go to [https://github.com/settings/developers](https://github.com/settings/developers) (or for an org: **Organization Settings → Developer settings → OAuth Apps**).
2. Click **New OAuth App**.
3. Fill in:
   - **Application name:** `PagerPilot Dev`
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:8000/api/integrations/github/callback`
4. Click **Register application**.
5. On the app page:
   - **Client ID** → This is `GITHUB_CLIENT_ID`
   - Click **Generate a new client secret** → Copy it immediately → This is `GITHUB_CLIENT_SECRET`

### 7.2 Required Scopes

When the OAuth flow redirects users, request these scopes:
- `repo` — Full access to private repositories (needed to read code, commits, file trees)
- `read:user` — Read user profile info

---

## 8. Jira OAuth 2.0 (3LO)

Jira integration allows PagerPilot to create and update issues during incidents.

### 8.1 Create an Atlassian Developer Account

1. Go to [https://developer.atlassian.com](https://developer.atlassian.com).
2. Sign in with your Atlassian account (or create one at [https://id.atlassian.com/signup](https://id.atlassian.com/signup)).
3. You also need a Jira Cloud instance for testing. Go to [https://www.atlassian.com/software/jira/free](https://www.atlassian.com/software/jira/free) and create a free Jira Cloud site (e.g., `pagerpilot-dev.atlassian.net`).

### 8.2 Create an OAuth 2.0 (3LO) App

1. Go to [https://developer.atlassian.com/console/myapps/](https://developer.atlassian.com/console/myapps/).
2. Click **Create** → **OAuth 2.0 integration**.
3. **Name:** `PagerPilot Dev` → Click **Create**.
4. In the app settings:

**Permissions tab:**
- Click **Add** next to **Jira API**.
- Add these scopes:
  - `read:jira-work`
  - `write:jira-work`
  - `read:jira-user`
- Click **Save**.

**Authorization tab:**
- Click **Add** under **OAuth 2.0 (3LO)**.
- **Callback URL:** `http://localhost:8000/api/integrations/jira/callback`
- Click **Save**.

**Settings tab:**
- Copy the **Client ID** → This is `JIRA_CLIENT_ID`
- Copy the **Secret** → This is `JIRA_CLIENT_SECRET`

### 8.3 Important Notes

- Jira OAuth 2.0 (3LO) requires the `offline_access` scope to get refresh tokens.
- After the OAuth flow, you must call `https://api.atlassian.com/oauth/token/accessible-resources` with the access token to get the `cloud_id`, which is required for all subsequent Jira API calls.
- Jira REST API v3 requires descriptions in **Atlassian Document Format (ADF)**, not plain strings.

---

## 9. Deepgram (Speech-to-Text)

Deepgram provides real-time streaming transcription with speaker diarization.

### 9.1 Create a Deepgram Account

1. Go to [https://deepgram.com](https://deepgram.com) and click **Sign Up** or **Get Started Free**.
2. Sign up with GitHub or email.
3. Deepgram offers $200 in free credits — no credit card required initially.

### 9.2 Get an API Key

1. After sign-in, go to the [Deepgram Console](https://console.deepgram.com/).
2. Navigate to **API Keys** in the left sidebar.
3. Click **Create a New API Key**.
   - **Name:** `pagerpilot-dev`
   - **Permissions:** Member (or Admin)
   - **Expiration:** No expiration (for dev)
4. Copy the key → This is `DEEPGRAM_API_KEY`.

### 9.3 Configuration Notes

- The project uses the **Nova-2** model (`model="nova-2"`) for best accuracy.
- Speaker diarization is enabled with `diarize=True`.
- Interim (partial) results are enabled with `interim_results=True` to give the UI real-time feedback.

---

## 10. ElevenLabs (Text-to-Speech)

ElevenLabs synthesizes voice responses that PagerPilot speaks aloud in meetings.

### 10.1 Create an ElevenLabs Account

1. Go to [https://elevenlabs.io](https://elevenlabs.io) and click **Sign Up**.
2. The free tier includes 10,000 characters/month — sufficient for development.

### 10.2 Get an API Key

1. After sign-in, click your profile icon (top right) → **Profile + API key**.
2. Copy your API key → This is `ELEVENLABS_API_KEY`.

### 10.3 Choose a Voice

1. Go to [https://elevenlabs.io/voice-library](https://elevenlabs.io/voice-library) or **Voices** in the sidebar.
2. Browse voices and pick one that sounds clear and professional (e.g., "Rachel", "Adam", or "Antoni").
3. Click on the voice → Copy the **Voice ID** from the URL or the voice details panel → This is `ELEVENLABS_VOICE_ID`.

### 10.4 Configuration Notes

- The project uses the `eleven_turbo_v2` model for lowest latency (critical for live meetings).
- Do **not** use `eleven_monolingual_v1` — it has higher latency and is deprecated.

---

## 11. LLM Provider (Anthropic / OpenAI)

PagerPilot uses an LLM for task extraction, deep dive ranking, question answering, and reassignment detection. You need at least one provider; having both gives you a fallback.

### 11.1 Anthropic (Recommended Primary)

1. Go to [https://console.anthropic.com](https://console.anthropic.com).
2. Sign up and add billing information.
3. Navigate to **API Keys** → **Create Key**.
4. Copy the key → This is `ANTHROPIC_API_KEY`.
5. Set `LLM_PROVIDER=anthropic` in your `.env`.

The project uses `claude-sonnet-4-6` for all LLM calls.

### 11.2 OpenAI (Required for Whisper, Optional for LLM)

Even if you use Anthropic as your primary LLM, you need an OpenAI key for the Whisper speech-to-text fallback.

1. Go to [https://platform.openai.com](https://platform.openai.com).
2. Sign up and add billing information.
3. Navigate to **API Keys** → **Create new secret key**.
4. Copy the key → This is `OPENAI_API_KEY`.

---

## 12. Playwright (Meeting Bot)

Playwright drives the headless browser that joins meetings. The Python package was already installed in Section 4.2, but you need the browser binary.

### 12.1 Install Chromium

```bash
cd backend
source venv/bin/activate
playwright install chromium
```

### 12.2 System Dependencies (Linux Only)

On Ubuntu/Debian, Playwright may need additional system libraries:

```bash
playwright install-deps chromium
```

This installs `libgbm1`, `libasound2`, and other graphics/audio libraries that Chromium needs.

### 12.3 Testing Playwright

Verify the installation:

```bash
python3 -c "
import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto('https://example.com')
        print('Title:', await page.title())
        await browser.close()

asyncio.run(test())
"
```

You should see: `Title: Example Domain`.

---

## 13. Docker

Docker is used to containerize the backend and bot worker for consistent environments.

### 13.1 Verify Docker

```bash
docker run hello-world
```

If this prints "Hello from Docker!", you're good.

### 13.2 Docker Compose

The project includes a `docker-compose.yml` at the repo root with services for `backend` and `bot_worker`. You don't need to build containers for local development (run directly with `uvicorn` and `python -m bot_worker.runner`), but Docker is used for integration testing and deployment.

---

## 14. Environment Files

### 14.1 Backend (`backend/.env`)

Create `backend/.env` with the following. Replace placeholder values with your actual credentials from the steps above:

```env
# Supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
DATABASE_URL=postgresql+asyncpg://postgres.your-ref:your-password@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# AWS S3
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=pagerpilot-artifacts

# LLM
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key

# ElevenLabs
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id

# STT
STT_PROVIDER=deepgram
DEEPGRAM_API_KEY=your_deepgram_key

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:8000/api/integrations/github/callback

# Jira OAuth
JIRA_CLIENT_ID=your_jira_client_id
JIRA_CLIENT_SECRET=your_jira_client_secret
JIRA_REDIRECT_URI=http://localhost:8000/api/integrations/jira/callback
```

### 14.2 Frontend (`frontend/.env.local`)

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### 14.3 Security Rules

- **Never commit `.env` or `.env.local` to Git.** Add both to `.gitignore`.
- **Never put `SUPABASE_SERVICE_ROLE_KEY` in the frontend.** It bypasses Row Level Security.
- **Never put `SUPABASE_JWT_SECRET` in the frontend.** It allows forging auth tokens.
- Share credentials via a password manager (1Password, Bitwarden) or a shared `.env` vault, not Slack or email.

---

## 15. Verification Checklist

Run through this checklist to confirm everything is set up correctly before starting sprint work.

| # | Check | Command / Action | Expected Result |
|---|-------|-----------------|-----------------|
| 1 | Python version | `python3 --version` | 3.11+ |
| 2 | Node version | `node --version` | 20.x |
| 3 | Backend venv active | `which python` | Points to `backend/venv/bin/python` |
| 4 | Backend deps installed | `python -c "import fastapi; print(fastapi.__version__)"` | 0.116+ |
| 5 | Playwright browser | `python -c "from playwright.sync_api import sync_playwright; print('OK')"` | OK |
| 6 | Frontend deps installed | `cd frontend && npm ls next` | next@14.x.x |
| 7 | Backend starts | `cd backend && uvicorn app.main:app --port 8000` | Swagger at localhost:8000/docs |
| 8 | Frontend starts | `cd frontend && npm run dev` | Page at localhost:3000 |
| 9 | Supabase connection | Run a test query via Supabase dashboard SQL editor | Query succeeds |
| 10 | AWS S3 bucket exists | Check S3 console | Bucket listed |
| 11 | `.env` files in `.gitignore` | `grep ".env" .gitignore` | Both patterns present |

Once all checks pass, you're ready to begin Sprint 1.
