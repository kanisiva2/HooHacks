export type TaskStatus = "proposed" | "active" | "synced" | "reassigned" | "closed";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface ActionItem {
  id: string;
  incident_id: string;
  normalized_task: string;
  owner: string | null;
  status: TaskStatus;
  priority: TaskPriority | null;
  confidence: number | null;
  jira_issue_key: string | null;
  proposed_at: string;
  synced_at: string | null;
}
