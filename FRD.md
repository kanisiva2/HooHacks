# PagerPilot  
## Functional Requirements Document
**AI incident operator for real-time meeting participation, codebase deep dives, and execution orchestration**  
**Version 1.0**  |  **Status: Build-ready MVP specification**  
**Prepared from the final agreed product definition in this conversation**  
**Audience:** engineering team, hackathon team, judges, recruiters, and future maintainers

### Document intent
This FRD consolidates the final product scope, system architecture, feature behavior, data model, external integrations, and implementation sequence needed to begin building PagerPilot immediately. The goal is to eliminate ambiguity before coding starts.

---

# 1. Product Overview
PagerPilot is a cloud-backed AI incident operator that joins engineering outage calls as an active participant, listens to the live conversation, answers spoken questions, converts verbal assignments into structured execution, investigates the connected codebase in real time, and surfaces likely files, commits, and next steps through a web dashboard that is also usable from a phone.

| Dimension | Final definition |
|---|---|
| Core problem | On-call incidents are operationally expensive because engineers lose time juggling the call, taking notes, assigning ownership, opening tools, searching the repo, and manually translating conversation into execution. |
| Primary user | Software engineers, incident commanders, and technical leads handling live production incidents. |
| Primary value | Reduce incident triage overhead and coordination latency by turning live meeting conversation into structured actions and evidence-backed technical investigation. |
| Product form | A responsive web app with a desktop-grade dashboard and mobile-first monitoring flow, backed by a cloud orchestration layer and a browser-automation meeting bot. |

### One-line pitch
PagerPilot is a voice-enabled AI incident operator that joins outage calls, listens in real time, answers spoken questions, investigates the codebase, updates Jira, and highlights likely root-cause files before engineers even open their laptops.

---

# 2. Objectives and Non-Objectives

| Type | Item | Priority |
|---|---|---|
| Goal | Join a live meeting as an actual bot and participate through speech. | Must |
| Goal | Create and update execution tasks during the meeting, not after it ends. | Must |
| Goal | Investigate the connected GitHub repo and surface likely suspect files, lines, and commits. | Must |
| Goal | Provide a polished desktop dashboard plus a usable phone view. | Must |
| Goal | Store artifacts and structured records for replay and post-incident review. | Must |
| Non-goal | Fully autonomously fix arbitrary bugs across arbitrary codebases. | Out |
| Non-goal | Build a native iOS/Android application for the MVP. | Out |
| Non-goal | Implement enterprise-grade multi-org RBAC, billing, or SSO administration. | Out |
| Non-goal | Support every meeting platform and every integration on day one. | Out |

---

# 3. Target Users and Primary Use Cases
- **On-call engineer:** Gets paged, opens PagerPilot on a phone, launches the agent into the call, and uses the dashboard to monitor findings while still mobile.
- **Incident commander:** Uses the live transcript, task board, and deep dive evidence panel to keep ownership clear and guide response decisions.
- **Engineering manager or platform lead:** Reviews incident history, generated reports, and task completion after the outage for accountability and learning.
- **Hackathon judge / recruiter lens:** Sees a credible AI system with real integrations, cloud architecture, meeting participation, and measurable enterprise impact.

---

# 4. Success Criteria
- **Demo success:** The bot joins the meeting, transcribes speech, extracts at least one action item correctly, updates Jira during the call, answers at least one spoken question, and highlights a likely issue in the repo with evidence.
- **Product success:** The dashboard feels like a real SaaS tool rather than a script or a collection of APIs.
- **Technical success:** The system architecture cleanly separates frontend, orchestration backend, storage, meeting bot, and external integrations.
- **Resume success:** The final project can be described as a cloud-based AI incident operator using Supabase Auth/Postgres, AWS S3, GitHub, Jira, and real-time speech and code analysis.

---

# 5. Final Product Surface
The end product is one responsive web application with two usage modes: desktop and mobile.

| Surface | Behavior |
|---|---|
| Desktop experience | Full incident workspace with live transcript, incident state, task board, deep dive panel, code viewer, integration management, and incident history. |
| Mobile experience | Launch and monitor incidents, listen to or read agent updates, view top suspect file summary, view action ownership, and ask the agent quick questions. |
| Why web, not native app | One codebase, lower implementation risk, easier integration handling, easier live demo, still preserves the mobile story. |
| Why not local script | A script weakens product legitimacy, reduces visual clarity, and undersells architecture and resume value. |

