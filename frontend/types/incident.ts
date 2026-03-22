export type IncidentSeverity = "P1" | "P2" | "P3" | "P4";

export type IncidentStatus =
  | "new"
  | "active"
  | "resolved"
  | "closed"
  | "archived";

export type AgentStatus = "idle" | "joining" | "listening" | "speaking" | "investigating";

export interface Incident {
  id: string;
  workspace_id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  meeting_link: string | null;
  bot_session_id: string | null;
  agent_status: AgentStatus | null;
  audio_s3_key: string | null;
  transcript_s3_key: string | null;
  report_s3_key: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface IncidentEvent {
  id: string;
  incident_id: string;
  event_type: string;
  payload_json: Record<string, unknown> | null;
  timestamp: string;
}
