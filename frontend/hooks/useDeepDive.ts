"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DeepDiveResult } from "@/types/api";

export function useDeepDiveResults(incidentId: string | undefined) {
  return useQuery({
    queryKey: ["deep-dive", incidentId],
    enabled: Boolean(incidentId),
    queryFn: async () => {
      const { data } = await api.get<DeepDiveResult[]>(
        `/api/incidents/${incidentId}/deep-dive`,
      );
      return data;
    },
  });
}

export function useDeepDiveFileContent(
  incidentId: string | undefined,
  resultId: string | undefined,
) {
  return useQuery({
    queryKey: ["deep-dive-file", incidentId, resultId],
    enabled: Boolean(incidentId && resultId),
    queryFn: async () => {
      const { data } = await api.get<{ content: string }>(
        `/api/incidents/${incidentId}/deep-dive/${resultId}/file`,
      );
      return data.content;
    },
  });
}

export function useTriggerDeepDive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (incidentId: string) => {
      await api.post(`/api/incidents/${incidentId}/deep-dive/trigger`);
      return incidentId;
    },
    onSuccess: (incidentId) => {
      queryClient.invalidateQueries({ queryKey: ["deep-dive", incidentId] });
    },
  });
}
