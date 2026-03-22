export interface SuspectLineRange {
  start: number;
  end: number;
}

export interface SuspectFile {
  file_path: string;
  confidence: number;
  rank: number;
  evidence_text: string;
  commit_sha: string | null;
  commit_message: string | null;
}

export interface DeepDiveResult {
  id: string;
  incident_id: string;
  suspect_file: string;
  suspect_lines: SuspectLineRange | null;
  confidence: number;
  evidence_json: Record<string, unknown> | null;
  rank: number;
  created_at: string;
}
