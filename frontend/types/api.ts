export type Severity = "P1" | "P2" | "P3" | "P4";
export type IncidentStatus = "active" | "resolved" | "closed";
export type TaskStatus = "proposed" | "active" | "synced" | "reassigned";
export type AgentState =
  | "idle"
  | "joining"
  | "listening"
  | "speaking"
  | "investigating"
  | "error";

export type Workspace = {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
};

export type Incident = {
  id: string;
  workspace_id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  meeting_link: string | null;
  bot_session_id: string | null;
  audio_s3_key?: string | null;
  transcript_s3_key?: string | null;
  report_s3_key?: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type ActionItem = {
  id: string;
  incident_id: string;
  normalized_task: string;
  owner: string | null;
  status: TaskStatus;
  priority: string | null;
  confidence: number | null;
  jira_issue_key: string | null;
  proposed_at: string;
};

export type DeepDiveResult = {
  id: string;
  incident_id: string;
  suspect_file: string;
  suspect_lines_start: number | null;
  suspect_lines_end: number | null;
  confidence: number;
  evidence_json: Record<string, unknown> | null;
  rank: number;
  created_at: string;
};

export type IntegrationStatus = {
  has_github: boolean;
  has_jira: boolean;
};

export type GithubRepo = {
  full_name: string;
  description: string | null;
  default_branch: string;
};

export type JiraProject = {
  key: string;
  name: string;
};

export type TranscriptLine = {
  id: string;
  speaker: string;
  text: string;
  is_final: boolean;
  timestamp: number;
};

export type AgentStatus = {
  state: AgentState;
  lastMessage: string | null;
  timestamp: number;
};

export type TranscriptChunkMessage = {
  type: "transcript_chunk";
  incident_id: string;
  speaker: string;
  text: string;
  is_final: boolean;
  timestamp?: number;
  start_ts?: string | number | null;
  end_ts?: string | number | null;
  received_at?: string | null;
  startTs?: string | number | null;
  endTs?: string | number | null;
  receivedAt?: string | null;
};

export type ActionItemUpdateMessage = {
  type: "action_item_update";
  incident_id: string;
  task_id?: string;
  id?: string;
  normalized_task: string;
  owner: string | null;
  priority: string | null;
  status: TaskStatus;
  confidence: number | null;
  jira_issue_key: string | null;
  proposed_at?: string;
};

export type DeepDiveUpdateMessage = {
  type: "deep_dive_update";
  incident_id: string;
  results: DeepDiveResult[];
};

export type AgentStatusMessage = {
  type: "agent_status";
  incident_id: string;
  status: AgentState;
  last_message: string | null;
  timestamp: number;
};

export type IncidentSocketMessage =
  | TranscriptChunkMessage
  | ActionItemUpdateMessage
  | DeepDiveUpdateMessage
  | AgentStatusMessage;