---

# 6. Website Navigation and Tabs

| Tab | Purpose | Key contents |
|---|---|---|
| Dashboard | Operational overview | Active incidents, agent status, recent updates, quick launch controls, recent tasks |
| Incidents | Core workflow and live demo screen | Live incident room, transcript, action board, hypotheses, voice status |
| Deep Dive | Technical investigation workspace | Suspect files, code highlight panel, commit diff, logs/evidence |
| Integrations | Connectivity and trust surface | GitHub repo selection, Jira project selection, Slack/Notion optional cards |
| Settings | Workspace preferences | Voice settings, default repo, default Jira project, workspace metadata |

---

# 7. Core Architecture
PagerPilot uses a thin-client plus cloud-brains architecture.

### Architecture principle
The browser and phone are control-and-display surfaces. Almost all meaningful computation runs in the cloud backend or in supporting workers. The meeting bot is the only hybrid edge component because it needs to join a call and route audio.

### High-level architecture flow
```text
Mobile / Desktop Next.js Client
      ↓ HTTPS + WebSockets
FastAPI Orchestrator / API Layer
      ├─ Incident Intelligence Pipeline (STT, parsing, task state)
      ├─ Deep Dive Agent (repo, commits, evidence ranking)
      ├─ Voice Interaction Layer (question detection, ElevenLabs output)
      ├─ Integration Layer (GitHub, Jira, optional Slack/Notion)
      └─ Artifact and data persistence
             ├─ Supabase Postgres + Auth
             └─ AWS S3

Meeting Bot (Playwright)
      ├─ joins meeting
      ├─ captures audio
      └─ plays bot voice back into meeting
```

---

# 8. Final Technology Stack

| Layer | Technology | Role |
|---|---|---|
| Frontend | Next.js + TypeScript | Primary web application, dashboard UI, responsive desktop/mobile experience |
| UI system | Tailwind CSS + shadcn/ui | Fast, polished SaaS-grade components and consistent design language |
| Code viewer | Monaco Editor | Read-only code display with live highlighted suspect lines and annotations |
| Auth | Supabase Auth | User account creation, sessions, OAuth, workspace access |
| Database | Supabase Postgres | Structured relational data for users, workspaces, incidents, tasks, metadata |
| Object storage | AWS S3 | Meeting audio, transcript exports, reports, screenshots, debug artifacts |
| Backend | FastAPI (Python) | Orchestration API, real-time pipelines, integrations, AI coordination |
| Realtime transport | WebSockets | Stream transcript, task updates, deep dive progress, and voice status to UI |
| Meeting bot | Playwright | Join meeting links through browser automation and serve as the visible bot |
| Speech-to-text | Whisper or Deepgram | Convert meeting audio into text chunks for downstream reasoning |
| Reasoning/LLM | OpenAI or Anthropic API | Task extraction, reassignment semantics, deep dive reasoning, and spoken Q&A |
| Voice output | ElevenLabs | Convert bot responses and proactive updates into speech played into the meeting |
| Repo/integrations | GitHub API + Jira API | Connect source code and execution systems to the product |

---

# 9. Detailed Data and Storage Architecture
Structured product data belongs in Supabase Postgres. Large binary and export artifacts belong in AWS S3.

| Store | Use |
|---|---|
| Supabase Auth | User sign-in, account creation, session management, and OAuth-backed identity. |
| Supabase Postgres | Users, workspaces, integrations, incidents, action items, transcript chunk metadata, deep dive results, and event logs. |
| AWS S3 | Raw meeting audio, transcript exports, generated reports, screenshots, and any file-sized outputs produced by the pipeline. |
| Storage linkage | Postgres stores metadata and S3 object keys rather than duplicate file payloads. |

---

# 10. Suggested Core Database Schema

| Table | Purpose | Key fields |
|---|---|---|
| users | Authenticated user profile | id, email, display_name, created_at |
| workspaces | Team/workspace boundary | id, name, owner_user_id, created_at |
| workspace_members | Workspace membership | workspace_id, user_id, role |
| integrations | Connected external systems | workspace_id, provider, token_ref, metadata_json |
| incidents | Top-level incident record | id, workspace_id, title, severity, status, meeting_link, created_at |
| incident_events | Event timeline for incident | incident_id, event_type, payload_json, timestamp |
| action_items | Live task state machine | incident_id, normalized_task, owner, status, jira_issue_key |
| transcript_chunks | Transcript ingestion history | incident_id, speaker, text, start_ts, end_ts |
| deep_dive_results | Investigation output | incident_id, suspect_file, suspect_lines, confidence, evidence_json |

