"use client";

import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

type WorkspaceDefaults = {
  default_repo: string | null;
  default_jira_project_key: string | null;
  jira_site_url: string | null;
};

type WorkspaceDefaultsPayload = {
  default_repo?: string;
  default_jira_project_key?: string;
};

export function useWorkspaceDefaults(enabled = true) {
  return useQuery({
    queryKey: ["workspace-defaults"],
    enabled,
    queryFn: async () => {
      try {
        const { data } = await api.get<WorkspaceDefaults>("/api/integrations/defaults");
        return data;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return {
            default_repo: null,
            default_jira_project_key: null,
            jira_site_url: null,
          };
        }
        throw error;
      }
    },
  });
}

export function useUpdateWorkspaceDefaults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: WorkspaceDefaultsPayload) => {
      const { data } = await api.patch<WorkspaceDefaults>(
        "/api/integrations/defaults",
        payload,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-defaults"] });
      queryClient.invalidateQueries({ queryKey: ["github-repos"] });
      queryClient.invalidateQueries({ queryKey: ["jira-projects"] });
    },
  });
}
