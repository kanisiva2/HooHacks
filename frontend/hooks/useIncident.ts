"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Incident, TranscriptLine } from "@/types/api";

function toEpochMs(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return value > 10_000_000_000 ? value : value * 1000;
  }
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return numeric > 10_000_000_000 ? numeric : numeric * 1000;
  }
  const parsed = +new Date(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function useIncident(incidentId: string | undefined) {
  return useQuery({
    queryKey: ["incident", incidentId],
    enabled: Boolean(incidentId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await api.get<Incident>(`/api/incidents/${incidentId}`);
      return data;
    },
  });
}

export function useIncidents(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["incidents", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const { data } = await api.get<Incident[]>("/api/incidents", {
        params: {
          workspace_id: workspaceId,
        },
      });
      return data;
    },
  });
}

type TranscriptChunkResponse = {
  id: string;
  speaker: string;
  text: string;
  start_ts?: string | number | null;
  end_ts?: string | number | null;
  is_final: boolean;
  created_at?: string | null;
};

export function useIncidentTranscript(incidentId: string | undefined) {
  return useQuery({
    queryKey: ["incident-transcript", incidentId],
    enabled: Boolean(incidentId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await api.get<TranscriptChunkResponse[]>(
        `/api/incidents/${incidentId}/transcript`,
      );
      return data.map<TranscriptLine>((line) => ({
        id: line.id,
        speaker: line.speaker,
        text: line.text,
        is_final: line.is_final,
        timestamp:
          toEpochMs(line.start_ts) ??
          toEpochMs(line.end_ts) ??
          toEpochMs(line.created_at) ??
          Date.now(),
      }));
    },
  });
}