---

# 11. External Integration Strategy
- **GitHub:** Must-have. Used to authenticate to repositories, enumerate file trees, read files, inspect recent commits and diffs, and support evidence-backed code highlighting.
- **Jira:** Must-have. Used to create and update tickets/tasks in real time as assignments stabilize during the call.
- **Slack:** Optional. Good for future push notifications or incident summaries, but not required for MVP.
- **Notion:** Optional. Useful for documentation and polished product breadth, but lower priority than GitHub and Jira.

---

# 12. Security and Credential Handling
- **Managed auth first:** Use Supabase Auth rather than custom auth logic.
- **Principle of least privilege:** Request only GitHub and Jira scopes needed for repo read access and task synchronization.
- **Secrets handling:** Store provider tokens server-side only. Never expose integration secrets in the client.
- **Storage separation:** Persist artifact files in S3 and structured references in Postgres.
- **Demo realism note:** Because this is a hackathon MVP, security should be competent and believable, but not enterprise-complete.

---

# 13. Functional Requirements - End-to-End User Flow

## 13.1 First-time onboarding
- **Step 1 - Sign in:** User signs in using Supabase Auth.
- **Step 2 - Create workspace:** User creates or joins a workspace.
- **Step 3 - Connect tools:** User connects GitHub and Jira on the Integrations tab.
- **Step 4 - Set defaults:** User chooses default repo, default Jira project, and optional voice preferences.
- **Step 5 - Ready state:** User lands on Dashboard and can launch an incident.

## 13.2 Start an incident
- **Step 1:** User clicks Start Incident from desktop or mobile.
- **Step 2:** User enters title, severity, and meeting link or meeting credentials.
- **Step 3:** Frontend sends incident creation request to backend and creates a live incident room.
- **Step 4:** Meeting bot is launched and joins the meeting as PagerPilot AI.
- **Step 5:** Dashboard moves to the Incidents tab and shows live agent status.

## 13.3 Live meeting participation
- **Step 1:** Meeting audio is captured by the bot and streamed to the backend.
- **Step 2:** STT converts incoming audio into transcript chunks.
- **Step 3:** Transcript chunks are parsed into structured incident signals: affected service, assignments, reassignments, hypotheses, blockers, and user questions directed at the bot.
- **Step 4:** UI updates in near real time with transcript, tasks, and incident state.
- **Step 5:** If someone directly addresses the bot or a meaningful discovery occurs, the backend generates a short response and plays it into the meeting through ElevenLabs voice output.

## 13.4 Deep dive investigation
- **Step 1:** The backend detects enough incident context to trigger a codebase deep dive.
- **Step 2:** Repo search agent queries repo tree, file names, recent commits, and commit diffs for relevant matches.
- **Step 3:** LLM-assisted ranking narrows to likely suspect files or functions.
- **Step 4:** A highlighted code region and explanation are pushed to the Deep Dive panel and the Incidents panel preview.
- **Step 5:** The bot can speak the most important finding into the meeting.

## 13.5 Task sync and ownership changes
- **Step 1:** Conversation produces a proposed task, such as "John investigate auth middleware."
- **Step 2:** The task appears instantly in the UI as a structured action item.
- **Step 3:** A short stabilization delay prevents duplicate or noisy task creation.
- **Step 4:** Once stable, Jira issue creation or update is triggered.
- **Step 5:** If ownership changes verbally, PagerPilot updates the same task rather than creating a second task.

## 13.6 Post-incident artifacts
- **Step 1:** Transcript export, report summary, and any generated artifacts are saved to S3.
- **Step 2:** Structured metadata and references are persisted in Postgres.
- **Step 3:** The incident remains accessible on Dashboard and incident history views.

---

# 14. Feature-by-Feature Requirements

## Authentication and account creation
- Use Supabase Auth for sign-up, sign-in, sessions, and identity management.
- The system shall support account creation before any incident workflow begins.
- The system shall tie workspaces, integrations, and incidents to authenticated users.
- The UI shall include a simple first-run flow with sign-in, workspace creation, and integration connection.

