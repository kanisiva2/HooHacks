"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { GithubRepo, IntegrationStatus, JiraProject } from "@/types/api";

export function useIntegrationStatus() {
  return useQuery({
    queryKey: ["integration-status"],
    queryFn: async () => {
      const { data } = await api.get<IntegrationStatus>("/api/integrations/status");
      return data;
    },
  });
}

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (provider: "github" | "jira") => {
      await api.delete(`/api/integrations/${provider}`);
      return provider;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-status"] });
      queryClient.invalidateQueries({ queryKey: ["github-repos"] });
      queryClient.invalidateQueries({ queryKey: ["jira-projects"] });
    },
  });
}

export function useGithubRepos(enabled = true) {
  return useQuery({
    queryKey: ["github-repos"],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<GithubRepo[]>("/api/integrations/github/repos");
      return data;
    },
  });
}

export function useJiraProjects(enabled = true) {
  return useQuery({
    queryKey: ["jira-projects"],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<JiraProject[]>("/api/integrations/jira/projects");
      return data;
    },
  });
}
