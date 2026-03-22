"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Incident } from "@/types/api";

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