## GitHub integration
- The system shall allow a user to connect GitHub during onboarding or later via Integrations.
- The system shall let a workspace choose one or more repositories for an incident.
- The system shall be able to fetch repo tree, file contents, recent commits, and diff summaries.
- The system shall not require write access for MVP deep dive behavior.

## Jira integration
- The system shall allow a workspace to connect a Jira project.
- The system shall create or update Jira issues during the meeting once a task assignment is stable.
- The system shall support live reassignment of ownership for an existing structured task.
- The UI shall display the linked Jira issue key when available.

## Meeting bot
- The system shall accept a meeting link or credential set and launch a Playwright-driven bot.
- The bot shall join the meeting under a visible agent name such as PagerPilot AI.
- The bot shall capture incoming meeting audio for STT processing.
- The bot shall be able to play synthesized speech back into the meeting.

## Speech-to-text pipeline
- The system shall transform live audio into transcript chunks suitable for real-time use.
- Transcript latency should be low enough for the UI to feel live during the demo.
- The transcript shall preserve chunk timing metadata and speaker label when available.
- Transcript chunks shall be stored or exportable for later artifact generation.

## Task extraction and reassignment engine
- The system shall convert verbal assignments into structured action items.
- The system shall treat task creation as a stateful process rather than creating a ticket from every sentence.
- The system shall deduplicate semantically similar tasks when possible.
- The system shall update ownership when later transcript chunks revise the assignment.

## Deep Dive agent
- The system shall launch a technical investigation once incident context is sufficient.
- The system shall search connected repository content and recent diffs for likely evidence.
- The system shall return ranked suspect files and, where possible, suspect functions or lines.
- The system shall expose evidence text explaining why the file or lines were selected.

## Live code highlight panel
- The dashboard shall contain a code viewer showing the top suspect file.
- The code viewer shall support line numbers and highlighted suspect ranges.
- The panel shall also show an explanation, confidence score, and related commit or log evidence.
- The panel shall update live as the deep dive progresses.

## Voice interaction with ElevenLabs
- The bot shall be able to speak short updates into the meeting.
- Participants shall be able to ask the bot direct questions in the meeting.
- The backend shall detect direct-address questions and produce short spoken answers.
- The system shall avoid excessive speaking and prioritize concise, high-value updates.

## Incident dashboard
- The dashboard shall display transcript, task board, incident status, deep dive preview, and agent state in one place.
- The desktop layout shall prioritize multi-panel visibility.
- The mobile layout shall preserve incident monitoring and launch flows without exposing the full code workspace.
- The dashboard shall stream live updates through WebSockets.

## Artifact storage and history
- The system shall store large generated artifacts in AWS S3.
- The system shall store incident metadata, task states, and artifact references in Postgres.
- The system shall expose incident history so earlier runs remain visible in the product.
- The system shall support future report playback or export using stored artifacts.

---

# 15. Real-Time Task State Machine
This subsystem is critical. PagerPilot must create tasks during the meeting, but not naively from every sentence.

| State | Meaning | Transition trigger |
|---|---|---|
| Proposed | Task language detected but not yet stable | New assignment phrase detected |
| Active | Task stabilized and shown in UI as current work item | Short delay plus explicit owner/task confidence |
| Synced | Task has been created or updated in Jira | Successful integration call |
| Reassigned | Owner or wording changed while preserving same task identity | Semantic reassignment detected in later transcript |
| Closed | Task marked done or incident resolved | User/system close action |

### Design rule
UI updates instantly. Jira updates after a brief stabilization window. This preserves the live operational feel without creating duplicate tickets from noisy early discussion.

---

# 16. Deep Dive Agent Design
The deep dive agent is the technical differentiator that makes the product more than a meeting summarizer.
- **Input signals:** incident summary, transcript phrases, service names, error terms, deployment hints, and optional stack traces or logs.
- **Search phase:** match against repo tree, filenames, code symbols, commit messages, and recent diffs.
- **Ranking phase:** combine deterministic retrieval with model-assisted reasoning to produce top suspects.
- **Output phase:** suspect file, suspect line range, why it matters, and the confidence/evidence used to justify it.

