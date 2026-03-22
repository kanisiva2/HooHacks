"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Workspace } from "@/types/api";

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const { data } = await api.get<Workspace[]>("/api/workspaces");
      return data;
    },
  });
}

export function usePrimaryWorkspace() {
  const workspacesQuery = useWorkspaces();
  const primaryWorkspace = workspacesQuery.data?.[0] ?? null;

  return {
    ...workspacesQuery,
    workspace: primaryWorkspace,
  };
}
