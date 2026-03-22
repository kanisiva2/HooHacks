"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useIncidentStore } from "@/stores/incidentStore";
import type { ActionItem } from "@/types/api";
import { toastError, toastTaskDismissed, toastTaskSynced } from "@/lib/toast";

type TaskUpdateInput = {
  incidentId: string;
  taskId: string;
  owner?: string | null;
  priority?: string | null;
  status?: ActionItem["status"];
};

type TaskActionInput = {
  incidentId: string;
  taskId: string;
};

export function useTasks(incidentId: string | undefined) {
  return useQuery({
    queryKey: ["tasks", incidentId],
    enabled: Boolean(incidentId),
    queryFn: async () => {
      const { data } = await api.get<ActionItem[]>(`/api/incidents/${incidentId}/tasks`);
      return data;
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const upsertActionItem = useIncidentStore((state) => state.upsertActionItem);

  return useMutation({
    mutationFn: async ({ incidentId, taskId, ...patch }: TaskUpdateInput) => {
      const { data } = await api.patch<ActionItem>(
        `/api/incidents/${incidentId}/tasks/${taskId}`,
        patch,
      );
      return data;
    },
    onMutate: async ({ incidentId, taskId, ...patch }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", incidentId] });
      const previous = queryClient.getQueryData<ActionItem[]>(["tasks", incidentId]);
      if (previous) {
        const optimistic = previous.map((item) =>
          item.id === taskId ? { ...item, ...patch } : item,
        );
        queryClient.setQueryData(["tasks", incidentId], optimistic);
        const optimisticItem = optimistic.find((item) => item.id === taskId);
        if (optimisticItem) {
          upsertActionItem(optimisticItem);
        }
      }
      return { previous, incidentId };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["tasks", context.incidentId], context.previous);
      }
    },
    onSuccess: (item) => {
      queryClient.setQueryData<ActionItem[]>(["tasks", item.incident_id], (prev) => {
        if (!prev) {
          return [item];
        }
        const index = prev.findIndex((task) => task.id === item.id);
        if (index === -1) {
          return [...prev, item];
        }
        const updated = [...prev];
        updated[index] = item;
        return updated;
      });
      upsertActionItem(item);
    },
  });
}

export function useApproveTask() {
  const queryClient = useQueryClient();
  const upsertActionItem = useIncidentStore((state) => state.upsertActionItem);

  return useMutation({
    mutationFn: async ({ incidentId, taskId }: TaskActionInput) => {
      const { data } = await api.post<ActionItem>(
        `/api/incidents/${incidentId}/tasks/${taskId}/approve`,
      );
      return data;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", item.incident_id] });
      upsertActionItem(item);
      toastTaskSynced(item.jira_issue_key);
    },
    onError: () => {
      toastError("Failed to approve task");
    },
  });
}

export function useDismissTask() {
  const queryClient = useQueryClient();
  const upsertActionItem = useIncidentStore((state) => state.upsertActionItem);

  return useMutation({
    mutationFn: async ({ incidentId, taskId }: TaskActionInput) => {
      const { data } = await api.post<ActionItem>(
        `/api/incidents/${incidentId}/tasks/${taskId}/dismiss`,
      );
      return data;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", item.incident_id] });
      upsertActionItem(item);
      toastTaskDismissed();
    },
    onError: () => {
      toastError("Failed to dismiss task");
    },
  });
}