| Approach | Use |
|---|---|
| Easy version | Keyword and stack-trace matching narrow to a function or file, then the dashboard highlights that block. |
| Preferred MVP version | Deterministic narrowing first, then LLM-assisted line selection and explanation over a limited code window. |
| Avoid for MVP | Claiming full autonomous arbitrary bug fixing. It weakens credibility and expands scope dramatically. |

---

# 17. Live Code Highlight Panel Design
The live code highlight panel belongs on the dashboard, primarily within the Deep Dive tab and as a preview in the Incidents tab.
- **Desktop location:** Right-hand or dedicated panel in the deep dive workspace.
- **Mobile behavior:** Show a condensed snippet with top suspect file, a short highlighted excerpt, and a prompt to use desktop for full code analysis when needed.
- **Visual content:** Syntax-highlighted code, highlighted line range, evidence badges, explanation text, related commit or deploy note.
- **Perceived liveness:** Show investigation progress before revealing the final suspect code so the user sees the system actively working.

---

# 18. Voice Interaction Design
- **Inbound voice:** Participants ask questions such as "PagerPilot, what have you found?"
- **Detection:** Transcript parser identifies direct-address queries and routes them to a response generator.
- **Response style:** One or two concise sentences maximum. High confidence, evidence-backed, no rambling.
- **Outbound voice:** ElevenLabs synthesizes the answer, and the meeting bot plays the audio into the call.
- **Proactive speaking:** Allowed only for meaningful updates such as likely root cause discovery or confirmed Jira sync.

---

# 19. Desktop vs Mobile Requirements

| Capability | Desktop | Mobile |
|---|---|---|
| Launch incident | Yes | Yes |
| Watch transcript | Full live transcript | Condensed live transcript or summary |
| Action board | Full editable view | Compact card/list view |
| Deep Dive evidence | Full workspace with code panel | Top suspect summary and short excerpt |
| Ask agent questions | Yes | Yes |
| Monitor voice state | Yes | Yes |
| Detailed repo analysis | Primary experience | Secondary / condensed |

---

# 20. Backend Service Responsibilities
- **API orchestration:** Expose endpoints for auth-aware workspace configuration, incident creation, transcript updates, integration actions, and artifact access.
- **Realtime:** Push transcript chunks, task updates, deep dive progress, and voice status to the client through WebSockets.
- **Bot coordination:** Launch meeting bot sessions and manage their lifecycle.
- **AI coordination:** Route STT output into extraction, deep dive, and response-generation pipelines.
- **Persistence:** Write structured data to Postgres and upload files to S3.

---

# 21. Step-by-Step Internal Pipelines

## 21.1 Meeting audio to transcript
- 1. Meeting bot joins call via Playwright.
- 2. Bot captures system audio or meeting audio stream.
- 3. Audio chunks are streamed to backend.
- 4. STT engine produces transcript chunks with timestamps.
- 5. Transcript chunks are written to UI and persisted.

## 21.2 Transcript to structured execution
- 1. Chunk arrives at parsing layer.
- 2. Parser extracts entities: names, services, tasks, decisions, reassignments.
- 3. Task state machine merges the new information into the current task set.
- 4. UI updates immediately.
- 5. Stable items trigger Jira create/update.

## 21.3 Transcript to deep dive
- 1. Parser determines there is enough incident context to investigate.
- 2. Repo search gathers candidate files, recent commits, and diffs.
- 3. Reasoning layer ranks candidates and selects evidence.
- 4. Deep Dive tab and code panel update live.
- 5. Bot may announce the strongest finding.

## 21.4 Spoken question to spoken answer
- 1. Participant asks, for example, "PagerPilot, what files are suspicious?"
- 2. Transcript parser labels the chunk as a direct-address question.
- 3. Response generator uses current incident state and deep dive results.
- 4. Text answer is synthesized with ElevenLabs.
- 5. Meeting bot speaks the answer back into the meeting.

---

# 22. Non-Functional Requirements
- **Responsiveness:** Dashboard should feel live, with transcript and task updates arriving in near real time during demo conditions.
- **Reliability:** The meeting demo must be controlled and predictable; fallback to prerecorded audio is acceptable if the architecture still supports live mode.
- **Usability:** The UI should feel like a coherent operational tool, not a collection of scripts.
- **Scalability story:** Architecture should be explainable as cloud-scale even if the hackathon deployment is single-team and low-volume.
- **Observability:** Logs should make it easy for the team to debug failed bot joins, STT issues, and integration errors.

