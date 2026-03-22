"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ApplyFixSuggestionRequest,
  ApplyFixSuggestionResponse,
  DeepDiveResult,
  FixSuggestion,
} from "@/types/api";
import { toastDeepDiveTriggered, toastError } from "@/lib/toast";

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
      toastDeepDiveTriggered();
    },
    onError: () => {
      toastError("Failed to trigger deep dive");
    },
  });
}

export function useGenerateFixSuggestion(
  incidentId: string | undefined,
  resultId: string | undefined,
) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<FixSuggestion>(
        `/api/incidents/${incidentId}/deep-dive/${resultId}/suggest-fix`,
      );
      return data;
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Failed to generate a fix suggestion";
      toastError(message);
    },
  });
}

export function useApplyFixSuggestion(
  incidentId: string | undefined,
  resultId: string | undefined,
) {
  return useMutation({
    mutationFn: async (payload: ApplyFixSuggestionRequest) => {
      const { data } = await api.post<ApplyFixSuggestionResponse>(
        `/api/incidents/${incidentId}/deep-dive/${resultId}/apply-fix`,
        payload,
      );
      return data;
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Failed to apply the fix suggestion";
      toastError(message);
    },
  });
}