---

# 23. Error Handling and Fallbacks
- **Meeting join failure:** Show clear UI state, allow retry, and support backup demo mode with controlled audio input.
- **STT degradation:** Continue UI updates with whatever transcript quality is available; retain the raw audio artifact for replay.
- **Integration failure:** Task remains active in PagerPilot UI even if Jira sync fails; show explicit sync error state instead of dropping the task.
- **Deep dive uncertainty:** Show confidence and evidence; do not overstate findings as guaranteed root cause.
- **Voice failure:** Render the last spoken message in text on dashboard so the bot remains understandable.

---

# 24. MVP vs Stretch Scope

| Area | MVP | Stretch |
|---|---|---|
| Auth | Supabase sign-in and workspace flow | Additional auth providers or advanced roles |
| Integrations | GitHub + Jira | Slack and Notion |
| Meeting bot | Join call and route audio | More meeting platforms and richer bot controls |
| Voice | Answer direct questions and announce key findings | More natural turn-taking and richer conversations |
| Deep Dive | Ranked suspect files and highlighted lines | Patch generation or PR drafting |
| History | Stored incidents and artifacts | Replay, analytics, and postmortem generation |

---

# 25. Implementation Order
- **Phase 1 - Product shell:** Set up Next.js app, Supabase auth, workspace flow, dashboard skeleton, and Integrations tab.
- **Phase 2 - Core data:** Create Postgres schema, S3 artifact wiring, and backend API contracts.
- **Phase 3 - Meeting bot:** Implement Playwright join flow and audio capture path.
- **Phase 4 - STT and live transcript:** Get audio-to-text working end to end with UI streaming.
- **Phase 5 - Task engine and Jira sync:** Implement task extraction, stabilization, live reassignment, and Jira updates.
- **Phase 6 - Deep Dive:** Connect GitHub, search repo, rank suspects, and display code highlight panel.
- **Phase 7 - Voice interaction:** Support direct spoken Q&A and proactive updates through ElevenLabs.
- **Phase 8 - Polish:** Improve mobile responsiveness, incident history, and final demo choreography.

---

# 26. Team Split Suggestion for 4 Builders

| Owner | Primary focus | Secondary focus |
|---|---|---|
| Engineer 1 | Next.js frontend, dashboard, mobile responsiveness, Monaco code panel | Integrations UI and onboarding polish |
| Engineer 2 | FastAPI backend, WebSockets, data model, Supabase/S3 wiring | Incident APIs and persistence |
| Engineer 3 | Meeting bot, audio routing, STT pipeline, ElevenLabs speech loop | Bot lifecycle and demo reliability |
| Engineer 4 | GitHub deep dive, task extraction, Jira sync, evidence ranking | Parser quality and incident intelligence |

---

# 27. Demo Script Requirements
- 1. User launches incident from the app and enters a meeting link.
- 2. PagerPilot AI joins the meeting.
- 3. Participants verbally describe the outage and assign work.
- 4. Transcript appears live; tasks appear and then sync to Jira.
- 5. Ownership changes verbally; UI and Jira update accordingly.
- 6. A participant asks PagerPilot what it has found.
- 7. PagerPilot answers aloud and highlights the suspect file/lines on the dashboard.
- 8. Dashboard shows the linked GitHub evidence and current incident state.

---

# 28. Final Build Guardrails
- **Do not oversell:** Focus on reducing triage time, not fully replacing engineers.
- **Do not overbuild infra:** Skip Redis and unnecessary services unless they are free wins for the team.
- **Do not diffuse scope:** GitHub, Jira, voice, transcript, and deep dive are the center of gravity.
- **Do prioritize credibility:** A narrower system that clearly works beats a broad system with fake behavior.

---

# 29. Final Definition Summary

| Build-ready summary |
|---|
| PagerPilot is a responsive web application backed by FastAPI, Supabase Auth/Postgres, and AWS S3. A Playwright bot joins an incident meeting, streams audio to the backend, and uses STT plus LLM reasoning to transcribe discussion, extract and reassign tasks, update Jira, investigate the connected GitHub repo, and answer spoken questions through ElevenLabs. The desktop dashboard exposes the full incident room and deep dive workspace, while mobile provides launch and monitoring capabilities. |